import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Policy, PolicyStatus, PoolStatus, PresetStyle
from backend.pools.service import PoolConflictError, PoolService
from backend.tests.factories import make_flight, make_user


@pytest.mark.asyncio
async def test_open_pool_debits_stake_and_records_opened_event(db_session: AsyncSession):
    user = await make_user(db_session, balance=1000)

    pool = await PoolService(db_session).open_pool(
        user=user,
        preset_style=PresetStyle.STEADY,
        delay_threshold_min=30,
        payout_multiplier=3.0,
        stake_ria=200,
        include_hubs=True,
        exclude_thunderstorm=True,
        cover_red_eye=False,
    )
    events = await PoolService(db_session).list_timeline(pool.id)

    assert user.balance == 800
    assert pool.status == PoolStatus.ACTIVE
    assert pool.balance == 200
    assert pool.stake_ria == 200
    assert events[0].event_type == "pool.opened"
    assert events[0].payload["stake_ria"] == 200


@pytest.mark.asyncio
async def test_open_pool_rejects_second_active_pool(db_session: AsyncSession):
    user = await make_user(db_session, balance=1000)
    service = PoolService(db_session)
    await service.open_pool(
        user=user,
        preset_style=PresetStyle.STEADY,
        delay_threshold_min=30,
        payout_multiplier=3.0,
        stake_ria=200,
        include_hubs=True,
        exclude_thunderstorm=True,
        cover_red_eye=False,
    )

    with pytest.raises(PoolConflictError):
        await service.open_pool(
            user=user,
            preset_style=PresetStyle.STORM,
            delay_threshold_min=30,
            payout_multiplier=5.0,
            stake_ria=200,
            include_hubs=True,
            exclude_thunderstorm=False,
            cover_red_eye=True,
        )

    assert user.balance == 800


@pytest.mark.asyncio
async def test_patch_pool_rule_does_not_change_stake_or_unbind_existing_policy(
    db_session: AsyncSession,
):
    user = await make_user(db_session, balance=1000)
    flight = await make_flight(db_session, origin="SFO", destination="LAX")
    service = PoolService(db_session)
    pool = await service.open_pool(
        user=user,
        preset_style=PresetStyle.STEADY,
        delay_threshold_min=30,
        payout_multiplier=3.0,
        stake_ria=200,
        include_hubs=True,
        exclude_thunderstorm=True,
        cover_red_eye=False,
    )
    policy = Policy(
        id="policy-bound",
        user_id=user.id,
        flight_id=flight.id,
        underwriter_pool_id=pool.id,
        premium=10,
        payout=30,
        condition_json='{"type":"delay","threshold_min":30}',
        status=PolicyStatus.ACTIVE,
    )
    db_session.add(policy)
    await db_session.flush()

    updated = await service.patch_pool_rule(
        pool=pool,
        delay_threshold_min=45,
        payout_multiplier=5.0,
        include_hubs=False,
        exclude_thunderstorm=False,
        cover_red_eye=True,
    )

    assert updated.delay_threshold_min == 45
    assert updated.payout_multiplier == 5.0
    assert updated.include_hubs is False
    assert updated.stake_ria == 200
    assert updated.balance == 200
    assert policy.underwriter_pool_id == pool.id


@pytest.mark.asyncio
async def test_patch_pool_rule_records_rule_updated_event(db_session: AsyncSession):
    user = await make_user(db_session, balance=1000)
    service = PoolService(db_session)
    pool = await service.open_pool(
        user=user,
        preset_style=PresetStyle.STEADY,
        delay_threshold_min=30,
        payout_multiplier=3.0,
        stake_ria=200,
        include_hubs=True,
        exclude_thunderstorm=True,
        cover_red_eye=False,
    )

    await service.patch_pool_rule(
        pool=pool,
        delay_threshold_min=45,
        payout_multiplier=4.0,
    )
    events = await service.list_timeline(pool.id)

    assert events[0].event_type == "pool.rule_updated"
    assert events[0].payload["pool_id"] == pool.id
    assert events[0].payload["new_rule"]["delay_threshold_min"] == 45
    assert events[0].payload["new_rule"]["payout_multiplier"] == 4.0


@pytest.mark.asyncio
async def test_close_pool_by_user_returns_balance_and_unbinds_active_policy(
    db_session: AsyncSession,
):
    user = await make_user(db_session, balance=1000)
    flight = await make_flight(db_session, callsign="UA100", origin="SFO", destination="JFK")
    service = PoolService(db_session)
    pool = await service.open_pool(
        user=user,
        preset_style=PresetStyle.STEADY,
        delay_threshold_min=30,
        payout_multiplier=3.0,
        stake_ria=200,
        include_hubs=True,
        exclude_thunderstorm=True,
        cover_red_eye=False,
    )
    pool.balance = 230
    policy = Policy(
        id="policy-close",
        user_id=user.id,
        flight_id=flight.id,
        underwriter_pool_id=pool.id,
        premium=10,
        payout=30,
        condition_json='{"type":"delay","threshold_min":30}',
        status=PolicyStatus.ACTIVE,
    )
    db_session.add(policy)
    await db_session.flush()

    result = await service.close_pool(pool=pool, reason="user")
    events = await service.list_timeline(pool.id)

    assert result.returned_ria == 230
    assert user.balance == 1030
    assert pool.status == PoolStatus.CLOSED_BY_USER
    assert pool.closed_at > 0
    assert policy.underwriter_pool_id is None
    assert events[0].event_type == "pool.closed"
    assert events[0].payload["reason"] == "user"


@pytest.mark.asyncio
async def test_close_pool_bankrupt_keeps_bound_policy_and_allows_negative_balance(
    db_session: AsyncSession,
):
    user = await make_user(db_session, balance=1000)
    flight = await make_flight(db_session, callsign="UA101", origin="SFO", destination="JFK")
    service = PoolService(db_session)
    pool = await service.open_pool(
        user=user,
        preset_style=PresetStyle.STEADY,
        delay_threshold_min=30,
        payout_multiplier=3.0,
        stake_ria=200,
        include_hubs=True,
        exclude_thunderstorm=True,
        cover_red_eye=False,
    )
    pool.balance = -25
    policy = Policy(
        id="policy-bankrupt",
        user_id=user.id,
        flight_id=flight.id,
        underwriter_pool_id=pool.id,
        premium=10,
        payout=30,
        condition_json='{"type":"delay","threshold_min":30}',
        status=PolicyStatus.ACTIVE,
    )
    db_session.add(policy)
    await db_session.flush()

    result = await service.close_pool(pool=pool, reason="bankrupt")
    events = await service.list_timeline(pool.id)

    assert result.returned_ria == 0
    assert user.balance == 800
    assert pool.status == PoolStatus.CLOSED_BANKRUPT
    assert pool.balance == -25
    assert policy.underwriter_pool_id == pool.id
    assert events[0].payload["reason"] == "bankrupt"


@pytest.mark.asyncio
async def test_bind_policy_to_pool_adds_premium_and_records_event(
    db_session: AsyncSession,
):
    user = await make_user(db_session, balance=1000)
    flight = await make_flight(db_session, callsign="UA102", origin="SFO", destination="JFK")
    service = PoolService(db_session)
    pool = await service.open_pool(
        user=user,
        preset_style=PresetStyle.STEADY,
        delay_threshold_min=30,
        payout_multiplier=3.0,
        stake_ria=200,
        include_hubs=True,
        exclude_thunderstorm=True,
        cover_red_eye=False,
    )
    policy = Policy(
        id="policy-bind",
        user_id=user.id,
        flight_id=flight.id,
        premium=10,
        payout=30,
        condition_json='{"type":"delay","threshold_min":30}',
        status=PolicyStatus.ACTIVE,
    )
    db_session.add(policy)
    await db_session.flush()

    await service.bind_policy_to_pool(pool=pool, policy=policy, flight=flight)
    events = await service.list_timeline(pool.id)

    assert policy.underwriter_pool_id == pool.id
    assert pool.balance == 210
    assert events[0].event_type == "pool.policy_bound"
    assert events[0].payload["policy_id"] == policy.id
    assert events[0].payload["flight_id"] == flight.id
    assert events[0].payload["callsign"] == "UA102"
    assert events[0].payload["premium"] == 10
    assert events[0].payload["exposure_after"] == 30
