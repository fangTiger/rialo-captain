import asyncio
import os
from collections.abc import Awaitable, Callable
from typing import Any

VERCEL_SQLITE_URL = "sqlite+aiosqlite:////tmp/rialo-captain.db"


def configure_vercel_defaults() -> None:
    if os.environ.get("VERCEL") == "1":
        os.environ["DATABASE_URL"] = VERCEL_SQLITE_URL
    else:
        os.environ.setdefault("DATABASE_URL", VERCEL_SQLITE_URL)
    os.environ.setdefault("JWT_SECRET", "rialo-captain-vercel-dev-login-demo-secret-32-chars")
    os.environ.setdefault("COOKIE_SECURE", "true")
    os.environ.setdefault("DEV_LOGIN_ENABLED", "true")
    os.environ.setdefault("CLAIM_ENGINE_ENABLED", "false")
    os.environ.setdefault("FLIGHT_FETCHER_ENABLED", "false")
    os.environ.setdefault("OPENSKY_ENABLED", "false")
    os.environ.setdefault("RIALO_MODE", "mock")


configure_vercel_defaults()

from sqlalchemy import func, select  # noqa: E402

from backend.app import create_app  # noqa: E402
from backend.db import get_session_factory, init_db  # noqa: E402
from backend.models import Flight  # noqa: E402

backend_app = create_app()
_init_lock = asyncio.Lock()
_init_done = False
_flight_seed_lock = asyncio.Lock()


async def persisted_flight_count() -> int:
    async with get_session_factory()() as session:
        result = await session.execute(select(func.count()).select_from(Flight))
        return int(result.scalar_one())


async def ensure_live_flights_ready(app) -> None:
    if os.environ.get("VERCEL") != "1":
        return
    cache = getattr(app.state, "flight_cache", None)
    fetcher = getattr(app.state, "flight_fetcher", None)
    if cache is None or fetcher is None:
        return
    min_flights = 20 if os.environ.get("OPENSKY_ENABLED", "").lower() == "false" else 1
    entry = cache.get()
    if (
        len(entry.states) >= min_flights
        and not entry.stale
        and await persisted_flight_count() >= min_flights
    ):
        return
    async with _flight_seed_lock:
        entry = cache.get()
        if (
            len(entry.states) >= min_flights
            and not entry.stale
            and await persisted_flight_count() >= min_flights
        ):
            return
        await fetcher.run_once()


def should_prepare_live_flights(path: str) -> bool:
    return (
        path == "/flights/live"
        or path.startswith("/flights/")
        or path in {"/seed-demo", "/inject-delay"}
    )


@backend_app.middleware("http")
async def ensure_database_ready(request, call_next):
    global _init_done
    if not _init_done:
        async with _init_lock:
            if not _init_done:
                await init_db()
                _init_done = True
    if should_prepare_live_flights(request.url.path):
        await ensure_live_flights_ready(request.app)
    return await call_next(request)


class ApiPrefixApp:
    def __init__(self, wrapped_app):
        self._wrapped_app = wrapped_app

    async def __call__(
        self,
        scope: dict[str, Any],
        receive: Callable[[], Awaitable[dict[str, Any]]],
        send: Callable[[dict[str, Any]], Awaitable[None]],
    ) -> None:
        if scope["type"] in {"http", "websocket"}:
            scope = dict(scope)
            path = scope.get("path", "")
            if path == "/api":
                scope["path"] = "/"
                scope["root_path"] = f"{scope.get('root_path', '')}/api"
            elif path.startswith("/api/"):
                scope["path"] = path[4:]
                scope["root_path"] = f"{scope.get('root_path', '')}/api"
        await self._wrapped_app(scope, receive, send)


app = ApiPrefixApp(backend_app)
