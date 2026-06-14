from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.admin.deps import admin_required
from backend.db import get_session
from backend.flights.service import FlightService

router = APIRouter()


class InjectDelayRequest(BaseModel):
    flight_id: str
    delay_minutes: int


class InjectDelayResponse(BaseModel):
    flight_id: str
    delay_minutes: int


class SeedDemoRequest(BaseModel):
    user_email: str = "captain@local.dev"


class SeedDemoResponse(BaseModel):
    user_email: str
    policies_created: int
    claims_settled: int


_DELAY_OVERRIDES: dict[str, int] = {}


def get_injected_delay(flight_id: str) -> int | None:
    return _DELAY_OVERRIDES.get(flight_id)


def clear_injected_delays() -> None:
    _DELAY_OVERRIDES.clear()


@router.post(
    "/admin/inject-delay",
    response_model=InjectDelayResponse,
    dependencies=[Depends(admin_required)],
)
async def inject_delay(
    body: InjectDelayRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InjectDelayResponse:
    flight = await FlightService(session).get_flight(body.flight_id)
    if flight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="flight unknown")
    _DELAY_OVERRIDES[body.flight_id] = body.delay_minutes
    return InjectDelayResponse(flight_id=body.flight_id, delay_minutes=body.delay_minutes)


@router.post(
    "/admin/seed-demo",
    response_model=SeedDemoResponse,
    dependencies=[Depends(admin_required)],
)
async def seed_demo(
    body: SeedDemoRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    request: Request,
) -> SeedDemoResponse:
    from sqlalchemy import select

    from backend.contracts.base import Condition, ConditionType
    from backend.models import Flight, User
    from backend.policies.service import PolicyService

    user = (
        await session.execute(select(User).where(User.email == body.user_email))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user unknown")

    flights = (await session.execute(select(Flight).limit(5))).scalars().all()
    if len(flights) < 3:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="not enough flights in DB; wait for FlightFetcher or seed flights manually",
        )

    # 保底余额，避免 demo 现场重复清库后余额不足。
    if user.balance < 100:
        user.balance = 1000
        await session.flush()

    policy_service = PolicyService(session)
    adapter = request.app.state.contract_adapter
    policies_created = 0
    for flight in flights[:5]:
        condition = Condition(type=ConditionType.DELAY, threshold_min=30)
        policy = await policy_service.create_policy(
            user=user,
            flight_id=flight.id,
            premium=10,
            condition=condition,
            delay_rate=0.1,
        )
        ref = await adapter.watch(policy_id=policy.id, flight_id=flight.id, condition=condition)
        await policy_service.attach_contract_ref(policy, ref.id)
        policies_created += 1
    await session.commit()

    # 前两个航班注入延误，随后立即触发一次结算，填充 demo 视图。
    for flight in flights[:2]:
        _DELAY_OVERRIDES[flight.id] = 45

    engine = request.app.state.claim_engine
    summary = await engine.run_once()

    return SeedDemoResponse(
        user_email=body.user_email,
        policies_created=policies_created,
        claims_settled=summary.triggered,
    )
