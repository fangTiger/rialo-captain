import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.google import GoogleProfile
from backend.auth.service import InsufficientBalanceError, UserService
from backend.contracts.base import Condition, ConditionType
from backend.policies.service import (
    InvalidPremiumError,
    PolicyService,
    payout_multiplier_for_rate,
)
from backend.tests.factories import make_flight


def test_payout_multiplier_high_rate_low_multiplier():
    assert payout_multiplier_for_rate(0.50) == 2.5
    assert payout_multiplier_for_rate(0.40) == 2.5


def test_payout_multiplier_low_rate_high_multiplier():
    assert payout_multiplier_for_rate(0.04) == 8.0
    assert payout_multiplier_for_rate(0.0) == 8.0


def test_payout_multiplier_middle_band():
    m_mid = payout_multiplier_for_rate(0.225)
    assert 2.5 < m_mid < 8.0


@pytest.mark.asyncio
async def test_create_policy_charges_premium_and_writes_record(db_session: AsyncSession):
    users = UserService(db_session)
    user = await users.create_or_get(GoogleProfile(sub="s", email="e@x", name="n", avatar_url=""))
    flight = await make_flight(db_session, callsign="BA178", date="20260614")
    service = PolicyService(db_session)
    policy = await service.create_policy(
        user=user,
        flight_id=flight.id,
        premium=10,
        condition=Condition(type=ConditionType.DELAY, threshold_min=30),
        delay_rate=0.0,
    )
    assert policy.premium == 10
    assert policy.payout == 80  # 8x * 10
    assert user.balance == 990


@pytest.mark.asyncio
async def test_create_policy_rejects_invalid_premium_tier(db_session: AsyncSession):
    users = UserService(db_session)
    user = await users.create_or_get(GoogleProfile(sub="s2", email="e@x", name="n", avatar_url=""))
    flight = await make_flight(db_session, callsign="BA178", date="20260614")
    service = PolicyService(db_session)
    with pytest.raises(InvalidPremiumError):
        await service.create_policy(
            user=user,
            flight_id=flight.id,
            premium=7,
            condition=Condition(type=ConditionType.DELAY, threshold_min=30),
            delay_rate=0.1,
        )


@pytest.mark.asyncio
async def test_create_policy_rejects_when_balance_insufficient(db_session: AsyncSession):
    users = UserService(db_session)
    user = await users.create_or_get(GoogleProfile(sub="s3", email="e@x", name="n", avatar_url=""))
    user.balance = 3
    await db_session.flush()
    flight = await make_flight(db_session, callsign="BA178", date="20260614")
    service = PolicyService(db_session)
    with pytest.raises(InsufficientBalanceError):
        await service.create_policy(
            user=user,
            flight_id=flight.id,
            premium=5,
            condition=Condition(type=ConditionType.DELAY, threshold_min=30),
            delay_rate=0.0,
        )
    assert user.balance == 3
