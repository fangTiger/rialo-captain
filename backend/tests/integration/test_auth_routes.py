import pytest
from httpx import ASGITransport, AsyncClient

from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.app import create_app
from backend.db import Base, get_engine


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake-client-id.apps.googleusercontent.com")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("DEV_LOGIN_ENABLED", "false")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    from backend.config import get_settings

    get_settings.cache_clear()
    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None

    def fake_verify(token: str) -> GoogleProfile | None:
        if token == "valid-google-token":
            return GoogleProfile(sub="g-1", email="x@y.com", name="X", avatar_url="https://a")
        return None

    monkeypatch.setattr(google, "verify_id_token", fake_verify)

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        yield client

    await engine.dispose()


@pytest.fixture
async def custom_cookie_app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "custom-cookie.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake-client-id.apps.googleusercontent.com")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("DEV_LOGIN_ENABLED", "true")
    monkeypatch.setenv("JWT_COOKIE_NAME", "custom_session")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
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
async def test_google_auth_creates_user_and_sets_cookie(app_client: AsyncClient):
    res = await app_client.post("/auth/google", json={"id_token": "valid-google-token"})
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "x@y.com"
    assert body["balance"] == 1000
    assert "rialo_session" in res.cookies
    assert "HttpOnly" in res.headers["set-cookie"]
    assert "Secure" not in res.headers["set-cookie"]


@pytest.mark.asyncio
async def test_invalid_google_token_returns_401(app_client: AsyncClient):
    res = await app_client.post("/auth/google", json={"id_token": "bad"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_current_user(app_client: AsyncClient):
    await app_client.post("/auth/google", json={"id_token": "valid-google-token"})
    res = await app_client.get("/me")
    assert res.status_code == 200
    assert res.json()["email"] == "x@y.com"


@pytest.mark.asyncio
async def test_me_without_cookie_returns_401(app_client: AsyncClient):
    res = await app_client.get("/me")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_logout_clears_cookie(app_client: AsyncClient):
    await app_client.post("/auth/google", json={"id_token": "valid-google-token"})
    res = await app_client.post("/auth/logout")
    assert res.status_code == 204
    me_after = await app_client.get("/me")
    assert me_after.status_code == 401


@pytest.mark.asyncio
async def test_custom_jwt_cookie_name_authenticates_me_and_copilot(
    custom_cookie_app_client: AsyncClient,
):
    login = await custom_cookie_app_client.post(
        "/auth/dev-login",
        json={"email": "dev@x.com", "name": "Dev"},
    )

    assert login.status_code == 200, login.text
    assert "custom_session" in login.cookies
    assert "rialo_session" not in login.cookies

    me = await custom_cookie_app_client.get("/me")
    assert me.status_code == 200, me.text
    assert me.json()["email"] == "dev@x.com"

    copilot = await custom_cookie_app_client.post(
        "/copilot/ask",
        json={"question": "帮我总结一下", "subject_type": "overview"},
    )
    assert copilot.status_code == 200, copilot.text
    assert copilot.json()["status"] == "unavailable"
