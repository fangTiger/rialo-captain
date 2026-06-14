import pytest
from httpx import ASGITransport, AsyncClient

from backend.app import create_app
from backend.db import Base, get_engine


@pytest.fixture
async def app_client_with_dev_login(monkeypatch, tmp_path):
    db_file = tmp_path / "dev.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("DEV_LOGIN_ENABLED", "true")
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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        yield client
    await engine.dispose()


@pytest.fixture
async def app_client_dev_login_off(monkeypatch, tmp_path):
    db_file = tmp_path / "off.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("DEV_LOGIN_ENABLED", "false")
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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        yield client
    await engine.dispose()


@pytest.mark.asyncio
async def test_dev_login_creates_user_and_sets_cookie(
    app_client_with_dev_login: AsyncClient,
):
    res = await app_client_with_dev_login.post(
        "/auth/dev-login",
        json={"email": "dev@x.com", "name": "Dev"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["email"] == "dev@x.com"
    assert body["balance"] == 1000
    assert "rialo_session" in res.cookies
    assert "Secure" not in res.headers["set-cookie"]


@pytest.mark.asyncio
async def test_dev_login_disabled_returns_404(app_client_dev_login_off: AsyncClient):
    res = await app_client_dev_login_off.post(
        "/auth/dev-login",
        json={"email": "dev@x.com"},
    )
    assert res.status_code == 404
