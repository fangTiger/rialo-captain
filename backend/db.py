from collections.abc import AsyncIterator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import get_settings


class Base(DeclarativeBase):
    pass


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None
_ASYNC_PG_UNSUPPORTED_QUERY_PARAMS = {"channel_binding"}


def normalize_async_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        database_url = f"postgresql://{database_url.removeprefix('postgres://')}"
    if database_url.startswith("postgresql://"):
        database_url = f"postgresql+asyncpg://{database_url.removeprefix('postgresql://')}"
    if not database_url.startswith("postgresql+asyncpg://"):
        return database_url

    parts = urlsplit(database_url)
    query_items = parse_qsl(parts.query, keep_blank_values=True)
    has_ssl = any(key == "ssl" for key, _ in query_items)
    normalized_query_items: list[tuple[str, str]] = []
    for key, value in query_items:
        if key in _ASYNC_PG_UNSUPPORTED_QUERY_PARAMS:
            continue
        if key != "sslmode":
            normalized_query_items.append((key, value))
            continue
        if not has_ssl:
            normalized_query_items.append(("ssl", value))
            has_ssl = True

    return urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(normalized_query_items),
            parts.fragment,
        )
    )


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        database_url = normalize_async_database_url(get_settings().database_url)
        _engine = create_async_engine(database_url, echo=False)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def init_db() -> None:
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    async with factory() as session:
        yield session
