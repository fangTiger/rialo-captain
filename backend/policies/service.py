import json
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import UserService
from backend.contracts.base import Condition
from backend.models import Policy, PolicyStatus, User


ALLOWED_PREMIUMS = (5, 10, 20)


class InvalidPremiumError(Exception):
    pass


def payout_multiplier_for_rate(delay_rate: float) -> float:
    """低延误率对应高赔付倍率，低概率事件赔得更多。"""
    if delay_rate <= 0.05:
        return 8.0
    if delay_rate >= 0.40:
        return 2.5
    span = 0.40 - 0.05
    progress = (delay_rate - 0.05) / span
    return 8.0 + progress * (2.5 - 8.0)


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

    async def list_active(self) -> Sequence[Policy]:
        stmt = select(Policy).where(Policy.status == PolicyStatus.ACTIVE)
        return (await self._session.execute(stmt)).scalars().all()

    async def mark_paid(self, policy: Policy) -> None:
        policy.status = PolicyStatus.PAID
        await self._session.flush()
