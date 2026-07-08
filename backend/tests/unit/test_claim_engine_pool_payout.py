import json

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.claims.engine import ClaimEngine
from backend.contracts.base import ClaimPayload, ContractRef, ReactiveContractAdapter, TxResult
from backend.models import Policy, PolicyStatus, Pool, PoolStatus, PresetStyle
from backend.pools.service import PoolService, ensure_system_sim_user
from backend.tests.factories import make_flight, make_user


class FakeAdapter(ReactiveContractAdapter):
    async def watch(self, policy_id, flight_id, condition):
        return ContractRef(id=f"mock-{policy_id}", mode="mock")

    async def fetch_external(self, url: str) -> dict:
        return {"delay_minutes": 45, "source": "test"}

    async def trigger_claim(self, contract_ref, payload: ClaimPayload):
        return TxResult(signature="0x" + "a" * 64, settle_duration_ms=42)

    async def get_signature(self, tx):
        return tx.signature


def _session_factory(db_session: AsyncSession):
    return async_sessionmaker(db_session.bind, expire_on_commit=False)


class RecordingBroadcaster:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def broadcast(self, message: dict) -> None:
        self.messages.append(message)

    async def send_to_user(self, user_id: str, message: dict) -> None:
        self.messages.append({"user_id": user_id, **message})


@pytest.mark.asyncio
async def test_bound_policy_payout_debits_pool_not_system_user(db_session: AsyncSession):
    underwriter = await make_user(db_session, email="uw@example.com", balance=1000)
    flight = await make_flight(db_session, callsign="POOL1", origin="SFO", destination="JFK")
    pool = await PoolService(db_session).open_pool(
        user=underwriter,
        preset_style=PresetStyle.STEADY,
        delay_threshold_min=30,
        payout_multiplier=3.0,
        stake_ria=200,
        include_hubs=True,
        exclude_thunderstorm=True,
        cover_red_eye=False,
    )
    system_user = await ensure_system_sim_user(db_session)
    policy = Policy(
        user_id=system_user.id,
        flight_id=flight.id,
        underwriter_pool_id=pool.id,
        premium=10,
        payout=30,
        condition_json=json.dumps({"type": "delay", "threshold_min": 30}),
        status=PolicyStatus.ACTIVE,
        contract_ref="mock-bound-policy",
    )
    db_session.add(policy)
    await db_session.commit()

    engine = ClaimEngine(
        adapter=FakeAdapter(),
        session_factory=_session_factory(db_session),
        now=lambda: 1_700_000_000,
    )

    summary = await engine.run_once()

    async with _session_factory(db_session)() as session:
        pool_after = await session.get(Pool, pool.id)
        system_after = await session.get(type(system_user), system_user.id)
        policy_after = await session.get(Policy, policy.id)

    assert summary.triggered == 1
    assert pool_after.balance == 170
    assert system_after.balance == 0
    assert policy_after.status == PolicyStatus.PAID


@pytest.mark.asyncio
async def test_bound_policy_broadcasts_pool_claim_paid_and_settled_pool_id(
    db_session: AsyncSession,
):
    underwriter = await make_user(db_session, email="uw-ws@example.com", balance=1000)
    flight = await make_flight(db_session, callsign="POOLWS", origin="SFO", destination="JFK")
    pool = await PoolService(db_session).open_pool(
        user=underwriter,
        preset_style=PresetStyle.STEADY,
        delay_threshold_min=30,
        payout_multiplier=3.0,
        stake_ria=200,
        include_hubs=True,
        exclude_thunderstorm=True,
        cover_red_eye=False,
    )
    system_user = await ensure_system_sim_user(db_session)
    policy = Policy(
        user_id=system_user.id,
        flight_id=flight.id,
        underwriter_pool_id=pool.id,
        premium=10,
        payout=30,
        condition_json=json.dumps({"type": "delay", "threshold_min": 30}),
        status=PolicyStatus.ACTIVE,
        contract_ref="mock-bound-ws",
    )
    db_session.add(policy)
    await db_session.commit()
    broadcaster = RecordingBroadcaster()
    engine = ClaimEngine(
        adapter=FakeAdapter(),
        session_factory=_session_factory(db_session),
        broadcaster=broadcaster,
        now=lambda: 1_700_000_000,
    )

    await engine.run_once()

    pool_paid = next(message for message in broadcaster.messages if message["type"] == "pool.claim_paid")
    settled = next(message for message in broadcaster.messages if message["type"] == "claim.settled")
    assert pool_paid["payload"]["pool_id"] == pool.id
    assert pool_paid["payload"]["policy_id"] == policy.id
    assert pool_paid["payload"]["flight_id"] == flight.id
    assert pool_paid["payload"]["callsign"] == "POOLWS"
    assert pool_paid["payload"]["payout"] == 30
    assert pool_paid["payload"]["balance_after"] == 170
    assert settled["payload"]["pool_id"] == pool.id


@pytest.mark.asyncio
async def test_pool_closes_bankrupt_after_tick_allows_negative_balance(
    db_session: AsyncSession,
):
    underwriter = await make_user(db_session, email="uw2@example.com", balance=1000)
    flight_a = await make_flight(db_session, callsign="POOL2", origin="SFO", destination="JFK")
    flight_b = await make_flight(db_session, callsign="POOL3", origin="SFO", destination="LAX")
    pool = await PoolService(db_session).open_pool(
        user=underwriter,
        preset_style=PresetStyle.STEADY,
        delay_threshold_min=30,
        payout_multiplier=3.0,
        stake_ria=200,
        include_hubs=True,
        exclude_thunderstorm=True,
        cover_red_eye=False,
    )
    system_user = await ensure_system_sim_user(db_session)
    policies = [
        Policy(
            user_id=system_user.id,
            flight_id=flight_a.id,
            underwriter_pool_id=pool.id,
            premium=10,
            payout=130,
            condition_json=json.dumps({"type": "delay", "threshold_min": 30}),
            status=PolicyStatus.ACTIVE,
            contract_ref="mock-bound-a",
        ),
        Policy(
            user_id=system_user.id,
            flight_id=flight_b.id,
            underwriter_pool_id=pool.id,
            premium=10,
            payout=120,
            condition_json=json.dumps({"type": "delay", "threshold_min": 30}),
            status=PolicyStatus.ACTIVE,
            contract_ref="mock-bound-b",
        ),
    ]
    db_session.add_all(policies)
    await db_session.commit()

    engine = ClaimEngine(
        adapter=FakeAdapter(),
        session_factory=_session_factory(db_session),
        now=lambda: 1_700_000_000,
    )

    summary = await engine.run_once()

    async with _session_factory(db_session)() as session:
        pool_after = await session.get(Pool, pool.id)
        policy_rows = [
            await session.get(Policy, policies[0].id),
            await session.get(Policy, policies[1].id),
        ]

    assert summary.triggered == 2
    assert pool_after.balance == -50
    assert pool_after.status == PoolStatus.CLOSED_BANKRUPT
    assert all(policy.underwriter_pool_id == pool.id for policy in policy_rows)
