import importlib
import sys

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
