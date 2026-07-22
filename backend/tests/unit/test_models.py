import pytest
from sqlalchemy import BigInteger, inspect
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Claim, Policy, PolicyEvent, PolicyStatus, Pool, PoolEvent, PoolStatus, PresetStyle
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


@pytest.mark.asyncio
async def test_pool_model_defaults_and_policy_pool_link(db_session: AsyncSession):
    user = await make_user(db_session)
    flight = await make_flight(db_session)
    pool = Pool(
        id="pool-1",
        user_id=user.id,
        preset_style=PresetStyle.STEADY,
        delay_threshold_min=30,
        payout_multiplier=3.0,
        stake_ria=200,
        balance=200,
        include_hubs=True,
        exclude_thunderstorm=True,
        cover_red_eye=False,
        status=PoolStatus.ACTIVE,
    )
    db_session.add(pool)
    policy = Policy(
        id="pol-pool-1",
        user_id=user.id,
        flight_id=flight.id,
        premium=10,
        payout=40,
        condition_json='{"type":"delay","threshold_min":30}',
        status=PolicyStatus.ACTIVE,
        underwriter_pool_id=pool.id,
    )
    db_session.add(policy)
    await db_session.flush()

    assert pool.created_at is not None
    assert pool.closed_at == 0
    assert policy.underwriter_pool_id == pool.id


def test_pool_active_per_user_partial_unique_index_exists():
    indexes = {index.name: index for index in Pool.__table__.indexes}

    active_index = indexes["ix_pools_active_per_user"]
    assert [column.name for column in active_index.columns] == ["user_id"]
    assert active_index.unique is True
    assert "status = 'active'" in str(active_index.dialect_options["sqlite"]["where"])
    assert "status = 'active'" in str(active_index.dialect_options["postgresql"]["where"])


def test_policy_table_exposes_underwriter_pool_foreign_key():
    columns = inspect(Policy).columns

    assert "underwriter_pool_id" in columns
    foreign_keys = columns.underwriter_pool_id.foreign_keys
    assert {key.column.table.name for key in foreign_keys} == {"pools"}


def test_event_sequence_columns_are_big_integer_for_nanosecond_ordering():
    assert isinstance(PolicyEvent.__table__.c.event_sequence.type, BigInteger)
    assert isinstance(PoolEvent.__table__.c.event_sequence.type, BigInteger)
