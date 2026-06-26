import json
from dataclasses import dataclass
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app import create_app, get_flight_cache
from backend.db import Base, get_engine, get_session_factory
from backend.flights.opensky import FlightState
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
        condition_json='{"type":"delay","threshold_min":30}',
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
        settle_duration_ms=750,
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
        event_sequence=created_at * 10,
    )


class _BuildServiceSpy:
    def __init__(self):
        self.calls = 0

    def __call__(self, session):
        self.calls += 1
        raise AssertionError("build_copilot_service 不应被调用")


def _parse_sse_events(payload: str) -> list[tuple[str, dict[str, Any]]]:
    events: list[tuple[str, dict[str, Any]]] = []
    current_event: str | None = None
    data_lines: list[str] = []

    for line in payload.splitlines():
        if line.startswith("event:"):
            current_event = line.split(":", 1)[1].strip()
            continue
        if line.startswith("data:"):
            data_lines.append(line.split(":", 1)[1].strip())
            continue
        if not line.strip():
            if current_event is not None:
                events.append((current_event, json.loads("\n".join(data_lines))))
            current_event = None
            data_lines = []

    if current_event is not None:
        events.append((current_event, json.loads("\n".join(data_lines))))
    return events


@dataclass
class _ProviderSpy:
    result_answer: str = "Based on your current Rialo data, BA178 has the clearest delay risk right now."
    calls: int = 0

    async def complete(self, *, question, context):
        self.calls += 1
        from backend.copilot.provider import ProviderResult

        return ProviderResult(
            answer=self.result_answer,
            suggested_prompts=["Explain this claim.", "Open the evidence chain."],
            confidence=0.86,
        )


@dataclass
class _RecordedProviderCall:
    question: str
    context: object


class _RecordingProvider:
    def __init__(self) -> None:
        self.calls: list[_RecordedProviderCall] = []

    async def complete(self, *, question, context):
        from backend.copilot.provider import ProviderResult

        self.calls.append(_RecordedProviderCall(question=question, context=context))
        return ProviderResult(
            answer="This is a test answer.",
            suggested_prompts=["Explain the live tower next."],
            confidence=0.74,
        )


@dataclass
class _StreamingProviderSpy:
    chunks: tuple[str, ...] = ("Tower is tracking ", "BA178 near the payout threshold.")
    calls: int = 0

    async def stream(self, *, question, context):
        self.calls += 1
        for chunk in self.chunks:
            yield chunk


class _FailingStreamingProvider:
    def __init__(self, *, code: str, message: str) -> None:
        self.code = code
        self.message = message
        self.calls = 0

    async def stream(self, *, question, context):
        from backend.copilot.provider import CopilotProviderError

        self.calls += 1
        raise CopilotProviderError(self.code, self.message)
        yield ""


@dataclass
class CopilotRoutesContext:
    owner_client: AsyncClient
    other_client: AsyncClient
    anonymous_client: AsyncClient
    owner_policy_id: str
    owner_claim_id: str
    other_policy_id: str
    other_claim_id: str


@pytest.fixture
async def copilot_routes_context(monkeypatch, tmp_path) -> CopilotRoutesContext:
    db_file = tmp_path / "copilot-routes.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_file}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-32-chars-min-padding-xx")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("DEV_LOGIN_ENABLED", "true")
    monkeypatch.setenv("CLAIM_ENGINE_ENABLED", "false")
    monkeypatch.setenv("FLIGHT_FETCHER_ENABLED", "false")
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    from backend.config import get_settings
    import backend.db

    get_settings.cache_clear()
    backend.db._engine = None
    backend.db._session_factory = None

    app = create_app()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with (
        AsyncClient(transport=transport, base_url="https://test") as owner_client,
        AsyncClient(transport=transport, base_url="https://test") as other_client,
        AsyncClient(transport=transport, base_url="https://test") as anonymous_client,
    ):
        owner_login = await owner_client.post(
            "/auth/dev-login",
            json={"email": "owner@example.com", "name": "Owner"},
        )
        other_login = await other_client.post(
            "/auth/dev-login",
            json={"email": "other@example.com", "name": "Other"},
        )
        assert owner_login.status_code == 200, owner_login.text
        assert other_login.status_code == 200, other_login.text

        owner_user_id = owner_login.json()["id"]
        other_user_id = other_login.json()["id"]

        async with get_session_factory()() as session:
            owner_flight = await make_flight(session, callsign="BA178", date="20260625")
            other_flight = await make_flight(session, callsign="UA900", date="20260626")

            owner_flight.last_state = (
                '{"delay_minutes": 41, "status": "delayed", "internal_note": "do-not-send"}'
            )
            other_flight.last_state = '{"delay_minutes": 12, "status": "boarding"}'

            owner_policy = await _make_policy(
                session,
                user_id=owner_user_id,
                flight_id=owner_flight.id,
            )
            owner_claim = await _make_claim(session, policy_id=owner_policy.id)
            other_policy = await _make_policy(
                session,
                user_id=other_user_id,
                flight_id=other_flight.id,
                payout=60,
            )
            other_claim = await _make_claim(
                session,
                policy_id=other_policy.id,
                payout=60,
                delay_minutes=31,
            )

            session.add_all(
                [
                    _make_event(
                        event_id="owner-policy-created",
                        policy_id=owner_policy.id,
                        flight_id=owner_flight.id,
                        claim_id=None,
                        event_type="policy.created",
                        title="保单已创建",
                        source="user",
                        created_at=100,
                        payload_json='{"premium": 10, "secret_token": "should-not-leak"}',
                    ),
                    _make_event(
                        event_id="owner-claim-settled",
                        policy_id=owner_policy.id,
                        flight_id=owner_flight.id,
                        claim_id=owner_claim.id,
                        event_type="claim.settled",
                        title="赔付已结算",
                        source="mock-chain",
                        created_at=101,
                        payload_json='{"payout": 80, "delay_minutes": 45}',
                    ),
                    _make_event(
                        event_id="other-claim-settled",
                        policy_id=other_policy.id,
                        flight_id=other_flight.id,
                        claim_id=other_claim.id,
                        event_type="claim.settled",
                        title="其他用户赔付",
                        source="mock-chain",
                        created_at=200,
                        payload_json='{"payout": 60, "delay_minutes": 31}',
                    ),
                ]
            )
            await session.commit()

        get_flight_cache().store(
            [
                FlightState("icao-1", "BA178", "GB", -73.78, 40.64, 241.0, 90.0, False),
                FlightState("icao-2", "UA900", "US", -118.4, 33.94, 205.0, 95.0, False),
                FlightState("icao-3", "DL101", "US", -84.43, 33.64, 214.0, 110.0, False),
                FlightState("icao-4", "MU512", "CN", 116.41, 39.9, 198.0, 102.0, False),
                FlightState("icao-5", "SQ318", "SG", 103.99, 1.36, 222.0, 88.0, False),
                FlightState("icao-6", "CA123", "CN", 121.47, 31.23, 233.0, 84.0, False),
            ]
        )

        yield CopilotRoutesContext(
            owner_client=owner_client,
            other_client=other_client,
            anonymous_client=anonymous_client,
            owner_policy_id=owner_policy.id,
            owner_claim_id=owner_claim.id,
            other_policy_id=other_policy.id,
            other_claim_id=other_claim.id,
        )

    await engine.dispose()


@pytest.mark.asyncio
async def test_copilot_ask_requires_authentication_and_never_builds_service(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot import routes

    builder_spy = _BuildServiceSpy()
    monkeypatch.setattr(routes, "build_copilot_service", builder_spy)

    response = await copilot_routes_context.anonymous_client.post(
        "/copilot/ask",
        json={"question": "今天我最该关注什么？", "subject_type": "overview"},
    )

    assert response.status_code == 401
    assert builder_spy.calls == 0


@pytest.mark.asyncio
async def test_copilot_ask_stream_requires_authentication_and_never_builds_service(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot import routes

    builder_spy = _BuildServiceSpy()
    monkeypatch.setattr(routes, "build_copilot_service", builder_spy)

    response = await copilot_routes_context.anonymous_client.post(
        "/copilot/ask/stream",
        json={"question": "今天我最该关注什么？", "subject_type": "overview"},
    )

    assert response.status_code == 401
    assert builder_spy.calls == 0


@pytest.mark.asyncio
async def test_copilot_ask_returns_unavailable_when_deepseek_key_missing(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot.routes import build_copilot_service
    from backend.copilot.service import CopilotService

    provider = _ProviderSpy()

    def fake_builder(session, flight_cache=None):
        return CopilotService(
            session,
            provider=provider,
            deepseek_api_key="",
            deepseek_model="deepseek-v4-pro",
        )

    monkeypatch.setattr(
        __import__("backend.copilot.routes", fromlist=["build_copilot_service"]),
        "build_copilot_service",
        fake_builder,
    )

    response = await copilot_routes_context.owner_client.post(
        "/copilot/ask",
        json={"question": "Give me a quick summary.", "subject_type": "overview"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["answer"] == "Rialo Copilot is not configured in this environment yet."
    assert body["model"] == "deepseek-v4-pro"
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_copilot_ask_stream_emits_error_event_when_deepseek_key_missing(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot.service import CopilotService

    provider = _StreamingProviderSpy()

    def fake_builder(session, flight_cache=None):
        return CopilotService(
            session,
            provider=provider,
            deepseek_api_key="",
            deepseek_model="deepseek-v4-pro",
        )

    monkeypatch.setattr(
        __import__("backend.copilot.routes", fromlist=["build_copilot_service"]),
        "build_copilot_service",
        fake_builder,
    )

    response = await copilot_routes_context.owner_client.post(
        "/copilot/ask/stream",
        json={"question": "Give me a quick summary.", "subject_type": "overview"},
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")
    events = _parse_sse_events(response.text)
    assert [name for name, _ in events] == ["error"]
    assert events[0][1]["code"] == "unavailable"
    assert (
        events[0][1]["message"]
        == "Rialo Copilot is not configured in this environment yet."
    )
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_copilot_ask_returns_structured_overview_with_mocked_provider(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot.service import CopilotService

    provider = _ProviderSpy()

    def fake_builder(session, flight_cache=None):
        return CopilotService(
            session,
            provider=provider,
            deepseek_api_key="test-deepseek-key",
            deepseek_model="deepseek-v4-pro",
        )

    monkeypatch.setattr(
        __import__("backend.copilot.routes", fromlist=["build_copilot_service"]),
        "build_copilot_service",
        fake_builder,
    )

    response = await copilot_routes_context.owner_client.post(
        "/copilot/ask",
        json={"question": "今天我最该关注什么？", "subject_type": "overview"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ok"
    assert body["answer"] == provider.result_answer
    assert body["model"] == "deepseek-v4-pro"
    assert body["confidence"] == pytest.approx(0.86)
    assert body["suggested_prompts"] == [
        "Explain this claim.",
        "Open the evidence chain.",
    ]
    assert {source["type"] for source in body["sources"]} >= {"policy", "claim", "evidence"}
    labels = {source["type"]: source["label"] for source in body["sources"]}
    assert labels["policy"].startswith("Policy ")
    assert labels["claim"].startswith("Claim ")
    evidence_labels = [
        source["label"] for source in body["sources"] if source["type"] == "evidence"
    ]
    assert set(evidence_labels) == {
        "Evidence policy.created",
        "Evidence claim.settled",
    }
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_copilot_ask_hides_non_english_visible_provider_answer(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot.service import CopilotService

    provider = _ProviderSpy(result_answer="これはテストです")

    def fake_builder(session, flight_cache=None):
        return CopilotService(
            session,
            provider=provider,
            deepseek_api_key="test-deepseek-key",
            deepseek_model="deepseek-v4-pro",
        )

    monkeypatch.setattr(
        __import__("backend.copilot.routes", fromlist=["build_copilot_service"]),
        "build_copilot_service",
        fake_builder,
    )

    response = await copilot_routes_context.owner_client.post(
        "/copilot/ask",
        json={"question": "What needs attention right now?", "subject_type": "overview"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["answer"] == "Rialo Copilot is temporarily unavailable. Please try again later."
    assert body["suggested_prompts"] == [
        "Which flights need attention right now?",
        "Which routes are closest to a payout threshold?",
        "Which live flights are still uninsured for me?",
        "Which recent claims deserve a review?",
        "Which evidence chains should I inspect first?",
    ]
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_copilot_ask_overview_passes_live_tower_summary_to_provider(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot.context import CopilotContextBuilder
    from backend.copilot.service import CopilotService

    provider = _RecordingProvider()

    def fake_builder(session, flight_cache=None):
        return CopilotService(
            session,
            provider=provider,
            deepseek_api_key="test-deepseek-key",
            deepseek_model="deepseek-v4-pro",
            context_builder=CopilotContextBuilder(session, flight_cache=flight_cache),
        )

    monkeypatch.setattr(
        __import__("backend.copilot.routes", fromlist=["build_copilot_service"]),
        "build_copilot_service",
        fake_builder,
    )

    response = await copilot_routes_context.owner_client.post(
        "/copilot/ask",
        json={"question": "现在 live tower 有什么值得关注？", "subject_type": "overview"},
    )

    assert response.status_code == 200, response.text
    assert len(provider.calls) == 1
    live_tower = provider.calls[0].context.subject["live_tower"]
    assert live_tower["total_flights"] == 6
    assert len(live_tower["sample_flights"]) == 5


@pytest.mark.asyncio
async def test_copilot_ask_stream_returns_context_delta_suggestions_and_done_events(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot.service import CopilotService

    provider = _StreamingProviderSpy()

    def fake_builder(session, flight_cache=None):
        return CopilotService(
            session,
            provider=provider,
            deepseek_api_key="test-deepseek-key",
            deepseek_model="deepseek-v4-pro",
        )

    monkeypatch.setattr(
        __import__("backend.copilot.routes", fromlist=["build_copilot_service"]),
        "build_copilot_service",
        fake_builder,
    )

    response = await copilot_routes_context.owner_client.post(
        "/copilot/ask/stream",
        json={"question": "今天我最该关注什么？", "subject_type": "overview"},
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-cache, no-transform"
    events = _parse_sse_events(response.text)
    assert [name for name, _ in events] == [
        "context",
        "delta",
        "delta",
        "suggestions",
        "done",
    ]
    assert events[0][1]["subject_type"] == "overview"
    assert events[1][1] == {"delta": "Tower is tracking "}
    assert events[2][1] == {"delta": "BA178 near the payout threshold."}
    assert len(events[3][1]["suggested_prompts"]) <= 5
    assert events[4][1]["answer"] == "Tower is tracking BA178 near the payout threshold."
    assert events[4][1]["status"] == "ok"
    assert len(events[4][1]["suggested_prompts"]) <= 5
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_copilot_ask_stream_emits_safe_error_event_when_provider_fails(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot.service import CopilotService

    provider = _FailingStreamingProvider(
        code="timeout",
        message="DeepSeek request timed out. Please try again.",
    )

    def fake_builder(session, flight_cache=None):
        return CopilotService(
            session,
            provider=provider,
            deepseek_api_key="test-deepseek-key",
            deepseek_model="deepseek-v4-pro",
        )

    monkeypatch.setattr(
        __import__("backend.copilot.routes", fromlist=["build_copilot_service"]),
        "build_copilot_service",
        fake_builder,
    )

    response = await copilot_routes_context.owner_client.post(
        "/copilot/ask/stream",
        json={"question": "今天我最该关注什么？", "subject_type": "overview"},
    )

    assert response.status_code == 200, response.text
    events = _parse_sse_events(response.text)
    assert [name for name, _ in events] == ["context", "error"]
    assert events[1][1]["code"] == "timeout"
    assert events[1][1]["message"] == "DeepSeek request timed out. Please try again."
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_copilot_ask_stream_hides_non_english_visible_delta_events(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot.service import CopilotService

    provider = _StreamingProviderSpy(chunks=("안녕하세요",))

    def fake_builder(session, flight_cache=None):
        return CopilotService(
            session,
            provider=provider,
            deepseek_api_key="test-deepseek-key",
            deepseek_model="deepseek-v4-pro",
        )

    monkeypatch.setattr(
        __import__("backend.copilot.routes", fromlist=["build_copilot_service"]),
        "build_copilot_service",
        fake_builder,
    )

    response = await copilot_routes_context.owner_client.post(
        "/copilot/ask/stream",
        json={"question": "What needs attention right now?", "subject_type": "overview"},
    )

    assert response.status_code == 200, response.text
    events = _parse_sse_events(response.text)
    assert [name for name, _ in events] == ["context", "error"]
    assert events[1][1] == {
        "code": "invalid_response",
        "message": "DeepSeek returned non-English visible text.",
    }
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_copilot_policy_subject_hides_other_users_resource_before_provider_call(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot.service import CopilotService

    provider = _ProviderSpy()

    def fake_builder(session, flight_cache=None):
        return CopilotService(
            session,
            provider=provider,
            deepseek_api_key="test-deepseek-key",
            deepseek_model="deepseek-v4-pro",
        )

    monkeypatch.setattr(
        __import__("backend.copilot.routes", fromlist=["build_copilot_service"]),
        "build_copilot_service",
        fake_builder,
    )

    response = await copilot_routes_context.owner_client.post(
        "/copilot/ask",
        json={
            "question": "解释一下这份保单",
            "subject_type": "policy",
            "subject_id": copilot_routes_context.other_policy_id,
        },
    )

    assert response.status_code == 404
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_copilot_claim_subject_hides_other_users_resource_before_provider_call(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot.service import CopilotService

    provider = _ProviderSpy()

    def fake_builder(session, flight_cache=None):
        return CopilotService(
            session,
            provider=provider,
            deepseek_api_key="test-deepseek-key",
            deepseek_model="deepseek-v4-pro",
        )

    monkeypatch.setattr(
        __import__("backend.copilot.routes", fromlist=["build_copilot_service"]),
        "build_copilot_service",
        fake_builder,
    )

    response = await copilot_routes_context.owner_client.post(
        "/copilot/ask",
        json={
            "question": "为什么没有赔付？",
            "subject_type": "claim",
            "subject_id": copilot_routes_context.other_claim_id,
        },
    )

    assert response.status_code == 404
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_copilot_evidence_subject_hides_other_users_resource_before_provider_call(
    copilot_routes_context: CopilotRoutesContext,
    monkeypatch: pytest.MonkeyPatch,
):
    from backend.copilot.service import CopilotService

    provider = _ProviderSpy()

    def fake_builder(session, flight_cache=None):
        return CopilotService(
            session,
            provider=provider,
            deepseek_api_key="test-deepseek-key",
            deepseek_model="deepseek-v4-pro",
        )

    monkeypatch.setattr(
        __import__("backend.copilot.routes", fromlist=["build_copilot_service"]),
        "build_copilot_service",
        fake_builder,
    )

    response = await copilot_routes_context.owner_client.post(
        "/copilot/ask",
        json={
            "question": "解释这条证据",
            "subject_type": "evidence",
            "subject_id": copilot_routes_context.other_claim_id,
        },
    )

    assert response.status_code == 404
    assert provider.calls == 0
