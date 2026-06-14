import pytest
from httpx import ASGITransport, AsyncClient

from backend.app import create_app
from backend.db import Base, get_engine, get_session_factory
from backend.tests.factories import make_flight, make_user


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "seed.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("ADMIN_TOKEN", "secret-admin")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.setenv("DEV_LOGIN_ENABLED", "true")
    monkeypatch.setenv("RIALO_MODE", "mock")
    from backend.config import get_settings

    get_settings.cache_clear()
    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with get_session_factory()() as s:
        await make_user(s, email="captain@local.dev")
        for cs in ["BA178", "DL101", "UA200", "AF1380", "CX251"]:
            await make_flight(s, callsign=cs, date="20260614")
        await s.commit()

    from backend.admin.routes import clear_injected_delays

    clear_injected_delays()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        yield client, app

    clear_injected_delays()
    await engine.dispose()


@pytest.mark.asyncio
async def test_seed_demo_requires_admin_token(app_client):
    client, _ = app_client
    res = await client.post("/admin/seed-demo", json={"user_email": "captain@local.dev"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_seed_demo_creates_policies_and_triggers_claims(app_client):
    client, _ = app_client
    res = await client.post(
        "/admin/seed-demo",
        json={"user_email": "captain@local.dev"},
        headers={"X-Admin-Token": "secret-admin"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["policies_created"] >= 3
    assert body["claims_settled"] >= 1
