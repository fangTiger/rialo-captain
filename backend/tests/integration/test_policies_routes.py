import json

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from backend.app import create_app
from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.admin.routes import clear_injected_delays
from backend.db import Base, get_engine, get_session_factory
from backend.evidence.service import EvidenceService
from backend.flights.opensky import FlightState
from backend.models import Flight, Policy, PolicyEvent, PolicyStatus, User
from backend.policies.routes import _policy_created_payload
from backend.tests.factories import make_flight


class RecordingBroadcaster:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def broadcast(self, message: dict) -> None:
        self.messages.append(message)


def make_policy_for_payload() -> Policy:
    return Policy(
        id="policy-1",
        user_id="user-1",
        flight_id="BA178-20260614",
        premium=10,
        payout=80,
        condition_json="{}",
        created_at=1_779_926_400,
    )


def make_flight_for_payload(*, last_state: str = "{}") -> Flight:
    return Flight(
        id="BA178-20260614",
        callsign="BA178",
        origin="LHR",
        destination="JFK",
        last_state=last_state,
    )


@pytest.fixture
async def app_client(monkeypatch, tmp_path):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake-id.apps.googleusercontent.com")
    monkeypatch.setenv("RIALO_MODE", "mock")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    from backend.config import get_settings

    get_settings.cache_clear()
    import backend.db

    backend.db._engine = None
    backend.db._session_factory = None

    def fake_verify(token: str) -> GoogleProfile | None:
        return GoogleProfile(sub="g-1", email="x@y.com", name="X", avatar_url="") if token == "v" else None

    monkeypatch.setattr(google, "verify_id_token", fake_verify)

    app = create_app()
    broadcaster = RecordingBroadcaster()
    app.state.broadcaster = broadcaster
    clear_injected_delays()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from backend.db import get_session_factory
    from backend.tests.factories import make_flight

    async with get_session_factory()() as s:
        await make_flight(s, callsign="BA178", date="20260614")
        await s.commit()

    from backend.app import get_flight_cache

    get_flight_cache().store(
        [
            FlightState(
                icao24="abc",
                callsign="BA178",
                origin_country="UK",
                longitude=-0.4,
                latitude=51.4,
                velocity=240.0,
                heading=280.0,
                on_ground=False,
            ),
        ]
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        client._test_broadcaster = broadcaster
        client._test_app = app
        await client.post("/auth/google", json={"id_token": "v"})
        yield client

    clear_injected_delays()
    await engine.dispose()


async def seed_policy(
    *,
    callsign: str,
    date: str,
    status: PolicyStatus = PolicyStatus.ACTIVE,
    premium: int = 10,
    payout: int = 80,
    created_at: int = 1_779_926_400,
    last_state: str = "{}",
) -> dict[str, str]:
    async with get_session_factory()() as session:
        user = (await session.execute(select(User).where(User.email == "x@y.com"))).scalar_one()
        flight = await make_flight(session, callsign=callsign, date=date)
        flight.last_state = last_state
        policy = Policy(
            user_id=user.id,
            flight_id=flight.id,
            premium=premium,
            payout=payout,
            condition_json=json.dumps({"type": "delay", "threshold_min": 30}),
            status=status,
            contract_ref=f"mock-{callsign}-{date}",
            created_at=created_at,
        )
        session.add(policy)
        await session.commit()
        return {
            "policy_id": policy.id,
            "flight_id": flight.id,
        }


@pytest.mark.asyncio
async def test_create_policy_returns_policy_with_payout(app_client: AsyncClient):
    res = await app_client.post(
        "/policies",
        json={
            "flight_id": "BA178-20260614",
            "premium": 10,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["premium"] == 10
    assert body["payout"] > 0
    assert body["status"] == "active"


@pytest.mark.asyncio
async def test_create_policy_broadcasts_policy_created_without_changing_response_schema(
    app_client: AsyncClient,
):
    res = await app_client.post(
        "/policies",
        json={
            "flight_id": "BA178-20260614",
            "premium": 10,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert set(body) == {
        "id",
        "flight_id",
        "premium",
        "payout",
        "status",
        "contract_ref",
        "created_at",
    }

    broadcaster = app_client._test_broadcaster
    policy_events = [
        message for message in broadcaster.messages if message["type"] == "policy.created"
    ]
    assert len(policy_events) == 1
    payload = policy_events[0]["payload"]
    assert payload["policy_id"] == body["id"]
    assert payload["flight_id"] == "BA178-20260614"
    assert payload["source"] == "real"
    assert payload["created_at"] == body["created_at"]
    assert payload["callsign"] == "BA178"
    assert payload["longitude"] == -0.4
    assert payload["latitude"] == 51.4


@pytest.mark.asyncio
async def test_create_policy_records_evidence_events_without_changing_response_schema(
    app_client: AsyncClient,
):
    res = await app_client.post(
        "/policies",
        json={
            "flight_id": "BA178-20260614",
            "premium": 10,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert set(body) == {
        "id",
        "flight_id",
        "premium",
        "payout",
        "status",
        "contract_ref",
        "created_at",
    }

    async with get_session_factory()() as session:
        events = (
            await session.execute(
                select(PolicyEvent)
                .where(PolicyEvent.policy_id == body["id"])
                .order_by(
                    PolicyEvent.created_at.asc(),
                    PolicyEvent.event_sequence.asc(),
                    PolicyEvent.id.asc(),
                )
            )
        ).scalars().all()

    assert [event.event_type for event in events] == [
        "policy.created",
        "contract.watched",
    ]

    created_event, watched_event = events
    assert created_event.source == "user"
    assert created_event.title == "保单已创建"
    assert watched_event.source == "contract"
    assert watched_event.title == "合约监听已建立"

    assert created_event.payload_json is not None
    assert watched_event.payload_json is not None
    created_payload = json.loads(created_event.payload_json)
    watched_payload = json.loads(watched_event.payload_json)
    assert created_payload["premium"] == body["premium"]
    assert created_payload["payout"] == body["payout"]
    assert created_payload["flight_id"] == body["flight_id"]
    assert "delay_rate" in created_payload
    assert watched_payload == {
        "contract_ref": body["contract_ref"],
        "adapter_mode": "mock",
    }


@pytest.mark.asyncio
async def test_create_policy_rolls_back_when_opening_evidence_write_fails(
    app_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    original_record_event = EvidenceService.record_event

    async def fail_opening_event(self, *, event_type: str, **kwargs):
        if event_type == "policy.created":
            raise RuntimeError("evidence boom")
        return await original_record_event(self, event_type=event_type, **kwargs)

    monkeypatch.setattr(EvidenceService, "record_event", fail_opening_event)

    async with AsyncClient(
        transport=ASGITransport(app=app_client._test_app, raise_app_exceptions=False),
        base_url="https://test",
        cookies=app_client.cookies,
    ) as failing_client:
        res = await failing_client.post(
            "/policies",
            json={
                "flight_id": "BA178-20260614",
                "premium": 10,
            },
        )

    assert res.status_code != 201

    async with get_session_factory()() as session:
        policies = (await session.execute(select(Policy))).scalars().all()
        events = (await session.execute(select(PolicyEvent))).scalars().all()
        user = (await session.execute(select(User).where(User.email == "x@y.com"))).scalar_one()

    assert policies == []
    assert events == []
    assert user.balance == 1000
    assert app_client._test_broadcaster.messages == []


def test_policy_created_payload_omits_coordinates_when_unavailable():
    payload = _policy_created_payload(
        make_policy_for_payload(),
        make_flight_for_payload(),
        cached_states=[],
    )

    assert payload["policy_id"] == "policy-1"
    assert payload["flight_id"] == "BA178-20260614"
    assert payload["source"] == "real"
    assert payload["callsign"] == "BA178"
    assert "longitude" not in payload
    assert "latitude" not in payload


def test_policy_created_payload_uses_last_state_when_cache_has_no_match():
    payload = _policy_created_payload(
        make_policy_for_payload(),
        make_flight_for_payload(last_state='{"longitude": -73.78, "latitude": 40.64}'),
        cached_states=[],
    )

    assert payload["longitude"] == -73.78
    assert payload["latitude"] == 40.64


@pytest.mark.asyncio
async def test_create_policy_invalid_premium_422(app_client: AsyncClient):
    res = await app_client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 7})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_policy_insufficient_balance_402(app_client: AsyncClient):
    # 60 次买 20 RIA, 烧光 1000 RIA, 最后一次 402。
    last_status = 0
    for _ in range(60):
        res = await app_client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 20})
        last_status = res.status_code
        if last_status == 402:
            break
    assert last_status == 402


@pytest.mark.asyncio
async def test_get_policies_returns_user_policies(app_client: AsyncClient):
    await app_client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 5})
    res = await app_client.get("/policies")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    assert items[0]["flight_id"] == "BA178-20260614"


@pytest.mark.asyncio
async def test_get_policies_preserves_existing_fields_and_returns_risk_projection_fields(
    app_client: AsyncClient,
):
    create_res = await app_client.post("/policies", json={"flight_id": "BA178-20260614", "premium": 5})
    assert create_res.status_code == 201, create_res.text
    created = create_res.json()

    async with get_session_factory()() as session:
        flight = await session.get(Flight, "BA178-20260614")
        assert flight is not None
        flight.last_state = '{"delay_minutes": 25}'
        await session.commit()

    res = await app_client.get("/policies")

    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert set(body[0]) == {
        "id",
        "flight_id",
        "premium",
        "payout",
        "status",
        "contract_ref",
        "created_at",
        "delay_threshold_minutes",
        "live_delay_minutes",
        "minutes_until_trigger",
        "risk_level",
        "risk_reason",
    }
    assert body[0]["id"] == created["id"]
    assert body[0]["flight_id"] == created["flight_id"]
    assert body[0]["premium"] == created["premium"]
    assert body[0]["payout"] == created["payout"]
    assert body[0]["status"] == created["status"]
    assert body[0]["contract_ref"] == created["contract_ref"]
    assert body[0]["created_at"] == created["created_at"]
    assert body[0]["delay_threshold_minutes"] == 30
    assert body[0]["live_delay_minutes"] == 25
    assert body[0]["minutes_until_trigger"] == 5
    assert body[0]["risk_level"] == "watch"
    assert body[0]["risk_reason"] == "delay approaching threshold"


@pytest.mark.asyncio
async def test_get_policies_returns_active_policy_risk_levels(app_client: AsyncClient):
    triggered = await seed_policy(
        callsign="BA179",
        date="20260621",
        created_at=1_779_926_404,
        last_state='{"delay_minutes": 45}',
    )
    watch = await seed_policy(
        callsign="DL101",
        date="20260615",
        created_at=1_779_926_403,
        last_state='{"delay_minutes": 25}',
    )
    normal = await seed_policy(
        callsign="UA900",
        date="20260616",
        created_at=1_779_926_402,
        last_state='{"delay_minutes": 12}',
    )
    unknown = await seed_policy(
        callsign="AF008",
        date="20260617",
        created_at=1_779_926_401,
        last_state="{}",
    )

    res = await app_client.get("/policies")

    assert res.status_code == 200
    payload_by_flight = {item["flight_id"]: item for item in res.json()}
    assert payload_by_flight[triggered["flight_id"]]["risk_level"] == "triggered"
    assert payload_by_flight[triggered["flight_id"]]["live_delay_minutes"] == 45
    assert payload_by_flight[triggered["flight_id"]]["minutes_until_trigger"] == 0
    assert payload_by_flight[triggered["flight_id"]]["risk_reason"] == "delay threshold reached"

    assert payload_by_flight[watch["flight_id"]]["risk_level"] == "watch"
    assert payload_by_flight[watch["flight_id"]]["live_delay_minutes"] == 25
    assert payload_by_flight[watch["flight_id"]]["minutes_until_trigger"] == 5
    assert payload_by_flight[watch["flight_id"]]["risk_reason"] == "delay approaching threshold"

    assert payload_by_flight[normal["flight_id"]]["risk_level"] == "normal"
    assert payload_by_flight[normal["flight_id"]]["live_delay_minutes"] == 12
    assert payload_by_flight[normal["flight_id"]]["minutes_until_trigger"] == 18
    assert payload_by_flight[normal["flight_id"]]["risk_reason"] == "delay below watch window"

    assert payload_by_flight[unknown["flight_id"]]["risk_level"] == "unknown"
    assert payload_by_flight[unknown["flight_id"]]["live_delay_minutes"] is None
    assert payload_by_flight[unknown["flight_id"]]["minutes_until_trigger"] is None
    assert payload_by_flight[unknown["flight_id"]]["risk_reason"] == "live delay unavailable"


@pytest.mark.asyncio
async def test_get_policies_matches_flight_detail_live_delay_behavior(app_client: AsyncClient):
    seeded = await seed_policy(
        callsign="VS300",
        date="20260618",
        last_state='{"delay_minutes": 18}',
    )

    policies_res = await app_client.get("/policies")
    flight_res = await app_client.get(f"/flights/{seeded['flight_id']}")

    assert policies_res.status_code == 200
    assert flight_res.status_code == 200
    policy = next(item for item in policies_res.json() if item["flight_id"] == seeded["flight_id"])
    assert policy["live_delay_minutes"] == flight_res.json()["live_delay_minutes"] == 18


@pytest.mark.asyncio
async def test_get_policies_returns_settled_and_inactive_without_trigger_countdown(
    app_client: AsyncClient,
):
    settled = await seed_policy(
        callsign="QF012",
        date="20260619",
        status=PolicyStatus.PAID,
        created_at=1_779_926_404,
        last_state='{"delay_minutes": 60}',
    )
    inactive = await seed_policy(
        callsign="SQ001",
        date="20260620",
        status=PolicyStatus.EXPIRED,
        created_at=1_779_926_403,
        last_state='{"delay_minutes": 14}',
    )

    res = await app_client.get("/policies")

    assert res.status_code == 200
    payload_by_flight = {item["flight_id"]: item for item in res.json()}
    assert payload_by_flight[settled["flight_id"]]["risk_level"] == "settled"
    assert payload_by_flight[settled["flight_id"]]["minutes_until_trigger"] is None
    assert payload_by_flight[settled["flight_id"]]["risk_reason"] == "policy already settled"

    assert payload_by_flight[inactive["flight_id"]]["risk_level"] == "inactive"
    assert payload_by_flight[inactive["flight_id"]]["minutes_until_trigger"] is None
    assert payload_by_flight[inactive["flight_id"]]["risk_reason"] == "policy is no longer active"
