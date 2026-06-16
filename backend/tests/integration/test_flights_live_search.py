import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event

from backend.app import create_app, get_flight_cache
from backend.db import Base, get_engine, get_session_factory
from backend.flights.opensky import FlightState
from backend.tests.factories import make_flight


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("OPENSKY_BASE_URL", "https://opensky.test")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    from backend.config import get_settings

    get_settings.cache_clear()
    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with get_session_factory()() as session:
        await make_flight(
            session,
            callsign="UAL2351",
            date="20260616",
            origin="SFO",
            destination="JFK",
        )
        await session.commit()

    cache = get_flight_cache()
    cache.store(
        [
            FlightState(
                icao24="known",
                callsign="UAL2351",
                origin_country="United States",
                longitude=-122.38,
                latitude=37.62,
                velocity=240.0,
                heading=90.0,
                on_ground=False,
            ),
            FlightState(
                icao24="unknown",
                callsign="OPS001",
                origin_country="United States",
                longitude=-73.78,
                latitude=40.64,
                velocity=220.0,
                heading=270.0,
                on_ground=False,
            ),
        ]
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_live_enriches_known_callsigns_and_keeps_unknown_null(
    app_client: AsyncClient,
):
    res = await app_client.get("/flights/live")

    assert res.status_code == 200
    flights = {item["callsign"]: item for item in res.json()["flights"]}
    assert flights["UAL2351"]["origin"] == "SFO"
    assert flights["UAL2351"]["destination"] == "JFK"
    assert flights["OPS001"]["origin"] is None
    assert flights["OPS001"]["destination"] is None


@pytest.mark.asyncio
async def test_live_enriches_callsigns_without_n_plus_one(app_client: AsyncClient):
    engine = get_engine()
    statements: list[str] = []

    def record_sql(_conn, _cursor, statement, _parameters, _context, _executemany):
        if "FROM flights" in statement:
            statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", record_sql)
    try:
        res = await app_client.get("/flights/live")
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", record_sql)

    assert res.status_code == 200
    assert len(statements) <= 1
