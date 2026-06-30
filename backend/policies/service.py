import json
from dataclasses import dataclass
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import UserService
from backend.contracts.base import Condition
from backend.flights.service import live_delay_minutes_for_flight
from backend.models import Flight, Policy, PolicyStatus, User


ALLOWED_PREMIUMS = (5, 10, 20)
DEFAULT_DELAY_THRESHOLD_MINUTES = 30
WATCH_WINDOW_MINUTES = 10


class InvalidPremiumError(Exception):
    pass


@dataclass(frozen=True)
class PolicyRiskProjection:
    delay_threshold_minutes: int
    live_delay_minutes: int | None
    minutes_until_trigger: int | None
    risk_level: str
    risk_reason: str


@dataclass(frozen=True)
class PolicyWithProjection:
    policy: Policy
    projection: PolicyRiskProjection


def payout_multiplier_for_rate(delay_rate: float) -> float:
    """低延误率对应高赔付倍率，低概率事件赔得更多。"""
    if delay_rate <= 0.05:
        return 8.0
    if delay_rate >= 0.40:
        return 2.5
    span = 0.40 - 0.05
    progress = (delay_rate - 0.05) / span
    return 8.0 + progress * (2.5 - 8.0)


def _policy_delay_threshold_minutes(policy: Policy) -> int:
    try:
        payload = json.loads(policy.condition_json or "{}")
    except json.JSONDecodeError:
        return DEFAULT_DELAY_THRESHOLD_MINUTES

    value = payload.get("threshold_min") if isinstance(payload, dict) else None
    if isinstance(value, bool):
        return DEFAULT_DELAY_THRESHOLD_MINUTES
    if isinstance(value, int) and value > 0:
        return value
    if isinstance(value, float) and value.is_integer() and value > 0:
        return int(value)
    return DEFAULT_DELAY_THRESHOLD_MINUTES


def build_policy_risk_projection(policy: Policy, flight: Flight | None) -> PolicyRiskProjection:
    threshold = _policy_delay_threshold_minutes(policy)
    live_delay_minutes = live_delay_minutes_for_flight(flight) if flight is not None else None

    if policy.status == PolicyStatus.PAID:
        return PolicyRiskProjection(
            delay_threshold_minutes=threshold,
            live_delay_minutes=live_delay_minutes,
            minutes_until_trigger=None,
            risk_level="settled",
            risk_reason="policy already settled",
        )
    if policy.status == PolicyStatus.EXPIRED:
        return PolicyRiskProjection(
            delay_threshold_minutes=threshold,
            live_delay_minutes=live_delay_minutes,
            minutes_until_trigger=None,
            risk_level="inactive",
            risk_reason="policy is no longer active",
        )
    if live_delay_minutes is None:
        return PolicyRiskProjection(
            delay_threshold_minutes=threshold,
            live_delay_minutes=None,
            minutes_until_trigger=None,
            risk_level="unknown",
            risk_reason="live delay unavailable",
        )

    minutes_until_trigger = max(0, threshold - live_delay_minutes)
    if live_delay_minutes >= threshold:
        return PolicyRiskProjection(
            delay_threshold_minutes=threshold,
            live_delay_minutes=live_delay_minutes,
            minutes_until_trigger=0,
            risk_level="triggered",
            risk_reason="delay threshold reached",
        )
    if live_delay_minutes >= max(0, threshold - WATCH_WINDOW_MINUTES):
        return PolicyRiskProjection(
            delay_threshold_minutes=threshold,
            live_delay_minutes=live_delay_minutes,
            minutes_until_trigger=minutes_until_trigger,
            risk_level="watch",
            risk_reason="delay approaching threshold",
        )
    return PolicyRiskProjection(
        delay_threshold_minutes=threshold,
        live_delay_minutes=live_delay_minutes,
        minutes_until_trigger=minutes_until_trigger,
        risk_level="normal",
        risk_reason="delay below watch window",
    )


class PolicyService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_policy(
        self,
        *,
        user: User,
        flight_id: str,
        premium: int,
        condition: Condition,
        delay_rate: float,
    ) -> Policy:
        if premium not in ALLOWED_PREMIUMS:
            raise InvalidPremiumError(f"premium must be one of {ALLOWED_PREMIUMS}, got {premium}")

        multiplier = payout_multiplier_for_rate(delay_rate)
        payout = int(round(premium * multiplier))

        await UserService(self._session).debit(user, premium)

        policy = Policy(
            user_id=user.id,
            flight_id=flight_id,
            premium=premium,
            payout=payout,
            condition_json=json.dumps(
                {
                    "type": condition.type.value,
                    "threshold_min": condition.threshold_min,
                }
            ),
            status=PolicyStatus.ACTIVE,
        )
        self._session.add(policy)
        await self._session.flush()
        return policy

    async def attach_contract_ref(self, policy: Policy, contract_ref_id: str) -> None:
        policy.contract_ref = contract_ref_id
        await self._session.flush()

    async def get_user_policies(self, user_id: str) -> Sequence[Policy]:
        stmt = select(Policy).where(Policy.user_id == user_id).order_by(Policy.created_at.desc())
        return (await self._session.execute(stmt)).scalars().all()

    async def get_user_policy_views(self, user_id: str) -> Sequence[PolicyWithProjection]:
        policies = list(await self.get_user_policies(user_id))
        flights_by_id = await self._flights_by_ids({policy.flight_id for policy in policies})
        return [
            PolicyWithProjection(
                policy=policy,
                projection=build_policy_risk_projection(policy, flights_by_id.get(policy.flight_id)),
            )
            for policy in policies
        ]

    async def list_active(self) -> Sequence[Policy]:
        stmt = select(Policy).where(Policy.status == PolicyStatus.ACTIVE)
        return (await self._session.execute(stmt)).scalars().all()

    async def mark_paid(self, policy: Policy) -> None:
        policy.status = PolicyStatus.PAID
        await self._session.flush()

    async def _flights_by_ids(self, flight_ids: set[str]) -> dict[str, Flight]:
        if not flight_ids:
            return {}
        stmt = select(Flight).where(Flight.id.in_(flight_ids))
        flights = (await self._session.execute(stmt)).scalars().all()
        return {flight.id: flight for flight in flights}
