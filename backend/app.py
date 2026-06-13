from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.auth.routes import router as auth_router
from backend.contracts.factory import get_contract_adapter
from backend.contracts.mock_rialo import MockRialoAdapter
from backend.db import init_db
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
    app.state.flight_cache = _flight_cache_singleton
    app.state.opensky = _opensky_singleton
    app.state.contract_adapter = adapter
    try:
        yield
    finally:
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
    app.state.contract_adapter = get_contract_adapter()

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "rialo-captain"}

    app.include_router(auth_router)
    app.include_router(flights_router)
    app.include_router(policies_router)
    return app


app = create_app()
