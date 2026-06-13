import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.google import GoogleProfile
from backend.auth.service import UserService
from backend.claims.service import ClaimsService
from backend.models import Policy, PolicyStatus
from backend.tests.factories import make_flight


@pytest.mark.asyncio
async def test_create_claim_credits_user_and_marks_policy_paid(db_session: AsyncSession):
    users = UserService(db_session)
    user = await users.create_or_get(GoogleProfile(sub="s", email="e@x", name="n", avatar_url=""))
    flight = await make_flight(db_session, callsign="BA178", date="20260614")
    policy = Policy(
        user_id=user.id,
        flight_id=flight.id,
        premium=10,
        payout=80,
        condition_json="{}",
        status=PolicyStatus.ACTIVE,
    )
    db_session.add(policy)
    await db_session.flush()
    initial_balance = user.balance

    service = ClaimsService(db_session)
    claim = await service.create_claim(
        policy=policy,
        payout=policy.payout,
        delay_minutes=45,
        signature="0x" + "a" * 64,
        settle_duration_ms=1234,
    )
    assert claim.payout == 80
    assert claim.signature.startswith("0x")
    assert claim.settle_duration_ms == 1234
    assert user.balance == initial_balance + 80
    assert policy.status == PolicyStatus.PAID


@pytest.mark.asyncio
async def test_recent_claims_returns_at_most_limit(db_session: AsyncSession):
    users = UserService(db_session)
    user = await users.create_or_get(GoogleProfile(sub="s2", email="e@x", name="n", avatar_url=""))
    flight = await make_flight(db_session, callsign="BA178", date="20260614")

    service = ClaimsService(db_session)
    for i in range(3):
        policy = Policy(
            user_id=user.id,
            flight_id=flight.id,
            premium=10,
            payout=20,
            condition_json="{}",
            status=PolicyStatus.ACTIVE,
        )
        db_session.add(policy)
        await db_session.flush()
        await service.create_claim(
            policy=policy,
            payout=20,
            delay_minutes=30 + i,
            signature=f"0x{'a' * 63}{i}",
            settle_duration_ms=100 + i,
        )

    items = await service.recent(limit=10)
    assert len(items) == 3
