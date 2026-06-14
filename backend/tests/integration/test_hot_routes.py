import pytest
from httpx import ASGITransport, AsyncClient

from backend.app import create_app
from backend.db import Base, get_engine, get_session_factory
from backend.models import Policy, PolicyStatus
from backend.tests.factories import make_flight, make_user


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "hot.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
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
        u = await make_user(s)
        for cs, count in [("BA178", 5), ("DL101", 3), ("UA200", 1)]:
            for i in range(count):
                f = await make_flight(s, callsign=cs, date=f"2026061{i}")
                p = Policy(
                    user_id=u.id,
                    flight_id=f.id,
                    premium=10,
                    payout=20,
                    condition_json="{}",
                    status=PolicyStatus.ACTIVE,
                )
                s.add(p)
                await s.flush()
        await s.commit()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="https://test",
    ) as client:
        yield client
    await engine.dispose()


@pytest.mark.asyncio
async def test_hot_routes_sorted_by_policy_count(app_client):
    res = await app_client.get("/routes/hot?limit=10")
    assert res.status_code == 200
    items = res.json()
    assert items[0]["callsign"] == "BA178"
    assert items[0]["policy_count"] == 5
    assert items[1]["callsign"] == "DL101"
    assert items[1]["policy_count"] == 3
