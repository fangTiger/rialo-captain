from backend.db import normalize_async_database_url


def test_normalize_async_database_url_keeps_sqlite_urls_unchanged():
    url = "sqlite+aiosqlite:///./rialo.db"

    assert normalize_async_database_url(url) == url


def test_normalize_async_database_url_converts_vercel_neon_postgres_url():
    url = "postgres://user:pass@ep-test.neon.tech/rialo?sslmode=require"

    normalized = normalize_async_database_url(url)

    assert normalized == "postgresql+asyncpg://user:pass@ep-test.neon.tech/rialo?ssl=require"


def test_normalize_async_database_url_converts_plain_postgresql_url():
    url = "postgresql://user:pass@ep-test.neon.tech/rialo?sslmode=require"

    normalized = normalize_async_database_url(url)

    assert normalized == "postgresql+asyncpg://user:pass@ep-test.neon.tech/rialo?ssl=require"


def test_normalize_async_database_url_keeps_asyncpg_url_driver():
    url = "postgresql+asyncpg://user:pass@ep-test.neon.tech/rialo?sslmode=require"

    normalized = normalize_async_database_url(url)

    assert normalized == "postgresql+asyncpg://user:pass@ep-test.neon.tech/rialo?ssl=require"


def test_normalize_async_database_url_removes_libpq_only_channel_binding():
    url = (
        "postgres://user:pass@ep-test.neon.tech/rialo"
        "?sslmode=require&channel_binding=require"
    )

    normalized = normalize_async_database_url(url)

    assert normalized == "postgresql+asyncpg://user:pass@ep-test.neon.tech/rialo?ssl=require"
