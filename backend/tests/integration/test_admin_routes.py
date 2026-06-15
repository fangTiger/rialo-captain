import pytest
from httpx import ASGITransport, AsyncClient

from backend.app import create_app
from backend.db import Base, get_engine, get_session_factory
from backend.tests.factories import make_flight


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("ADMIN_TOKEN", "secret-admin")
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

    async with get_session_factory()() as s:
        await make_flight(s, callsign="BA178", date="20260614")
        await s.commit()

    # 清空注入表防止跨 test 污染。
    from backend.admin.routes import clear_injected_delays

    clear_injected_delays()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        yield client

    await engine.dispose()


@pytest.fixture
async def cinema_disabled_client(monkeypatch, tmp_path):
    db_file = tmp_path / "disabled.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("ADMIN_TOKEN", "secret-admin")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.setenv("CINEMA_AUTOSEED_ENABLED", "false")
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
        await make_flight(s, callsign="BA178", date="20260614")
        await s.commit()

    from backend.admin.routes import clear_injected_delays

    clear_injected_delays()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_inject_delay_requires_admin_token(app_client: AsyncClient):
    res = await app_client.post(
        "/admin/inject-delay",
        json={"flight_id": "BA178-20260614", "delay_minutes": 45},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_inject_delay_with_token_succeeds(app_client: AsyncClient):
    res = await app_client.post(
        "/admin/inject-delay",
        json={"flight_id": "BA178-20260614", "delay_minutes": 45},
        headers={"X-Admin-Token": "secret-admin"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["flight_id"] == "BA178-20260614"
    assert body["delay_minutes"] == 45


@pytest.mark.asyncio
async def test_inject_delay_unknown_flight_returns_404(app_client: AsyncClient):
    res = await app_client.post(
        "/admin/inject-delay",
        json={"flight_id": "ZZ999-20260614", "delay_minutes": 45},
        headers={"X-Admin-Token": "secret-admin"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_cinema_inject_delay_without_admin_token_succeeds(app_client: AsyncClient):
    res = await app_client.post(
        "/inject-delay",
        json={"flight_id": "BA178-20260614", "delay_minutes": 45},
    )

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["flight_id"] == "BA178-20260614"
    assert body["delay_minutes"] == 45


@pytest.mark.asyncio
async def test_cinema_inject_delay_unknown_flight_returns_404(app_client: AsyncClient):
    res = await app_client.post(
        "/inject-delay",
        json={"flight_id": "ZZ999-20260614", "delay_minutes": 45},
    )

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_cinema_inject_delay_returns_403_when_disabled(
    cinema_disabled_client: AsyncClient,
):
    res = await cinema_disabled_client.post(
        "/inject-delay",
        json={"flight_id": "BA178-20260614", "delay_minutes": 45},
    )

    assert res.status_code == 403
