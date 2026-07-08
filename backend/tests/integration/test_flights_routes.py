import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from backend.app import create_app, get_flight_cache
from backend.db import Base, get_engine, get_session_factory
from backend.flights.opensky import FlightState
from backend.models import Policy, PolicyStatus, PresetStyle, User
from backend.pools.service import PoolService
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
async def test_live_marks_flights_underwritten_by_current_users_pool(app_client: AsyncClient):
    login = await app_client.post(
        "/auth/dev-login",
        json={"email": "uw-flight@example.com", "name": "Underwriter"},
    )
    assert login.status_code == 200, login.text
    async with get_session_factory()() as session:
        user = (
            await session.execute(select(User).where(User.email == "uw-flight@example.com"))
        ).scalar_one()
        flight = await make_flight(session, callsign="BA178", date="20260614")
        pool = await PoolService(session).open_pool(
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
            user_id=user.id,
            flight_id=flight.id,
            underwriter_pool_id=pool.id,
            premium=10,
            payout=30,
            condition_json='{"type":"delay","threshold_min":30}',
            status=PolicyStatus.ACTIVE,
        )
        session.add(policy)
        await session.commit()

    res = await app_client.get("/flights/live")
    assert res.status_code == 200

    flight_payload = res.json()["flights"][0]
    assert flight_payload["callsign"] == "BA178"
    assert flight_payload["underwritten_by_pool_id"] == pool.id


@pytest.mark.asyncio
async def test_flight_detail_returns_404_when_unknown(app_client: AsyncClient):
    res = await app_client.get("/flights/UNKNOWN-20260613")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_flight_detail_returns_live_delay_minutes(app_client: AsyncClient):
    async with get_session_factory()() as s:
        delayed = await make_flight(s, callsign="BA178", date="20260614")
        delayed.last_state = '{"delay_minutes": 12}'
        missing = await make_flight(s, callsign="UA900", date="20260615")
        await s.commit()

    delayed_res = await app_client.get(f"/flights/{delayed.id}")
    assert delayed_res.status_code == 200
    assert delayed_res.json()["live_delay_minutes"] == 12

    missing_res = await app_client.get(f"/flights/{missing.id}")
    assert missing_res.status_code == 200
    assert missing_res.json()["live_delay_minutes"] is None
