import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.google import GoogleProfile
from backend.auth.service import InsufficientBalanceError, UserService


@pytest.mark.asyncio
async def test_create_user_on_first_login(db_session: AsyncSession):
    service = UserService(db_session)
    profile = GoogleProfile(sub="sub-001", email="a@x.com", name="A", avatar_url="https://a")
    user = await service.create_or_get(profile)
    assert user.balance == 1000
    assert user.google_sub == "sub-001"


@pytest.mark.asyncio
async def test_returning_user_keeps_balance(db_session: AsyncSession):
    service = UserService(db_session)
    profile = GoogleProfile(sub="sub-002", email="b@x.com", name="B", avatar_url="")
    first = await service.create_or_get(profile)
    first.balance = 250
    await db_session.flush()
    second = await service.create_or_get(profile)
    assert second.id == first.id
    assert second.balance == 250


@pytest.mark.asyncio
async def test_debit_decreases_balance(db_session: AsyncSession):
    service = UserService(db_session)
    user = await service.create_or_get(
        GoogleProfile(sub="sub-003", email="c@x.com", name="C", avatar_url="")
    )
    await service.debit(user, 30)
    assert user.balance == 970


@pytest.mark.asyncio
async def test_debit_rejects_insufficient_balance(db_session: AsyncSession):
    service = UserService(db_session)
    user = await service.create_or_get(
        GoogleProfile(sub="sub-004", email="d@x.com", name="D", avatar_url="")
    )
    user.balance = 5
    with pytest.raises(InsufficientBalanceError):
        await service.debit(user, 10)
    assert user.balance == 5


@pytest.mark.asyncio
async def test_credit_increases_balance(db_session: AsyncSession):
    service = UserService(db_session)
    user = await service.create_or_get(
        GoogleProfile(sub="sub-005", email="e@x.com", name="E", avatar_url="")
    )
    await service.credit(user, 50)
    assert user.balance == 1050
