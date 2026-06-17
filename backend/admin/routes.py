from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.admin.deps import admin_required
from backend.config import get_settings
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
    protagonist_name: str | None = None
    flight_id: str | None = None


class SeedDemoResponse(BaseModel):
    user_email: str
    protagonist_name: str | None = None
    flight_id: str | None = None
    policy_ids: list[str] = []
    policies_created: int
    claims_settled: int


_DELAY_OVERRIDES: dict[str, int] = {}


def get_injected_delay(flight_id: str) -> int | None:
    return _DELAY_OVERRIDES.get(flight_id)


def clear_injected_delays() -> None:
    _DELAY_OVERRIDES.clear()


def _ensure_cinema_autoseed_enabled() -> None:
    if not get_settings().cinema_autoseed_enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="cinema autoseed disabled")


async def _inject_delay_impl(
    *,
    body: InjectDelayRequest,
    session: AsyncSession,
    request: Request,
) -> InjectDelayResponse:
    flight = await FlightService(session).get_flight(body.flight_id)
    if flight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="flight unknown")
    _DELAY_OVERRIDES[body.flight_id] = body.delay_minutes
    await request.app.state.claim_engine.run_for_flight(body.flight_id)
    return InjectDelayResponse(flight_id=body.flight_id, delay_minutes=body.delay_minutes)


@router.post(
    "/admin/inject-delay",
    response_model=InjectDelayResponse,
    dependencies=[Depends(admin_required)],
)
async def admin_inject_delay(
    body: InjectDelayRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    request: Request,
) -> InjectDelayResponse:
    return await _inject_delay_impl(body=body, session=session, request=request)


@router.post("/inject-delay", response_model=InjectDelayResponse)
async def cinema_inject_delay(
    body: InjectDelayRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    request: Request,
) -> InjectDelayResponse:
    _ensure_cinema_autoseed_enabled()
    return await _inject_delay_impl(body=body, session=session, request=request)


async def _seed_demo_impl(
    *,
    body: SeedDemoRequest,
    session: AsyncSession,
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

    if body.protagonist_name:
        user.name = body.protagonist_name

    if body.flight_id:
        requested_flight = body.flight_id.strip()
        exact_flight = await session.get(Flight, requested_flight)
        if exact_flight is not None:
            flights = [exact_flight]
        else:
            flights = (
                await session.execute(
                    select(Flight).where(Flight.callsign == requested_flight).limit(1)
                )
            ).scalars().all()
    else:
        flights = (await session.execute(select(Flight).limit(5))).scalars().all()
    if len(flights) < 1:
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
    policy_ids: list[str] = []
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
        policy_ids.append(policy.id)
    await session.commit()

    protagonist_flight_id = flights[0].id

    return SeedDemoResponse(
        user_email=body.user_email,
        protagonist_name=body.protagonist_name,
        flight_id=protagonist_flight_id,
        policy_ids=policy_ids,
        policies_created=len(policy_ids),
        claims_settled=0,
    )


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
    return await _seed_demo_impl(body=body, session=session, request=request)


@router.post("/seed-demo", response_model=SeedDemoResponse)
async def cinema_seed_demo(
    body: SeedDemoRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    request: Request,
) -> SeedDemoResponse:
    return await _seed_demo_impl(body=body, session=session, request=request)
