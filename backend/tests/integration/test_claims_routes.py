import pytest
from httpx import ASGITransport, AsyncClient

from backend.app import create_app
from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.db import Base, get_engine, get_session_factory
from backend.models import Claim, Policy, PolicyStatus
from backend.tests.factories import make_flight, make_user


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake.apps.googleusercontent.com")
    monkeypatch.setenv("RIALO_MODE", "mock")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    from backend.config import get_settings

    get_settings.cache_clear()
    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None

    monkeypatch.setattr(
        google,
        "verify_id_token",
        lambda t: GoogleProfile(sub="g-1", email="x@y.com", name="X", avatar_url="") if t == "v" else None,
    )

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with get_session_factory()() as s:
        user = await make_user(s, email="x@y.com")
        flight = await make_flight(s, callsign="BA178", date="20260614")
        policy = Policy(
            user_id=user.id,
            flight_id=flight.id,
            premium=10,
            payout=80,
            condition_json="{}",
            status=PolicyStatus.PAID,
        )
        s.add(policy)
        await s.flush()
        s.add(
            Claim(
                policy_id=policy.id,
                payout=80,
                delay_minutes=45,
                signature="0x" + "a" * 64,
                settle_duration_ms=900,
            )
        )
        await s.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        await client.post("/auth/google", json={"id_token": "v"})
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_claims_recent_returns_paid_claims(app_client: AsyncClient):
    res = await app_client.get("/claims/recent")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1
    item = items[0]
    assert item["payout"] == 80
    assert item["delay_minutes"] == 45
    assert item["signature"].startswith("0x")
    assert item["settle_duration_ms"] == 900
