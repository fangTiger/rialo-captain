from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.google import GoogleProfile
from backend.models import User


class InsufficientBalanceError(Exception):
    pass


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_or_get(self, profile: GoogleProfile) -> User:
        stmt = select(User).where(User.google_sub == profile.sub)
        existing = (await self._session.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            existing.email = profile.email
            existing.name = profile.name
            if profile.avatar_url:
                existing.avatar_url = profile.avatar_url
            await self._session.flush()
            return existing

        user = User(
            google_sub=profile.sub,
            email=profile.email,
            name=profile.name,
            avatar_url=profile.avatar_url,
        )
        self._session.add(user)
        await self._session.flush()
        return user

    async def get_by_id(self, user_id: str) -> User | None:
        stmt = select(User).where(User.id == user_id)
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def debit(self, user: User, amount: int) -> None:
        if user.balance < amount:
            raise InsufficientBalanceError(f"need {amount}, have {user.balance}")
        user.balance -= amount
        await self._session.flush()

    async def credit(self, user: User, amount: int) -> None:
        user.balance += amount
        await self._session.flush()
