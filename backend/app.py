import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.admin.routes import router as admin_router
from backend.auth.routes import router as auth_router
from backend.claims.engine import ClaimEngine
from backend.claims.routes import router as claims_router
from backend.copilot.routes import router as copilot_router
from backend.contracts.factory import get_contract_adapter
from backend.contracts.mock_rialo import MockRialoAdapter
from backend.db import get_session_factory, init_db
from backend.evidence.routes import router as evidence_router
from backend.config import get_settings
from backend.flights.cache import FlightCache
from backend.flights.fetcher import FlightFetcher
from backend.flights.mock import MockOpenSky
from backend.flights.opensky import OpenSkyClient
from backend.flights.routes import router as flights_router
from backend.policies.routes import router as policies_router
from backend.ws.broadcaster import Broadcaster
from backend.ws.routes import router as ws_router


def get_flight_cache() -> FlightCache:
    return _flight_cache_singleton


def get_opensky_client():
    return _opensky_singleton


def _make_opensky_client():
    """根据 settings.opensky_enabled 选择真 OpenSky 或本地 mock."""
    if get_settings().opensky_enabled:
        return OpenSkyClient()
    return MockOpenSky()


_flight_cache_singleton = FlightCache(ttl_seconds=30)
_opensky_singleton = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _opensky_singleton
    await init_db()
    _opensky_singleton = _make_opensky_client()
    broadcaster = Broadcaster()
    adapter = get_contract_adapter()
    opensky_enabled = get_settings().opensky_enabled
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=get_session_factory(),
        broadcaster=broadcaster,
        external_observation_enabled=opensky_enabled,
    )
    fetcher = FlightFetcher(
        opensky=_opensky_singleton,
        cache=_flight_cache_singleton,
        session_factory=get_session_factory(),
    )

    app.state.flight_cache = _flight_cache_singleton
    app.state.opensky = _opensky_singleton
    app.state.broadcaster = broadcaster
    app.state.contract_adapter = adapter
    app.state.claim_engine = engine
    app.state.flight_fetcher = fetcher

    engine_task: asyncio.Task | None = None
    fetcher_task: asyncio.Task | None = None
    if os.environ.get("CLAIM_ENGINE_ENABLED", "true").lower() != "false":
        engine_task = asyncio.create_task(engine.run_forever())
    if os.environ.get("FLIGHT_FETCHER_ENABLED", "true").lower() != "false":
        fetcher_task = asyncio.create_task(fetcher.run_forever())

    try:
        yield
    finally:
        engine.stop()
        fetcher.stop()
        for task in (engine_task, fetcher_task):
            if task is not None:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        opensky = _opensky_singleton
        _opensky_singleton = None
        if opensky is not None:
            await opensky.aclose()
        if isinstance(adapter, MockRialoAdapter):
            await adapter.aclose()


def create_app() -> FastAPI:
    app = FastAPI(title="rialo-captain", version="0.2.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.flight_cache = _flight_cache_singleton
    broadcaster = Broadcaster()
    app.state.broadcaster = broadcaster
    adapter = get_contract_adapter()
    app.state.contract_adapter = adapter
    app.state.claim_engine = ClaimEngine(
        adapter=adapter,
        session_factory=get_session_factory(),
        broadcaster=broadcaster,
        external_observation_enabled=get_settings().opensky_enabled,
    )
    app.state.flight_fetcher = FlightFetcher(
        opensky=_opensky_singleton or _make_opensky_client(),
        cache=_flight_cache_singleton,
        session_factory=get_session_factory(),
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "rialo-captain"}

    app.include_router(auth_router)
    app.include_router(copilot_router)
    app.include_router(flights_router)
    app.include_router(policies_router)
    app.include_router(claims_router)
    app.include_router(evidence_router)
    app.include_router(admin_router)
    app.include_router(ws_router)
    return app


app = create_app()
