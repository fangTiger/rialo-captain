import importlib
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.config import get_settings
from backend.db import get_engine
from backend.flights.cache import FlightCache
from backend.flights.opensky import FlightState
from backend.models import Flight


def import_vercel_entrypoint():
    get_settings.cache_clear()

    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None
    sys.modules.pop("api.index", None)
    return importlib.import_module("api.index")


def reset_vercel_sqlite():
    Path("/tmp/rialo-captain.db").unlink(missing_ok=True)


def _flight_state(index: int) -> FlightState:
    return FlightState(
        icao24=f"{index:06x}",
        callsign=f"QA{index:03d}",
        origin_country="UK",
        longitude=float(index),
        latitude=float(index),
        velocity=200.0,
        heading=90.0,
        on_ground=False,
    )


class RecordingFetcher:
    def __init__(self, cache: FlightCache):
        self.cache = cache
        self.run_once_calls = 0
        self.refresh_cache_only_calls = 0

    async def run_once(self):
        self.run_once_calls += 1
        self.cache.store([_flight_state(index) for index in range(20)])

    async def refresh_cache_only(self):
        self.refresh_cache_only_calls += 1
        self.cache.store([_flight_state(index) for index in range(20)])


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


def test_vercel_entrypoint_respects_explicit_database_url_on_vercel(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    explicit_database_url = "sqlite+aiosqlite:///./rialo.db"
    monkeypatch.setenv("DATABASE_URL", explicit_database_url)

    import_vercel_entrypoint()

    assert get_settings().database_url == explicit_database_url


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
async def test_vercel_entrypoint_refreshes_stale_cache_without_db_upsert_when_flights_exist(
    monkeypatch,
    tmp_path,
):
    db_file = tmp_path / "vercel-fast-flights.db"
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.setenv("OPENSKY_ENABLED", "false")

    entrypoint = import_vercel_entrypoint()
    await entrypoint.init_db()
    factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    async with factory() as session:
        async with session.begin():
            session.add_all(
                [
                    Flight(
                        id=f"QA{index:03d}-20260722",
                        callsign=f"QA{index:03d}",
                        origin="UK",
                        destination="",
                    )
                    for index in range(20)
                ]
            )

    now = 0

    def current_time() -> int:
        return now

    cache = FlightCache(ttl_seconds=30, now=current_time)
    cache.store([_flight_state(index) for index in range(20)])
    now = 40
    fetcher = RecordingFetcher(cache)
    app = SimpleNamespace(state=SimpleNamespace(flight_cache=cache, flight_fetcher=fetcher))

    await entrypoint.ensure_live_flights_ready(app)

    assert fetcher.refresh_cache_only_calls == 1
    assert fetcher.run_once_calls == 0


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
