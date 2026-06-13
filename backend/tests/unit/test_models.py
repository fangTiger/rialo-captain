import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Claim, Policy, PolicyStatus
from backend.tests.factories import make_user, make_flight


@pytest.mark.asyncio
async def test_user_default_balance_is_1000(db_session: AsyncSession):
    user = await make_user(db_session, email="alice@example.com")
    assert user.balance == 1000
    assert user.google_sub.startswith("sub-")


@pytest.mark.asyncio
async def test_flight_id_format(db_session: AsyncSession):
    flight = await make_flight(db_session, callsign="BA178", date="20260613")
    assert flight.id == "BA178-20260613"
    assert flight.origin == "LHR"


@pytest.mark.asyncio
async def test_policy_links_user_and_flight(db_session: AsyncSession):
    user = await make_user(db_session)
    flight = await make_flight(db_session)
    policy = Policy(
        id="pol-1",
        user_id=user.id,
        flight_id=flight.id,
        premium=10,
        payout=40,
        condition_json='{"type":"delay","threshold_min":30}',
        status=PolicyStatus.ACTIVE,
    )
    db_session.add(policy)
    await db_session.flush()
    assert policy.created_at is not None


@pytest.mark.asyncio
async def test_claim_signature_required(db_session: AsyncSession):
    user = await make_user(db_session)
    flight = await make_flight(db_session)
    policy = Policy(
        id="pol-2", user_id=user.id, flight_id=flight.id,
        premium=5, payout=20, condition_json="{}", status=PolicyStatus.ACTIVE,
    )
    db_session.add(policy)
    await db_session.flush()
    claim = Claim(
        id="clm-1", policy_id=policy.id, payout=20,
        delay_minutes=45, signature="0x" + "a" * 64, settle_duration_ms=1400,
    )
    db_session.add(claim)
    await db_session.flush()
    assert claim.settled_at is not None
