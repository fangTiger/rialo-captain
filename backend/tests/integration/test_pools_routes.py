import pytest
from httpx import ASGITransport, AsyncClient

from backend.app import create_app
from backend.db import Base, get_engine


class RecordingBroadcaster:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def broadcast(self, message: dict) -> None:
        self.messages.append(message)

    async def send_to_user(self, user_id: str, message: dict) -> None:
        self.messages.append({"user_id": user_id, **message})


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "pools.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("DEV_LOGIN_ENABLED", "true")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.setenv("POOL_SIMULATOR_ENABLED", "false")
    from backend.config import get_settings

    get_settings.cache_clear()
    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None

    app = create_app()
    broadcaster = RecordingBroadcaster()
    app.state.broadcaster = broadcaster
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        client._test_broadcaster = broadcaster
        yield client

    await engine.dispose()


async def dev_login(client: AsyncClient, email: str = "uw@x.com") -> None:
    res = await client.post(
        "/auth/dev-login",
        json={"email": email, "name": "Underwriter"},
    )
    assert res.status_code == 200, res.text


def steady_payload(stake_ria: int = 200) -> dict:
    return {
        "preset_style": "steady",
        "delay_threshold_min": 30,
        "payout_multiplier": 3.0,
        "stake_ria": stake_ria,
        "include_hubs": True,
        "exclude_thunderstorm": True,
        "cover_red_eye": False,
    }


@pytest.mark.asyncio
async def test_create_pool_returns_active_pool_and_broadcasts_opened(app_client: AsyncClient):
    await dev_login(app_client)

    res = await app_client.post("/pools", json=steady_payload())

    assert res.status_code == 201, res.text
    body = res.json()
    assert body["preset_style"] == "steady"
    assert body["status"] == "active"
    assert body["balance"] == 200
    assert body["stake_ria"] == 200
    assert app_client._test_broadcaster.messages[-1]["type"] == "pool.opened"


@pytest.mark.asyncio
async def test_create_pool_returns_409_when_active_pool_exists(app_client: AsyncClient):
    await dev_login(app_client)
    first = await app_client.post("/pools", json=steady_payload())
    assert first.status_code == 201, first.text

    second = await app_client.post("/pools", json=steady_payload())

    assert second.status_code == 409


@pytest.mark.asyncio
async def test_create_pool_requires_login(app_client: AsyncClient):
    res = await app_client.post("/pools", json=steady_payload())

    assert res.status_code == 401


@pytest.mark.asyncio
async def test_get_my_pool_returns_null_then_active_pool(app_client: AsyncClient):
    await dev_login(app_client)
    empty = await app_client.get("/pools/me")
    assert empty.status_code == 200
    assert empty.json() is None

    created = await app_client.post("/pools", json=steady_payload())
    assert created.status_code == 201, created.text

    active = await app_client.get("/pools/me")
    assert active.status_code == 200
    assert active.json()["id"] == created.json()["id"]


@pytest.mark.asyncio
async def test_patch_pool_updates_rule_without_changing_stake(app_client: AsyncClient):
    await dev_login(app_client)
    created = await app_client.post("/pools", json=steady_payload())
    pool_id = created.json()["id"]

    patched = await app_client.patch(
        f"/pools/{pool_id}",
        json={
            "delay_threshold_min": 45,
            "payout_multiplier": 4.0,
            "stake_ria": 999,
            "include_hubs": False,
        },
    )

    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["rule"]["delay_threshold_min"] == 45
    assert body["rule"]["payout_multiplier"] == 4.0
    assert body["rule"]["include_hubs"] is False
    assert body["stake_ria"] == 200


@pytest.mark.asyncio
async def test_patch_pool_hides_other_users_pool(app_client: AsyncClient):
    await dev_login(app_client, "first@x.com")
    created = await app_client.post("/pools", json=steady_payload())
    pool_id = created.json()["id"]
    await dev_login(app_client, "second@x.com")

    patched = await app_client.patch(
        f"/pools/{pool_id}",
        json={"delay_threshold_min": 45},
    )

    assert patched.status_code == 404


@pytest.mark.asyncio
async def test_close_pool_and_timeline(app_client: AsyncClient):
    await dev_login(app_client)
    created = await app_client.post("/pools", json=steady_payload())
    pool_id = created.json()["id"]
    patched = await app_client.patch(
        f"/pools/{pool_id}",
        json={"delay_threshold_min": 45},
    )
    assert patched.status_code == 200, patched.text

    timeline_before = await app_client.get(f"/pools/{pool_id}/timeline?limit=50")
    assert timeline_before.status_code == 200, timeline_before.text
    assert [event["type"] for event in timeline_before.json()][:2] == [
        "pool.rule_updated",
        "pool.opened",
    ]

    closed = await app_client.delete(f"/pools/{pool_id}")
    assert closed.status_code == 200, closed.text
    assert closed.json()["returned_ria"] == 200

    timeline_after = await app_client.get(f"/pools/{pool_id}/timeline?limit=50")
    assert timeline_after.status_code == 200, timeline_after.text
    assert timeline_after.json()[0]["type"] == "pool.closed"


@pytest.mark.asyncio
async def test_delete_and_timeline_hide_other_users_pool(app_client: AsyncClient):
    await dev_login(app_client, "first@x.com")
    created = await app_client.post("/pools", json=steady_payload())
    pool_id = created.json()["id"]
    await dev_login(app_client, "second@x.com")

    delete_res = await app_client.delete(f"/pools/{pool_id}")
    timeline_res = await app_client.get(f"/pools/{pool_id}/timeline")

    assert delete_res.status_code == 404
    assert timeline_res.status_code == 404
