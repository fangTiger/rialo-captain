import asyncio

import pytest
from fastapi import FastAPI

import backend.app as app_module


class FakeOpenSky:
    def __init__(self) -> None:
        self.closed = False

    async def aclose(self) -> None:
        self.closed = True


class SpyFlightFetcher:
    instances: list["SpyFlightFetcher"] = []

    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs
        self.started = False
        self.stopped = False
        self.cancelled = False
        SpyFlightFetcher.instances.append(self)

    async def run_forever(self) -> None:
        self.started = True
        try:
            await asyncio.Future()
        except asyncio.CancelledError:
            self.cancelled = True
            raise

    def stop(self) -> None:
        self.stopped = True


class FakeAdapter:
    pass


def _configure_lifespan(monkeypatch, tmp_path) -> None:
    db_file = tmp_path / "lifespan.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")

    from backend.config import get_settings

    get_settings.cache_clear()
    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None
    app_module._opensky_singleton = None
    SpyFlightFetcher.instances = []

    monkeypatch.setattr(app_module, "OpenSkyClient", FakeOpenSky)
    monkeypatch.setattr(app_module, "FlightFetcher", SpyFlightFetcher)
    monkeypatch.setattr(app_module, "get_contract_adapter", lambda: FakeAdapter())


async def _dispose_db() -> None:
    import backend.db

    if backend.db._engine is not None:
        await backend.db._engine.dispose()
    backend.db._engine = None
    backend.db._session_factory = None


@pytest.mark.asyncio
async def test_lifespan_starts_flight_fetcher_by_default(monkeypatch, tmp_path):
    _configure_lifespan(monkeypatch, tmp_path)
    monkeypatch.delenv("FLIGHT_FETCHER_ENABLED", raising=False)
    app = FastAPI()

    try:
        async with app_module.lifespan(app):
            await asyncio.sleep(0)
            fetcher = app.state.flight_fetcher
            assert fetcher.started is True

        assert fetcher.stopped is True
        assert fetcher.cancelled is True
    finally:
        await _dispose_db()


@pytest.mark.asyncio
async def test_lifespan_respects_flight_fetcher_enabled_false(monkeypatch, tmp_path):
    _configure_lifespan(monkeypatch, tmp_path)
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    app = FastAPI()

    try:
        async with app_module.lifespan(app):
            await asyncio.sleep(0)
            fetcher = app.state.flight_fetcher
            assert fetcher.started is False

        assert fetcher.stopped is True
        assert fetcher.cancelled is False
    finally:
        await _dispose_db()
