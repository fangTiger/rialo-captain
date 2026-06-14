import pytest
from httpx import ASGITransport, AsyncClient

from backend.app import create_app, get_flight_cache
from backend.db import Base, get_engine
from backend.flights.opensky import FlightState


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

    cache = get_flight_cache()
    cache.store(
        [
            FlightState(
                icao24="abc",
                callsign="BA178",
                origin_country="UK",
                longitude=-0.4,
                latitude=51.4,
                velocity=240.0,
                heading=280.0,
                on_ground=False,
            ),
        ]
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_live_returns_cached_states(app_client: AsyncClient):
    res = await app_client.get("/flights/live")
    assert res.status_code == 200
    body = res.json()
    assert body["data_stale"] is False
    assert len(body["flights"]) == 1
    assert body["flights"][0]["callsign"] == "BA178"


@pytest.mark.asyncio
async def test_flight_detail_returns_404_when_unknown(app_client: AsyncClient):
    res = await app_client.get("/flights/UNKNOWN-20260613")
    assert res.status_code == 404
