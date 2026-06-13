from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import CurrentUser
from backend.auth.service import InsufficientBalanceError
from backend.contracts.base import Condition, ConditionType
from backend.db import get_session
from backend.flights.service import FlightService
from backend.policies.schemas import CreatePolicyRequest, PolicyPublic
from backend.policies.service import InvalidPremiumError, PolicyService


router = APIRouter()


@router.post("/policies", response_model=PolicyPublic, status_code=status.HTTP_201_CREATED)
async def create_policy(
    body: CreatePolicyRequest,
    request: Request,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PolicyPublic:
    flight = await FlightService(session).get_flight(body.flight_id)
    if flight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="flight unknown")

    stats = await FlightService(session).delay_stats(callsign=flight.callsign)
    condition = Condition(type=ConditionType.DELAY, threshold_min=30)
    try:
        policy = await PolicyService(session).create_policy(
            user=user,
            flight_id=flight.id,
            premium=body.premium,
            condition=condition,
            delay_rate=stats.delay_rate,
        )
    except InvalidPremiumError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except InsufficientBalanceError as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))

    adapter = request.app.state.contract_adapter
    ref = await adapter.watch(policy_id=policy.id, flight_id=flight.id, condition=condition)
    await PolicyService(session).attach_contract_ref(policy, ref.id)
    await session.commit()
    return PolicyPublic(
        id=policy.id,
        flight_id=policy.flight_id,
        premium=policy.premium,
        payout=policy.payout,
        status=policy.status.value,
        contract_ref=policy.contract_ref,
        created_at=policy.created_at,
    )


@router.get("/policies", response_model=list[PolicyPublic])
async def list_policies(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[PolicyPublic]:
    policies = await PolicyService(session).get_user_policies(user.id)
    return [
        PolicyPublic(
            id=p.id,
            flight_id=p.flight_id,
            premium=p.premium,
            payout=p.payout,
            status=p.status.value,
            contract_ref=p.contract_ref,
            created_at=p.created_at,
        )
        for p in policies
    ]
