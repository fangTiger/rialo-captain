import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.auth.routes import router as auth_router
from backend.claims.engine import ClaimEngine
from backend.claims.routes import router as claims_router
from backend.contracts.factory import get_contract_adapter
from backend.contracts.mock_rialo import MockRialoAdapter
from backend.db import get_session_factory, init_db
from backend.flights.cache import FlightCache
from backend.flights.opensky import OpenSkyClient
from backend.flights.routes import router as flights_router
from backend.policies.routes import router as policies_router


def get_flight_cache() -> FlightCache:
    return _flight_cache_singleton


def get_opensky_client() -> OpenSkyClient:
    return _opensky_singleton


_flight_cache_singleton = FlightCache(ttl_seconds=30)
_opensky_singleton: OpenSkyClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _opensky_singleton
    await init_db()
    _opensky_singleton = OpenSkyClient()
    adapter = get_contract_adapter()
    engine = ClaimEngine(adapter=adapter, session_factory=get_session_factory())

    app.state.flight_cache = _flight_cache_singleton
    app.state.opensky = _opensky_singleton
    app.state.contract_adapter = adapter
    app.state.claim_engine = engine

    engine_task: asyncio.Task | None = None
    if os.environ.get("CLAIM_ENGINE_ENABLED", "true").lower() != "false":
        engine_task = asyncio.create_task(engine.run_forever())

    try:
        yield
    finally:
        engine.stop()
        if engine_task is not None:
            engine_task.cancel()
            try:
                await engine_task
            except asyncio.CancelledError:
                pass
        if _opensky_singleton is not None:
            await _opensky_singleton.aclose()
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
    adapter = get_contract_adapter()
    app.state.contract_adapter = adapter
    app.state.claim_engine = ClaimEngine(adapter=adapter, session_factory=get_session_factory())

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "rialo-captain"}

    app.include_router(auth_router)
    app.include_router(flights_router)
    app.include_router(policies_router)
    app.include_router(claims_router)
    return app


app = create_app()
