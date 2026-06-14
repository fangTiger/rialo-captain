import pytest
from httpx import ASGITransport, AsyncClient

from backend.app import create_app
from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.db import Base, get_engine
from backend.flights.opensky import FlightState


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake-id.apps.googleusercontent.com")
    monkeypatch.setenv("RIALO_MODE", "mock")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    from backend.config import get_settings

    get_settings.cache_clear()
    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None

    def fake_verify(token: str) -> GoogleProfile | None:
        return GoogleProfile(sub="g-1", email="x@y.com", name="X", avatar_url="") if token == "v" else None

    monkeypatch.setattr(google, "verify_id_token", fake_verify)

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from backend.db import get_session_factory
    from backend.tests.factories import make_flight

    async with get_session_factory()() as s:
        await make_flight(s, callsign="BA178", date="20260614")
        await s.commit()

    from backend.app import get_flight_cache

    get_flight_cache().store(
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

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        await client.post("/auth/google", json={"id_token": "v"})
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_create_policy_returns_policy_with_payout(app_client: AsyncClient):
    res = await app_client.post(
        "/policies",
        json={
            "flight_id": "BA178-20260614",
            "premium": 10,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["premium"] == 10
    assert body["payout"] > 0
    assert body["status"] == "active"


@pytest.mark.asyncio
async def test_create_policy_invalid_premium_422(app_client: AsyncClient):
    res = await app_client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 7})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_policy_insufficient_balance_402(app_client: AsyncClient):
    # 60 次买 20 RIA, 烧光 1000 RIA, 最后一次 402。
    last_status = 0
    for _ in range(60):
        res = await app_client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 20})
        last_status = res.status_code
        if last_status == 402:
            break
    assert last_status == 402


@pytest.mark.asyncio
async def test_get_policies_returns_user_policies(app_client: AsyncClient):
    await app_client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 5})
    res = await app_client.get("/policies")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    assert items[0]["flight_id"] == "BA178-20260614"
