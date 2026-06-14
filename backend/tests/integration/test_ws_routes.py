import asyncio

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.auth import google
from backend.auth.google import GoogleProfile


@pytest.fixture
def app_setup(monkeypatch, tmp_path):
    db_file = tmp_path / "ws.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake.apps.googleusercontent.com")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    from backend.config import get_settings

    get_settings.cache_clear()
    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None

    monkeypatch.setattr(
        google,
        "verify_id_token",
        lambda t: GoogleProfile(sub="g-1", email="x@y.com", name="X", avatar_url="")
        if t == "v"
        else None,
    )

    app = create_app()
    yield app

    if backend.db._engine is not None:
        asyncio.run(backend.db._engine.dispose())
    backend.db._engine = None
    backend.db._session_factory = None


def test_ws_requires_auth(app_setup):
    with TestClient(app_setup) as client:
        try:
            with client.websocket_connect("/ws"):
                pass
        except Exception:
            return
        raise AssertionError("expected WS to be rejected without auth")


def test_ws_hello_after_auth(app_setup):
    with TestClient(app_setup) as client:
        login = client.post("/auth/google", json={"id_token": "v"})
        assert login.status_code == 200
        cookies = dict(login.cookies)
        client.cookies.update(cookies)
        with client.websocket_connect("/ws") as ws:
            hello = ws.receive_json()
            assert hello["type"] == "hello"
            assert "server_time" in hello["payload"]
