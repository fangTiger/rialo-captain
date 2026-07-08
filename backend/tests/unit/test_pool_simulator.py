import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.models import Flight, Policy, Pool, PresetStyle, User
from backend.pools.simulator import PassengerSimulator
from backend.pools.service import PoolService
from backend.tests.factories import make_flight


class FakeRandom:
    def __init__(self, value: float) -> None:
        self.value = value
        self.calls: list[tuple[int, int]] = []

    def uniform(self, low: int, high: int) -> float:
        self.calls.append((low, high))
        return self.value


class SimulatorRandom(FakeRandom):
    def __init__(self) -> None:
        super().__init__(11.5)
        self.weights: list[float] = []

    def choices(self, population, weights, k: int):
        self.weights = list(weights)
        return [population[self.weights.index(max(self.weights))]]

    def choice(self, population):
        return population[0]


@pytest.mark.asyncio
async def test_simulator_interval_uses_configured_range():
    rng = FakeRandom(11.5)
    simulator = PassengerSimulator(
        session_factory=None,
        interval_min_seconds=8,
        interval_max_seconds=15,
        enabled=True,
        rng=rng,
    )

    assert simulator.next_interval_seconds() == 11.5
    assert rng.calls == [(8, 15)]


@pytest.mark.asyncio
async def test_disabled_simulator_does_not_create_task():
    simulator = PassengerSimulator(
        session_factory=None,
        interval_min_seconds=8,
        interval_max_seconds=15,
        enabled=False,
    )

    assert simulator.create_task() is None


@pytest.mark.asyncio
async def test_run_once_creates_system_policy_for_high_delay_flight(db_engine):
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        low = await make_flight(session, callsign="LOW1", origin="AUS", destination="SAT")
        low.last_state = '{"delay_minutes": 5}'
        high = await make_flight(session, callsign="HIGH1", origin="SFO", destination="JFK")
        high.last_state = '{"delay_minutes": 45}'
        await session.commit()

    rng = SimulatorRandom()
    simulator = PassengerSimulator(
        session_factory=factory,
        interval_min_seconds=8,
        interval_max_seconds=15,
        enabled=True,
        rng=rng,
    )

    await simulator.run_once()

    async with factory() as session:
        system_user = (
            await session.execute(select(User).where(User.google_sub == "system-sim-user"))
        ).scalar_one()
        policy = (await session.execute(select(Policy))).scalar_one()
        flight = await session.get(Flight, policy.flight_id)

    assert system_user.is_system is True
    assert policy.user_id == system_user.id
    assert policy.premium in {5, 10, 20}
    assert flight.callsign == "HIGH1"
    assert rng.weights[1] > rng.weights[0]


@pytest.mark.asyncio
async def test_run_once_binds_matching_policy_to_active_pool(db_engine):
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        underwriter = User(
            google_sub="underwriter-1",
            email="underwriter@example.com",
            name="Underwriter",
            balance=1000,
        )
        session.add(underwriter)
        flight = await make_flight(session, callsign="HIGH2", origin="SFO", destination="JFK")
        flight.last_state = '{"delay_minutes": 45}'
        await session.flush()
        pool = await PoolService(session).open_pool(
            user=underwriter,
            preset_style=PresetStyle.STEADY,
            delay_threshold_min=30,
            payout_multiplier=3.0,
            stake_ria=200,
            include_hubs=True,
            exclude_thunderstorm=True,
            cover_red_eye=False,
        )
        pool_id = pool.id
        await session.commit()

    rng = SimulatorRandom()
    simulator = PassengerSimulator(
        session_factory=factory,
        interval_min_seconds=8,
        interval_max_seconds=15,
        enabled=True,
        rng=rng,
    )

    await simulator.run_once()

    async with factory() as session:
        policy = (await session.execute(select(Policy))).scalar_one()
        pool = await session.get(Pool, pool_id)

    assert policy.underwriter_pool_id == pool_id
    assert pool.balance == 205
