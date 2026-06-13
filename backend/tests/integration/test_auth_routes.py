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


@pytest.mark.asyncio
async def test_google_auth_creates_user_and_sets_cookie(app_client: AsyncClient):
    res = await app_client.post("/auth/google", json={"id_token": "valid-google-token"})
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "x@y.com"
    assert body["balance"] == 1000
    assert "rialo_session" in res.cookies
    assert "HttpOnly" in res.headers["set-cookie"]
    assert "Secure" in res.headers["set-cookie"]


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
