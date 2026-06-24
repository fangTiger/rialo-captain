from dataclasses import dataclass

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app import create_app
from backend.auth import google
from backend.auth.google import GoogleProfile
from backend.db import Base, get_engine, get_session_factory
from backend.models import Claim, Policy, PolicyEvent, PolicyStatus
from backend.tests.factories import make_flight


async def _make_policy(
    session: AsyncSession,
    *,
    user_id: str,
    flight_id: str,
    premium: int = 10,
    payout: int = 80,
) -> Policy:
    policy = Policy(
        user_id=user_id,
        flight_id=flight_id,
        premium=premium,
        payout=payout,
        condition_json="{}",
        status=PolicyStatus.ACTIVE,
    )
    session.add(policy)
    await session.flush()
    return policy


async def _make_claim(
    session: AsyncSession,
    *,
    policy_id: str,
    payout: int = 80,
    delay_minutes: int = 45,
) -> Claim:
    claim = Claim(
        policy_id=policy_id,
        payout=payout,
        delay_minutes=delay_minutes,
        signature="0x" + "a" * 64,
        settle_duration_ms=900,
    )
    session.add(claim)
    await session.flush()
    return claim


def _make_event(
    *,
    event_id: str,
    policy_id: str,
    flight_id: str,
    event_type: str,
    title: str,
    source: str,
    created_at: int,
    event_sequence: int,
    claim_id: str | None = None,
    payload_json: str = "{}",
) -> PolicyEvent:
    return PolicyEvent(
        id=event_id,
        policy_id=policy_id,
        flight_id=flight_id,
        claim_id=claim_id,
        event_type=event_type,
        title=title,
        source=source,
        payload_json=payload_json,
        created_at=created_at,
        event_sequence=event_sequence,
    )


@dataclass
class EvidenceRoutesContext:
    owner_client: AsyncClient
    other_client: AsyncClient
    anonymous_client: AsyncClient
    owner_policy_id: str
    owner_claim_id: str
    empty_policy_id: str
    other_policy_id: str
    other_claim_id: str


@pytest.fixture
async def evidence_routes_context(monkeypatch, tmp_path) -> EvidenceRoutesContext:
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake-id.apps.googleusercontent.com")
    monkeypatch.setenv("RIALO_MODE", "mock")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")

    from backend.config import get_settings
    import backend.db

    get_settings.cache_clear()
    backend.db._engine = None
    backend.db._session_factory = None

    profiles = {
        "token-a": GoogleProfile(
            sub="google-owner",
            email="owner@example.com",
            name="Owner",
            avatar_url="",
        ),
        "token-b": GoogleProfile(
            sub="google-other",
            email="other@example.com",
            name="Other",
            avatar_url="",
        ),
    }
    monkeypatch.setattr(google, "verify_id_token", lambda token: profiles.get(token))

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with (
        AsyncClient(transport=transport, base_url="https://test") as owner_client,
        AsyncClient(transport=transport, base_url="https://test") as other_client,
        AsyncClient(transport=transport, base_url="https://test") as anonymous_client,
    ):
        owner_login = await owner_client.post("/auth/google", json={"id_token": "token-a"})
        other_login = await other_client.post("/auth/google", json={"id_token": "token-b"})
        assert owner_login.status_code == 200
        assert other_login.status_code == 200

        owner_user_id = owner_login.json()["id"]
        other_user_id = other_login.json()["id"]

        async with get_session_factory()() as session:
            owner_flight = await make_flight(session, callsign="BA178", date="20260614")
            owner_empty_flight = await make_flight(session, callsign="CA123", date="20260615")
            other_flight = await make_flight(session, callsign="UA900", date="20260616")

            owner_policy = await _make_policy(session, user_id=owner_user_id, flight_id=owner_flight.id)
            owner_claim = await _make_claim(session, policy_id=owner_policy.id)
            empty_policy = await _make_policy(
                session,
                user_id=owner_user_id,
                flight_id=owner_empty_flight.id,
            )
            other_policy = await _make_policy(session, user_id=other_user_id, flight_id=other_flight.id)
            other_claim = await _make_claim(session, policy_id=other_policy.id, payout=60, delay_minutes=31)

            session.add_all(
                [
                    _make_event(
                        event_id="event-3",
                        policy_id=owner_policy.id,
                        flight_id=owner_flight.id,
                        event_type="policy.created",
                        title="保单已创建",
                        source="user",
                        created_at=100,
                        event_sequence=1,
                    ),
                    _make_event(
                        event_id="event-1",
                        policy_id=owner_policy.id,
                        flight_id=owner_flight.id,
                        event_type="contract.watched",
                        title="合约监听已建立",
                        source="contract",
                        created_at=100,
                        event_sequence=2,
                    ),
                    _make_event(
                        event_id="event-2",
                        policy_id=owner_policy.id,
                        flight_id=owner_flight.id,
                        claim_id=owner_claim.id,
                        event_type="claim.settled",
                        title="赔付已结算",
                        source="mock-chain",
                        created_at=101,
                        event_sequence=3,
                        payload_json='{"payout": 80}',
                    ),
                    _make_event(
                        event_id="other-event-1",
                        policy_id=other_policy.id,
                        flight_id=other_flight.id,
                        claim_id=other_claim.id,
                        event_type="claim.settled",
                        title="其他用户赔付",
                        source="mock-chain",
                        created_at=200,
                        event_sequence=1,
                    ),
                ]
            )
            await session.commit()

        yield EvidenceRoutesContext(
            owner_client=owner_client,
            other_client=other_client,
            anonymous_client=anonymous_client,
            owner_policy_id=owner_policy.id,
            owner_claim_id=owner_claim.id,
            empty_policy_id=empty_policy.id,
            other_policy_id=other_policy.id,
            other_claim_id=other_claim.id,
        )

    await engine.dispose()


@pytest.mark.asyncio
async def test_policy_timeline_returns_ordered_events_for_owner(
    evidence_routes_context: EvidenceRoutesContext,
):
    response = await evidence_routes_context.owner_client.get(
        f"/policies/{evidence_routes_context.owner_policy_id}/timeline"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["subject"] == {
        "policy_id": evidence_routes_context.owner_policy_id,
        "flight_id": "BA178-20260614",
        "claim_id": evidence_routes_context.owner_claim_id,
    }
    assert [event["type"] for event in body["events"]] == [
        "policy.created",
        "contract.watched",
        "claim.settled",
    ]
    assert [event["title"] for event in body["events"]] == [
        "保单已创建",
        "合约监听已建立",
        "赔付已结算",
    ]


@pytest.mark.asyncio
async def test_claim_timeline_returns_full_policy_events_and_subject_claim_id(
    evidence_routes_context: EvidenceRoutesContext,
):
    response = await evidence_routes_context.owner_client.get(
        f"/claims/{evidence_routes_context.owner_claim_id}/timeline"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["subject"]["policy_id"] == evidence_routes_context.owner_policy_id
    assert body["subject"]["flight_id"] == "BA178-20260614"
    assert body["subject"]["claim_id"] == evidence_routes_context.owner_claim_id
    assert [event["type"] for event in body["events"]] == [
        "policy.created",
        "contract.watched",
        "claim.settled",
    ]


@pytest.mark.asyncio
async def test_policy_timeline_returns_empty_events_for_owned_policy_without_evidence(
    evidence_routes_context: EvidenceRoutesContext,
):
    response = await evidence_routes_context.owner_client.get(
        f"/policies/{evidence_routes_context.empty_policy_id}/timeline"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["subject"] == {
        "policy_id": evidence_routes_context.empty_policy_id,
        "flight_id": "CA123-20260615",
        "claim_id": None,
    }
    assert body["events"] == []


@pytest.mark.asyncio
async def test_policy_timeline_hides_other_users_policy_as_not_found(
    evidence_routes_context: EvidenceRoutesContext,
):
    response = await evidence_routes_context.other_client.get(
        f"/policies/{evidence_routes_context.owner_policy_id}/timeline"
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_claim_timeline_hides_other_users_claim_as_not_found(
    evidence_routes_context: EvidenceRoutesContext,
):
    response = await evidence_routes_context.other_client.get(
        f"/claims/{evidence_routes_context.owner_claim_id}/timeline"
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/policies/missing-policy/timeline", "/claims/missing-claim/timeline"])
async def test_evidence_timeline_returns_not_found_for_unknown_resources(
    evidence_routes_context: EvidenceRoutesContext,
    path: str,
):
    response = await evidence_routes_context.owner_client.get(path)

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path",
    [
        "/policies/policy-unauth/timeline",
        "/claims/claim-unauth/timeline",
    ],
)
async def test_evidence_timeline_requires_authentication(
    evidence_routes_context: EvidenceRoutesContext,
    path: str,
):
    response = await evidence_routes_context.anonymous_client.get(path)

    assert response.status_code == 401
