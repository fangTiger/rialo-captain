import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.flights.cache import FlightCache
from backend.flights.fetcher import FlightFetcher
from backend.flights.opensky import FlightState
from backend.models import Flight


class FakeOpenSky:
    def __init__(self, states: list[FlightState]):
        self._states = list(states)
        self.calls = 0

    async def fetch_all(self) -> list[FlightState]:
        self.calls += 1
        return list(self._states)

    async def aclose(self) -> None:
        pass


def _state(callsign: str = "BA178", lat: float = 51.0, lon: float = 0.0) -> FlightState:
    return FlightState(
        icao24="abc",
        callsign=callsign,
        origin_country="UK",
        longitude=lon,
        latitude=lat,
        velocity=200.0,
        heading=90.0,
        on_ground=False,
    )


def _session_factory(db_session: AsyncSession):
    return async_sessionmaker(db_session.bind, expire_on_commit=False)


@pytest.mark.asyncio
async def test_run_once_stores_to_cache_and_upserts_flights(db_session: AsyncSession):
    cache = FlightCache(ttl_seconds=30)
    fake = FakeOpenSky([_state("BA178"), _state("DL101")])
    fetcher = FlightFetcher(
        opensky=fake,
        cache=cache,
        session_factory=_session_factory(db_session),
        today_id=lambda: "20260614",
    )
    summary = await fetcher.run_once()
    assert summary.fetched == 2
    assert summary.upserted == 2
    entry = cache.get()
    assert entry.stale is False
    assert len(entry.states) == 2
    rows = (await db_session.execute(select(Flight))).scalars().all()
    callsigns = {r.callsign for r in rows}
    assert {"BA178", "DL101"}.issubset(callsigns)
    ids = {r.id for r in rows}
    assert {"BA178-20260614", "DL101-20260614"}.issubset(ids)


@pytest.mark.asyncio
async def test_run_once_idempotent_upsert(db_session: AsyncSession):
    cache = FlightCache(ttl_seconds=30)
    fake = FakeOpenSky([_state("BA178")])
    fetcher = FlightFetcher(
        opensky=fake,
        cache=cache,
        session_factory=_session_factory(db_session),
        today_id=lambda: "20260614",
    )
    await fetcher.run_once()
    await fetcher.run_once()
    rows = (await db_session.execute(select(Flight))).scalars().all()
    assert len([r for r in rows if r.callsign == "BA178"]) == 1


@pytest.mark.asyncio
async def test_run_once_handles_opensky_failure(db_session: AsyncSession):
    class FlakyOpenSky:
        async def fetch_all(self):
            raise RuntimeError("upstream 503")

        async def aclose(self):
            pass

    cache = FlightCache(ttl_seconds=30)
    fetcher = FlightFetcher(
        opensky=FlakyOpenSky(),
        cache=cache,
        session_factory=_session_factory(db_session),
        today_id=lambda: "20260614",
    )
    summary = await fetcher.run_once()
    assert summary.fetched == 0
    assert summary.error is not None
    assert cache.get().states == []


@pytest.mark.asyncio
async def test_skip_states_without_callsign(db_session: AsyncSession):
    cache = FlightCache(ttl_seconds=30)
    fake = FakeOpenSky(
        [
            _state("BA178"),
            FlightState(
                icao24="x",
                callsign="",
                origin_country="",
                longitude=0,
                latitude=0,
                velocity=None,
                heading=None,
                on_ground=False,
            ),
        ]
    )
    fetcher = FlightFetcher(
        opensky=fake,
        cache=cache,
        session_factory=_session_factory(db_session),
        today_id=lambda: "20260614",
    )
    summary = await fetcher.run_once()
    assert summary.fetched == 1
    assert summary.upserted == 1
