import importlib
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from backend.config import get_settings


def import_vercel_entrypoint():
    get_settings.cache_clear()

    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None
    sys.modules.pop("api.index", None)
    return importlib.import_module("api.index")


def reset_vercel_sqlite():
    Path("/tmp/rialo-captain.db").unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_vercel_entrypoint_handles_dev_login_under_api_prefix(monkeypatch, tmp_path):
    db_file = tmp_path / "vercel.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    monkeypatch.setenv("DEV_LOGIN_ENABLED", "true")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.setenv("OPENSKY_ENABLED", "false")

    entrypoint = import_vercel_entrypoint()

    async with AsyncClient(
        transport=ASGITransport(app=entrypoint.app),
        base_url="https://captain-rialo.vercel.app",
    ) as client:
        res = await client.post(
            "/api/auth/dev-login",
            json={"email": "captain@local.dev", "name": "Dev Captain"},
        )

    assert res.status_code == 200, res.text
    assert res.json()["email"] == "captain@local.dev"
    assert "rialo_session" in res.cookies
    assert "Secure" in res.headers["set-cookie"]


def test_vercel_entrypoint_forces_writable_tmp_sqlite_on_vercel(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///./rialo.db")

    import_vercel_entrypoint()

    assert get_settings().database_url == "sqlite+aiosqlite:////tmp/rialo-captain.db"


@pytest.mark.asyncio
async def test_vercel_entrypoint_serves_mock_live_flights_on_cold_start(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.setenv("OPENSKY_ENABLED", "false")
    reset_vercel_sqlite()

    entrypoint = import_vercel_entrypoint()

    async with AsyncClient(
        transport=ASGITransport(app=entrypoint.app),
        base_url="https://captain-rialo.vercel.app",
    ) as client:
        res = await client.get("/api/flights/live")

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["data_stale"] is False
    assert len(body["flights"]) >= 20
    assert all(flight["longitude"] is not None for flight in body["flights"])
    assert all(flight["latitude"] is not None for flight in body["flights"])


@pytest.mark.asyncio
async def test_vercel_entrypoint_serves_mock_flight_detail_on_cold_start(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.setenv("OPENSKY_ENABLED", "false")
    reset_vercel_sqlite()

    entrypoint = import_vercel_entrypoint()
    today = datetime.now(timezone.utc).strftime("%Y%m%d")

    async with AsyncClient(
        transport=ASGITransport(app=entrypoint.app),
        base_url="https://captain-rialo.vercel.app",
    ) as client:
        res = await client.get(f"/api/flights/BA178-{today}")

    assert res.status_code == 200, res.text
    assert res.json()["callsign"] == "BA178"


@pytest.mark.asyncio
async def test_vercel_entrypoint_seed_demo_bootstraps_user_and_flights(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.setenv("OPENSKY_ENABLED", "false")
    reset_vercel_sqlite()

    entrypoint = import_vercel_entrypoint()

    async with AsyncClient(
        transport=ASGITransport(app=entrypoint.app),
        base_url="https://captain-rialo.vercel.app",
    ) as client:
        res = await client.post(
            "/api/seed-demo",
            json={
                "user_email": "captain@local.dev",
                "protagonist_name": "Dev Captain",
                "flight_id": "BA178",
            },
        )

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["user_email"] == "captain@local.dev"
    assert body["flight_id"].startswith("BA178-")
    assert body["policies_created"] == 1


@pytest.mark.asyncio
async def test_vercel_entrypoint_dev_session_survives_fresh_instance(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.setenv("OPENSKY_ENABLED", "false")
    reset_vercel_sqlite()

    entrypoint = import_vercel_entrypoint()
    async with AsyncClient(
        transport=ASGITransport(app=entrypoint.app),
        base_url="https://captain-rialo.vercel.app",
    ) as client:
        login = await client.post(
            "/api/auth/dev-login",
            json={"email": "captain@local.dev", "name": "Dev Captain"},
        )
    assert login.status_code == 200, login.text
    session_cookie = login.cookies["rialo_session"]

    reset_vercel_sqlite()
    fresh_entrypoint = import_vercel_entrypoint()
    async with AsyncClient(
        transport=ASGITransport(app=fresh_entrypoint.app),
        base_url="https://captain-rialo.vercel.app",
    ) as client:
        client.cookies.set("rialo_session", session_cookie)
        res = await client.get("/api/me")

    assert res.status_code == 200, res.text
    assert res.json()["email"] == "captain@local.dev"
