import pytest
from httpx import ASGITransport, AsyncClient

from backend.app import create_app
from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.db import Base, get_engine, get_session_factory
from backend.flights.opensky import FlightState
from backend.tests.factories import make_flight


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "e2e.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake.apps.googleusercontent.com")
    monkeypatch.setenv("ADMIN_TOKEN", "admin-x")
    monkeypatch.setenv("RIALO_MODE", "mock")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")  # 手动 run_once
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    from backend.config import get_settings

    get_settings.cache_clear()
    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None

    monkeypatch.setattr(
        google,
        "verify_id_token",
        lambda t: GoogleProfile(
            sub="g-e2e", email="captain@x.com", name="Captain", avatar_url=""
        )
        if t == "v"
        else None,
    )

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

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
                longitude=0.0,
                latitude=51.4,
                velocity=240.0,
                heading=280.0,
                on_ground=False,
            ),
        ]
    )

    # 清理 admin 注入表。
    from backend.admin.routes import clear_injected_delays

    clear_injected_delays()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
            yield client, app
    finally:
        clear_injected_delays()
        await engine.dispose()


@pytest.mark.asyncio
async def test_reactive_pipeline_buy_inject_settle(app_client):
    client, app = app_client

    # 1. 登录
    me = await client.post("/auth/google", json={"id_token": "v"})
    assert me.status_code == 200
    initial_balance = me.json()["balance"]
    assert initial_balance == 1000

    # 2. 买险
    buy = await client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 10})
    assert buy.status_code == 201, buy.text
    policy = buy.json()
    assert policy["payout"] > 0
    assert policy["contract_ref"].startswith("mock-")

    # 余额扣 10
    me2 = await client.get("/me")
    assert me2.json()["balance"] == 990

    # 3. admin 注入延误
    inject = await client.post(
        "/admin/inject-delay",
        json={"flight_id": "BA178-20260614", "delay_minutes": 45},
        headers={"X-Admin-Token": "admin-x"},
    )
    assert inject.status_code == 200

    # 4. 手动跑一次 ClaimEngine
    engine = app.state.claim_engine
    summary = await engine.run_once()
    assert summary.triggered == 1

    # 5. 余额已加回 payout
    me3 = await client.get("/me")
    assert me3.json()["balance"] == 990 + policy["payout"]

    # 6. /claims/recent 看到这条赔付
    claims = await client.get("/claims/recent")
    items = claims.json()
    assert len(items) >= 1
    settled = items[0]
    assert settled["payout"] == policy["payout"]
    assert settled["delay_minutes"] == 45
    assert settled["signature"].startswith("0x")

    # 7. 我的保单已 paid
    mine = await client.get("/policies")
    assert mine.json()[0]["status"] == "paid"
