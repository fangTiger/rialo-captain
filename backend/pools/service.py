import json
import time
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import UserService
from backend.models import Claim, Flight, Policy, PolicyStatus, Pool, PoolEvent, PoolStatus, PresetStyle, User
from backend.ws.broadcaster import Broadcaster


SYSTEM_SIM_USER_ID = "system-sim-user"
SYSTEM_SIM_USER_GOOGLE_SUB = "system-sim-user"
SYSTEM_SIM_USER_EMAIL = "system-sim@rialo.local"
SYSTEM_SIM_USER_NAME = "Passenger Simulator"


class PoolConflictError(Exception):
    pass


@dataclass(frozen=True)
class PoolTimelineEvent:
    id: str
    pool_id: str
    event_type: str
    payload: dict[str, Any]
    created_at: int


@dataclass(frozen=True)
class ClosePoolResult:
    closed_at: int
    returned_ria: int


class PoolService:
    def __init__(
        self,
        session: AsyncSession,
        broadcaster: Broadcaster | None = None,
    ) -> None:
        self._session = session
        self._broadcaster = broadcaster

    async def open_pool(
        self,
        *,
        user: User,
        preset_style: PresetStyle,
        delay_threshold_min: int,
        payout_multiplier: float,
        stake_ria: int,
        include_hubs: bool,
        exclude_thunderstorm: bool,
        cover_red_eye: bool,
    ) -> Pool:
        existing = await self.get_active_pool(user.id)
        if existing is not None:
            raise PoolConflictError("active pool already exists")

        await UserService(self._session).debit(user, stake_ria)
        pool = Pool(
            user_id=user.id,
            preset_style=preset_style,
            delay_threshold_min=delay_threshold_min,
            payout_multiplier=payout_multiplier,
            stake_ria=stake_ria,
            balance=stake_ria,
            include_hubs=include_hubs,
            exclude_thunderstorm=exclude_thunderstorm,
            cover_red_eye=cover_red_eye,
            status=PoolStatus.ACTIVE,
        )
        self._session.add(pool)
        await self._session.flush()
        await self.record_event(
            pool.id,
            "pool.opened",
            {
                "pool_id": pool.id,
                "preset": pool.preset_style.value,
                "rule": self.rule_payload(pool),
                "stake_ria": stake_ria,
            },
        )
        return pool

    async def get_active_pool(self, user_id: str) -> Pool | None:
        return (
            await self._session.execute(
                select(Pool).where(Pool.user_id == user_id, Pool.status == PoolStatus.ACTIVE)
            )
        ).scalar_one_or_none()

    async def patch_pool_rule(
        self,
        *,
        pool: Pool,
        delay_threshold_min: int | None = None,
        payout_multiplier: float | None = None,
        include_hubs: bool | None = None,
        exclude_thunderstorm: bool | None = None,
        cover_red_eye: bool | None = None,
    ) -> Pool:
        if delay_threshold_min is not None:
            pool.delay_threshold_min = delay_threshold_min
        if payout_multiplier is not None:
            pool.payout_multiplier = payout_multiplier
        if include_hubs is not None:
            pool.include_hubs = include_hubs
        if exclude_thunderstorm is not None:
            pool.exclude_thunderstorm = exclude_thunderstorm
        if cover_red_eye is not None:
            pool.cover_red_eye = cover_red_eye
        await self._session.flush()
        await self.record_event(
            pool.id,
            "pool.rule_updated",
            {
                "pool_id": pool.id,
                "new_rule": self.rule_payload(pool),
            },
        )
        return pool

    async def close_pool(self, *, pool: Pool, reason: str) -> ClosePoolResult:
        if reason == "bankrupt":
            pool.status = PoolStatus.CLOSED_BANKRUPT
            returned_ria = 0
        elif reason == "user":
            pool.status = PoolStatus.CLOSED_BY_USER
            returned_ria = max(0, pool.balance)
            user = await self._session.get(User, pool.user_id)
            if user is not None and returned_ria:
                await UserService(self._session).credit(user, returned_ria)
            await self._unbind_active_policies(pool.id)
        else:
            raise ValueError("unsupported close reason")

        pool.closed_at = int(time.time())
        await self._session.flush()
        await self.record_event(
            pool.id,
            "pool.closed",
            {
                "pool_id": pool.id,
                "reason": reason,
                "final_pl": pool.balance - pool.stake_ria,
            },
        )
        return ClosePoolResult(closed_at=pool.closed_at, returned_ria=returned_ria)

    async def bind_policy_to_pool(self, *, pool: Pool, policy: Policy, flight: Flight) -> Pool:
        policy.underwriter_pool_id = pool.id
        pool.balance += policy.premium
        await self._session.flush()
        exposure_after = await self.exposure_for_pool(pool.id)
        await self.record_event(
            pool.id,
            "pool.policy_bound",
            {
                "pool_id": pool.id,
                "policy_id": policy.id,
                "flight_id": policy.flight_id,
                "callsign": flight.callsign,
                "premium": policy.premium,
                "exposure_after": exposure_after,
            },
        )
        return pool

    async def debit_claim_payout(
        self,
        *,
        pool: Pool,
        policy: Policy,
        claim: Claim,
        flight: Flight | None,
    ) -> Pool:
        pool.balance -= claim.payout
        await self._session.flush()
        await self.record_event(
            pool.id,
            "pool.claim_paid",
            {
                "pool_id": pool.id,
                "policy_id": policy.id,
                "claim_id": claim.id,
                "flight_id": policy.flight_id,
                "callsign": flight.callsign if flight is not None else "",
                "payout": claim.payout,
                "balance_after": pool.balance,
                "pl": pool.balance - pool.stake_ria,
            },
        )
        return pool

    async def exposure_for_pool(self, pool_id: str) -> int:
        value = (
            await self._session.execute(
                select(func.coalesce(func.sum(Policy.payout), 0)).where(
                    Policy.underwriter_pool_id == pool_id,
                    Policy.status == PolicyStatus.ACTIVE,
                )
            )
        ).scalar_one()
        return int(value)

    async def _unbind_active_policies(self, pool_id: str) -> None:
        policies = (
            await self._session.execute(
                select(Policy).where(
                    Policy.underwriter_pool_id == pool_id,
                    Policy.status == PolicyStatus.ACTIVE,
                )
            )
        ).scalars().all()
        for policy in policies:
            policy.underwriter_pool_id = None
        await self._session.flush()

    async def record_event(
        self,
        pool_id: str,
        event_type: str,
        payload: dict[str, Any],
    ) -> PoolEvent:
        event = PoolEvent(
            pool_id=pool_id,
            event_type=event_type,
            payload_json=json.dumps(payload),
        )
        self._session.add(event)
        await self._session.flush()
        if self._broadcaster is not None:
            await self._broadcaster.broadcast({"type": event_type, "payload": payload})
        return event

    async def list_timeline(self, pool_id: str, *, limit: int = 50) -> list[PoolTimelineEvent]:
        rows = (
            await self._session.execute(
                select(PoolEvent)
                .where(PoolEvent.pool_id == pool_id)
                .order_by(PoolEvent.created_at.desc(), PoolEvent.event_sequence.desc(), PoolEvent.id.desc())
                .limit(limit)
            )
        ).scalars().all()
        return [
            PoolTimelineEvent(
                id=row.id,
                pool_id=row.pool_id,
                event_type=row.event_type,
                payload=self._payload(row.payload_json),
                created_at=row.created_at,
            )
            for row in rows
        ]

    @staticmethod
    def rule_payload(pool: Pool) -> dict[str, Any]:
        return {
            "delay_threshold_min": pool.delay_threshold_min,
            "payout_multiplier": pool.payout_multiplier,
            "include_hubs": pool.include_hubs,
            "exclude_thunderstorm": pool.exclude_thunderstorm,
            "cover_red_eye": pool.cover_red_eye,
        }

    @staticmethod
    def _payload(payload_json: str) -> dict[str, Any]:
        try:
            value = json.loads(payload_json or "{}")
        except json.JSONDecodeError:
            return {}
        return value if isinstance(value, dict) else {}


async def ensure_system_sim_user(session: AsyncSession) -> User:
    existing = (
        await session.execute(select(User).where(User.google_sub == SYSTEM_SIM_USER_GOOGLE_SUB))
    ).scalar_one_or_none()
    if existing is not None:
        existing.email = SYSTEM_SIM_USER_EMAIL
        existing.name = SYSTEM_SIM_USER_NAME
        existing.avatar_url = ""
        existing.balance = 0
        existing.is_system = True
        await session.flush()
        return existing

    user = User(
        id=SYSTEM_SIM_USER_ID,
        google_sub=SYSTEM_SIM_USER_GOOGLE_SUB,
        email=SYSTEM_SIM_USER_EMAIL,
        name=SYSTEM_SIM_USER_NAME,
        avatar_url="",
        balance=0,
        is_system=True,
    )
    session.add(user)
    await session.flush()
    return user
