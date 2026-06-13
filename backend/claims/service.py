from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import UserService
from backend.models import Claim, Policy, PolicyStatus, User


class ClaimsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_claim(
        self,
        *,
        policy: Policy,
        payout: int,
        delay_minutes: int,
        signature: str,
        settle_duration_ms: int,
    ) -> Claim:
        # 给用户加余额。
        user = (await self._session.execute(select(User).where(User.id == policy.user_id))).scalar_one()
        await UserService(self._session).credit(user, payout)

        claim = Claim(
            policy_id=policy.id,
            payout=payout,
            delay_minutes=delay_minutes,
            signature=signature,
            settle_duration_ms=settle_duration_ms,
        )
        self._session.add(claim)
        policy.status = PolicyStatus.PAID
        await self._session.flush()
        return claim

    async def recent(self, limit: int = 50) -> Sequence[Claim]:
        stmt = select(Claim).order_by(Claim.settled_at.desc(), Claim.id.desc()).limit(limit)
        return (await self._session.execute(stmt)).scalars().all()
