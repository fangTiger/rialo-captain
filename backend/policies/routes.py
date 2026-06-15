import json
from collections.abc import Iterable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import CurrentUser
from backend.auth.service import InsufficientBalanceError
from backend.contracts.base import Condition, ConditionType
from backend.db import get_session
from backend.flights.service import FlightService
from backend.flights.opensky import FlightState
from backend.models import Flight, Policy
from backend.policies.schemas import CreatePolicyRequest, PolicyPublic
from backend.policies.service import InvalidPremiumError, PolicyService
from backend.ws.broadcaster import EventType


router = APIRouter()


def _valid_coordinate(longitude: object, latitude: object) -> tuple[float, float] | None:
    if not isinstance(longitude, int | float) or not isinstance(latitude, int | float):
        return None
    if not (-180 <= float(longitude) <= 180 and -90 <= float(latitude) <= 90):
        return None
    return float(longitude), float(latitude)


def _coordinates_from_cache(
    flight: Flight,
    cached_states: Iterable[FlightState],
) -> tuple[float, float] | None:
    for state in cached_states:
        if state.callsign.strip() != flight.callsign:
            continue
        coordinate = _valid_coordinate(state.longitude, state.latitude)
        if coordinate is not None:
            return coordinate
    return None


def _coordinates_from_last_state(flight: Flight) -> tuple[float, float] | None:
    try:
        state = json.loads(flight.last_state or "{}")
    except json.JSONDecodeError:
        return None
    if not isinstance(state, dict):
        return None
    return _valid_coordinate(state.get("longitude"), state.get("latitude"))


def _policy_created_payload(
    policy: Policy,
    flight: Flight,
    *,
    cached_states: Iterable[FlightState] = (),
) -> dict:
    payload = {
        "policy_id": policy.id,
        "flight_id": policy.flight_id,
        "source": "real",
        "created_at": policy.created_at,
        "callsign": flight.callsign,
    }
    coordinate = _coordinates_from_cache(flight, cached_states) or _coordinates_from_last_state(flight)
    if coordinate is not None:
        payload["longitude"], payload["latitude"] = coordinate
    return payload


async def _broadcast_policy_created(request: Request, payload: dict) -> None:
    broadcaster = getattr(request.app.state, "broadcaster", None)
    if broadcaster is None:
        return
    await broadcaster.broadcast(
        {
            "type": EventType.POLICY_CREATED.value,
            "payload": payload,
        }
    )


def _cached_flight_states(request: Request) -> Iterable[FlightState]:
    flight_cache = getattr(request.app.state, "flight_cache", None)
    if flight_cache is None:
        return ()
    return flight_cache.get().states


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
    await _broadcast_policy_created(
        request,
        _policy_created_payload(
            policy,
            flight,
            cached_states=_cached_flight_states(request),
        ),
    )
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
