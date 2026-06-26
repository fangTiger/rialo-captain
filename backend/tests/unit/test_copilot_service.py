import json
from dataclasses import dataclass

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.flights.cache import FlightCache
from backend.flights.opensky import FlightState
from backend.models import Claim, Policy, PolicyEvent, PolicyStatus
from backend.tests.factories import make_flight, make_user


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
        signature="0x" + "b" * 64,
        settle_duration_ms=640,
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


@dataclass
class _RecordedCall:
    question: str
    context: object


class _RecordingProvider:
    def __init__(self) -> None:
        self.calls: list[_RecordedCall] = []

    async def complete(self, *, question, context):
        from backend.copilot.provider import ProviderResult

        self.calls.append(_RecordedCall(question=question, context=context))
        return ProviderResult(
            answer="This is a test answer.",
            suggested_prompts=["Explain the evidence chain next."],
            confidence=0.77,
        )


class _FailingProvider:
    def __init__(self, *, code: str, message: str) -> None:
        self.code = code
        self.message = message
        self.calls = 0

    async def complete(self, *, question, context):
        from backend.copilot.provider import CopilotProviderError

        self.calls += 1
        raise CopilotProviderError(self.code, self.message)


class _TooManySuggestionsProvider:
    async def complete(self, *, question, context):
        from backend.copilot.provider import ProviderResult

        return ProviderResult(
            answer="This is a test answer.",
            suggested_prompts=[
                "Question 1",
                "Question 2",
                "Question 3",
                "Question 4",
                "Question 5",
                "Question 6",
                "Question 7",
            ],
            confidence=0.73,
        )


class _DisallowedSuggestionsProvider:
    async def complete(self, *, question, context):
        from backend.copilot.provider import ProviderResult

        return ProviderResult(
            answer="Tower is tracking BA178 near the payout threshold.",
            suggested_prompts=["안녕하세요", "これは次に確認すべきですか？"],
            confidence=0.66,
        )


class _DisallowedAnswerProvider:
    async def complete(self, *, question, context):
        from backend.copilot.provider import ProviderResult

        return ProviderResult(
            answer="これはテストです",
            suggested_prompts=["Explain the evidence chain next."],
            confidence=0.66,
        )


class _StreamingProvider:
    def __init__(self, chunks: list[str] | None = None) -> None:
        self.chunks = chunks or ["Tower is tracking ", "BA178 near the payout threshold."]
        self.calls: list[_RecordedCall] = []

    async def stream(self, *, question, context):
        self.calls.append(_RecordedCall(question=question, context=context))
        for chunk in self.chunks:
            yield chunk


class _FailingStreamingProvider:
    def __init__(self, *, code: str, message: str) -> None:
        self.code = code
        self.message = message
        self.calls: list[_RecordedCall] = []

    async def stream(self, *, question, context):
        from backend.copilot.provider import CopilotProviderError

        self.calls.append(_RecordedCall(question=question, context=context))
        if False:
            yield ""
        raise CopilotProviderError(self.code, self.message)


@pytest.mark.asyncio
async def test_overview_flight_stats_ignore_other_users_same_callsign_activity(
    db_session: AsyncSession,
):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    owner = await make_user(db_session, email="owner@example.com")
    other = await make_user(db_session, email="other@example.com")

    owner_flight = await make_flight(db_session, callsign="BA178", date="20260625")
    other_flight = await make_flight(db_session, callsign="BA178", date="20260626")

    owner_policy = await _make_policy(db_session, user_id=owner.id, flight_id=owner_flight.id)
    other_policy = await _make_policy(db_session, user_id=other.id, flight_id=other_flight.id)
    await _make_claim(db_session, policy_id=other_policy.id, delay_minutes=67)
    await db_session.commit()

    provider = _RecordingProvider()
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    await service.ask(
        owner,
        CopilotAskRequest(
            question="今天我最该关注什么？",
            subject_type="overview",
        ),
    )

    captured = provider.calls[0].context
    assert captured.subject["policies"][0]["id"] == owner_policy.id
    assert captured.subject["flights"] == [
        {
            "id": owner_flight.id,
            "callsign": "BA178",
            "origin": "LHR",
            "destination": "JFK",
            "delay_rate": 0.0,
            "samples": 1,
            "live_delay_minutes": None,
            "status": "",
        }
    ]


@pytest.mark.asyncio
async def test_flight_subject_stats_ignore_other_users_same_callsign_activity(
    db_session: AsyncSession,
):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    owner = await make_user(db_session, email="owner@example.com")
    other = await make_user(db_session, email="other@example.com")

    owner_flight = await make_flight(db_session, callsign="BA178", date="20260625")
    other_flight = await make_flight(db_session, callsign="BA178", date="20260626")

    owner_policy = await _make_policy(db_session, user_id=owner.id, flight_id=owner_flight.id)
    other_policy = await _make_policy(db_session, user_id=other.id, flight_id=other_flight.id)
    await _make_claim(db_session, policy_id=other_policy.id, delay_minutes=55)
    await db_session.commit()

    provider = _RecordingProvider()
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    await service.ask(
        owner,
        CopilotAskRequest(
            question="解释这班航班的风险",
            subject_type="flight",
            subject_id=owner_flight.id,
        ),
    )

    captured = provider.calls[0].context
    assert captured.subject["policies"][0]["id"] == owner_policy.id
    assert captured.subject["flight"] == {
        "id": owner_flight.id,
        "callsign": "BA178",
        "origin": "LHR",
        "destination": "JFK",
        "delay_rate": 0.0,
        "samples": 1,
        "live_delay_minutes": None,
        "status": "",
    }


@pytest.mark.asyncio
async def test_overview_subject_includes_owned_flights_and_flight_sources(db_session: AsyncSession):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    owner = await make_user(db_session, email="owner@example.com")
    other = await make_user(db_session, email="other@example.com")

    owner_flight = await make_flight(db_session, callsign="BA178", date="20260625")
    owner_flight.last_state = json.dumps(
        {"delay_minutes": 41, "status": "delayed", "internal_note": "hide-me"},
        ensure_ascii=False,
    )
    other_flight = await make_flight(db_session, callsign="UA900", date="20260625")
    other_flight.last_state = json.dumps(
        {"delay_minutes": 12, "status": "boarding"},
        ensure_ascii=False,
    )

    owner_policy = await _make_policy(db_session, user_id=owner.id, flight_id=owner_flight.id)
    await _make_claim(db_session, policy_id=owner_policy.id, delay_minutes=41)
    other_policy = await _make_policy(db_session, user_id=other.id, flight_id=other_flight.id)
    await _make_claim(db_session, policy_id=other_policy.id, delay_minutes=12)
    await db_session.commit()

    provider = _RecordingProvider()
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    await service.ask(
        owner,
        CopilotAskRequest(
            question="今天我最该关注什么？",
            subject_type="overview",
        ),
    )

    captured = provider.calls[0].context
    flights = captured.subject["flights"]
    assert flights == [
        {
            "id": owner_flight.id,
            "callsign": "BA178",
            "origin": "LHR",
            "destination": "JFK",
            "delay_rate": 1.0,
            "samples": 1,
            "live_delay_minutes": 41,
            "status": "delayed",
        }
    ]
    assert {source.type for source in captured.sources} >= {"flight", "policy", "claim"}
    assert owner_flight.id in {source.id for source in captured.sources if source.type == "flight"}
    assert other_flight.id not in {item["id"] for item in flights}


@pytest.mark.asyncio
async def test_overview_context_caps_owned_history_but_keeps_full_summary_counts(
    db_session: AsyncSession,
):
    from backend.copilot.context import CopilotContextBuilder
    from backend.copilot.schemas import CopilotAskRequest

    user = await make_user(db_session, email="owner@example.com")

    for idx in range(7):
        flight = await make_flight(
            db_session,
            callsign=f"OW{idx:03d}",
            date=f"202606{10 + idx:02d}",
        )
        flight.last_state = json.dumps(
            {
                "delay_minutes": 30 + idx,
                "status": "delayed" if idx % 2 == 0 else "boarding",
            },
            ensure_ascii=False,
        )
        policy = await _make_policy(
            db_session,
            user_id=user.id,
            flight_id=flight.id,
            premium=10 + idx,
            payout=80 + idx,
        )
        await _make_claim(
            db_session,
            policy_id=policy.id,
            payout=80 + idx,
            delay_minutes=35 + idx,
        )

    for idx in range(6):
        await make_flight(
            db_session,
            callsign=f"LV{idx:03d}",
            date=f"202607{10 + idx:02d}",
        )
    await db_session.commit()

    cache = FlightCache(ttl_seconds=30, now=lambda: 100)
    cache.store(
        [
            FlightState(
                f"icao-live-{idx}",
                f"LV{idx:03d}",
                "US",
                -118.4 + idx,
                33.94 + idx,
                205.0 + idx,
                95.0 + idx,
                False,
            )
            for idx in range(6)
        ]
    )

    builder = CopilotContextBuilder(db_session, flight_cache=cache)
    context = await builder.build(
        user,
        CopilotAskRequest(
            question="今天我最该关注什么？",
            subject_type="overview",
        ),
    )

    assert context.subject["summary"]["flight_count"] == 7
    assert context.subject["summary"]["policy_count"] == 7
    assert context.subject["summary"]["claim_count"] == 7
    assert len(context.subject["flights"]) <= 5
    assert len(context.subject["policies"]) <= 5
    assert len(context.subject["claims"]) <= 5
    assert len(context.sources) <= 20


@pytest.mark.asyncio
async def test_flight_subject_builds_allowlisted_context_and_sources(db_session: AsyncSession):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")
    flight = await make_flight(db_session, callsign="BA178", date="20260625")
    flight.last_state = json.dumps(
        {
            "delay_minutes": 52,
            "status": "delayed",
            "on_ground": False,
            "longitude": 121.5,
            "latitude": 31.2,
            "internal_note": "must-not-leak",
        },
        ensure_ascii=False,
    )
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)
    claim = await _make_claim(db_session, policy_id=policy.id)
    db_session.add(
        _make_event(
            event_id="evt-flight-1",
            policy_id=policy.id,
            flight_id=flight.id,
            claim_id=claim.id,
            event_type="claim.settled",
            title="赔付已结算",
            source="mock-chain",
            created_at=100,
            payload_json='{"payout": 80, "delay_minutes": 45, "secret_token": "x"}',
        )
    )
    await db_session.commit()

    provider = _RecordingProvider()
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    response = await service.ask(
        user,
        CopilotAskRequest(
            question="解释这班航班的风险",
            subject_type="flight",
            subject_id=flight.id,
        ),
    )

    assert response.status == "ok"
    assert provider.calls
    captured = provider.calls[0].context
    flight_payload = captured.subject["flight"]
    assert flight_payload == {
        "id": flight.id,
        "callsign": "BA178",
        "origin": "LHR",
        "destination": "JFK",
        "delay_rate": 1.0,
        "samples": 1,
        "live_delay_minutes": 52,
        "status": "delayed",
    }
    assert "longitude" not in flight_payload
    assert "latitude" not in flight_payload
    assert "internal_note" not in flight_payload
    assert captured.subject["policies"][0]["id"] == policy.id
    assert captured.subject["claims"][0]["id"] == claim.id
    assert {source.type for source in captured.sources} >= {"flight", "policy", "claim"}


@pytest.mark.asyncio
async def test_policy_subject_builds_owned_policy_context_with_citations(db_session: AsyncSession):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")
    flight = await make_flight(db_session, callsign="DL101", date="20260625")
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id, payout=120)
    claim = await _make_claim(db_session, policy_id=policy.id, payout=120, delay_minutes=61)
    db_session.add(
        _make_event(
            event_id="evt-policy-1",
            policy_id=policy.id,
            flight_id=flight.id,
            claim_id=claim.id,
            event_type="policy.created",
            title="保单已创建",
            source="user",
            created_at=100,
            payload_json='{"premium": 10, "delay_rate": 1.0, "contract_ref": "hidden"}',
        )
    )
    await db_session.commit()

    provider = _RecordingProvider()
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    await service.ask(
        user,
        CopilotAskRequest(
            question="给我总结这份保单",
            subject_type="policy",
            subject_id=policy.id,
        ),
    )

    captured = provider.calls[0].context
    assert captured.subject["policy"] == {
        "id": policy.id,
        "flight_id": flight.id,
        "premium": 10,
        "payout": 120,
        "status": "active",
        "created_at": policy.created_at,
    }
    assert captured.subject["flight"]["callsign"] == "DL101"
    assert captured.subject["claims"][0]["delay_minutes"] == 61
    assert captured.subject["evidence_events"] == [
        {
            "id": "evt-policy-1",
            "type": "policy.created",
            "title": "policy.created",
            "source": "user",
            "created_at": 100,
            "payload": {"premium": 10, "delay_rate": 1.0},
        }
    ]
    assert {source.type for source in captured.sources} >= {"policy", "flight", "claim", "evidence"}
    labels = {source.type: source.label for source in captured.sources}
    assert labels["policy"] == f"Policy {policy.id}"
    assert labels["claim"] == f"Claim {claim.id}"
    assert labels["flight"].startswith("Flight DL101 ")
    assert labels["evidence"] == "Evidence policy.created"


@pytest.mark.asyncio
async def test_claim_subject_builds_claim_and_evidence_context_with_citations(db_session: AsyncSession):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")
    flight = await make_flight(db_session, callsign="UA900", date="20260625")
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id, payout=95)
    claim = await _make_claim(db_session, policy_id=policy.id, payout=95, delay_minutes=33)
    db_session.add_all(
        [
            _make_event(
                event_id="evt-claim-1",
                policy_id=policy.id,
                flight_id=flight.id,
                claim_id=claim.id,
                event_type="observation.received",
                title="收到延误观测",
                source="engine",
                created_at=100,
                payload_json='{"delay_minutes": 33, "threshold_minutes": 30, "trace": "hide"}',
            ),
            _make_event(
                event_id="evt-claim-2",
                policy_id=policy.id,
                flight_id=flight.id,
                claim_id=claim.id,
                event_type="claim.settled",
                title="赔付已结算",
                source="mock-chain",
                created_at=101,
                payload_json='{"payout": 95, "raw_signature": "hide"}',
            ),
        ]
    )
    await db_session.commit()

    provider = _RecordingProvider()
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    await service.ask(
        user,
        CopilotAskRequest(
            question="为什么我收到了这笔赔付？",
            subject_type="claim",
            subject_id=claim.id,
        ),
    )

    captured = provider.calls[0].context
    assert captured.subject["claim"] == {
        "id": claim.id,
        "policy_id": policy.id,
        "payout": 95,
        "delay_minutes": 33,
        "settled_at": claim.settled_at,
        "settle_duration_ms": 640,
    }
    assert captured.subject["policy"]["id"] == policy.id
    assert captured.subject["flight"]["id"] == flight.id
    assert captured.subject["evidence_events"] == [
        {
            "id": "evt-claim-1",
            "type": "observation.received",
            "title": "observation.received",
            "source": "engine",
            "created_at": 100,
            "payload": {"delay_minutes": 33, "threshold_minutes": 30},
        },
        {
            "id": "evt-claim-2",
            "type": "claim.settled",
            "title": "claim.settled",
            "source": "mock-chain",
            "created_at": 101,
            "payload": {"payout": 95},
        },
    ]
    assert {source.type for source in captured.sources} >= {"claim", "evidence"}


@pytest.mark.asyncio
async def test_evidence_subject_builds_event_summary_context_with_citations(db_session: AsyncSession):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")
    flight = await make_flight(db_session, callsign="CA123", date="20260625")
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)
    claim = await _make_claim(db_session, policy_id=policy.id, delay_minutes=58)
    db_session.add(
        _make_event(
            event_id="evt-evidence-1",
            policy_id=policy.id,
            flight_id=flight.id,
            claim_id=claim.id,
            event_type="contract.watched",
            title="合约监听已建立",
            source="contract",
            created_at=100,
            payload_json='{"adapter_mode": "mock", "contract_ref": "hide-me"}',
        )
    )
    await db_session.commit()

    provider = _RecordingProvider()
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    await service.ask(
        user,
        CopilotAskRequest(
            question="这条证据说明了什么？",
            subject_type="evidence",
            subject_id=claim.id,
        ),
    )

    captured = provider.calls[0].context
    assert captured.subject["claim"]["id"] == claim.id
    assert captured.subject["policy"]["id"] == policy.id
    assert captured.subject["evidence_events"] == [
        {
            "id": "evt-evidence-1",
            "type": "contract.watched",
            "title": "contract.watched",
            "source": "contract",
            "created_at": 100,
            "payload": {"adapter_mode": "mock"},
        }
    ]
    assert {source.type for source in captured.sources} >= {"policy", "claim", "evidence"}
    labels = {source.type: source.label for source in captured.sources}
    assert labels["policy"] == f"Policy {policy.id}"
    assert labels["claim"] == f"Claim {claim.id}"
    assert labels["evidence"] == "Evidence contract.watched"


@pytest.mark.asyncio
async def test_policy_subject_rejects_other_users_policy_before_provider_call(db_session: AsyncSession):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotNotFoundError, CopilotService

    owner = await make_user(db_session, email="owner@example.com")
    viewer = await make_user(db_session, email="viewer@example.com")
    flight = await make_flight(db_session, callsign="BA178", date="20260625")
    policy = await _make_policy(db_session, user_id=owner.id, flight_id=flight.id)
    await db_session.commit()

    provider = _RecordingProvider()
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    with pytest.raises(CopilotNotFoundError):
        await service.ask(
            viewer,
            CopilotAskRequest(
                question="解释这份保单",
                subject_type="policy",
                subject_id=policy.id,
            ),
        )

    assert provider.calls == []


@pytest.mark.asyncio
async def test_claim_subject_rejects_other_users_claim_before_provider_call(db_session: AsyncSession):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotNotFoundError, CopilotService

    owner = await make_user(db_session, email="owner@example.com")
    viewer = await make_user(db_session, email="viewer@example.com")
    flight = await make_flight(db_session, callsign="BA178", date="20260625")
    policy = await _make_policy(db_session, user_id=owner.id, flight_id=flight.id)
    claim = await _make_claim(db_session, policy_id=policy.id)
    await db_session.commit()

    provider = _RecordingProvider()
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    with pytest.raises(CopilotNotFoundError):
        await service.ask(
            viewer,
            CopilotAskRequest(
                question="解释这笔赔付",
                subject_type="claim",
                subject_id=claim.id,
            ),
        )

    assert provider.calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("error_code", "error_message"),
    [
        ("timeout", "DeepSeek request timed out. Please try again."),
        ("network_error", "DeepSeek is temporarily unavailable. Please try again."),
        ("invalid_response", "DeepSeek returned an unreadable structured response."),
        ("upstream_error", "DeepSeek is temporarily unavailable (502)."),
    ],
)
async def test_service_maps_provider_errors_to_unavailable_status(
    db_session: AsyncSession,
    error_code: str,
    error_message: str,
):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")
    flight = await make_flight(db_session, callsign="BA178", date="20260625")
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)
    await _make_claim(db_session, policy_id=policy.id)
    await db_session.commit()

    provider = _FailingProvider(code=error_code, message=error_message)
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    response = await service.ask(
        user,
        CopilotAskRequest(
            question="今天我最该关注什么？",
            subject_type="overview",
        ),
    )

    assert provider.calls == 1
    assert response.status == "unavailable"
    assert response.model == "deepseek-v4-pro"
    assert response.sources
    assert response.answer == "Rialo Copilot is temporarily unavailable. Please try again later."
    assert response.suggested_prompts == [
        "Try again in a moment.",
        "Review the evidence timeline first.",
    ]


@pytest.mark.asyncio
async def test_service_returns_english_fallbacks_when_provider_is_not_configured(
    db_session: AsyncSession,
):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")

    service = CopilotService(
        db_session,
        provider=_RecordingProvider(),
        deepseek_api_key="",
        deepseek_model="deepseek-v4-pro",
    )

    response = await service.ask(
        user,
        CopilotAskRequest(
            question="What needs attention right now?",
            subject_type="overview",
        ),
    )

    assert response.status == "unavailable"
    assert response.answer == "Rialo Copilot is not configured in this environment yet."
    assert response.suggested_prompts == [
        "Try again later.",
        "Review recent claim timelines.",
    ]


@pytest.mark.asyncio
async def test_service_maps_non_english_visible_provider_answer_to_unavailable_status(
    db_session: AsyncSession,
):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")
    flight = await make_flight(db_session, callsign="BA178", date="20260625")
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)
    await _make_claim(db_session, policy_id=policy.id)
    await db_session.commit()

    service = CopilotService(
        db_session,
        provider=_DisallowedAnswerProvider(),
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    response = await service.ask(
        user,
        CopilotAskRequest(
            question="What needs attention right now?",
            subject_type="overview",
        ),
    )

    assert response.status == "unavailable"
    assert response.answer == "Rialo Copilot is temporarily unavailable. Please try again later."
    assert response.suggested_prompts == [
        "Which flights need attention right now?",
        "Which routes are closest to a payout threshold?",
        "Which live flights are still uninsured for me?",
        "Which recent claims deserve a review?",
        "Which evidence chains should I inspect first?",
    ]


@pytest.mark.asyncio
async def test_overview_context_includes_live_tower_summary_and_caps_sample_flights(
    db_session: AsyncSession,
):
    from backend.copilot.context import CopilotContextBuilder
    from backend.copilot.schemas import CopilotAskRequest

    user = await make_user(db_session, email="owner@example.com")
    for callsign in ("CA123", "BA178", "DL101", "UA900", "MU512", "SQ318"):
        await make_flight(db_session, callsign=callsign, date="20260625")
    await db_session.commit()

    cache = FlightCache(ttl_seconds=30, now=lambda: 100)
    cache.store(
        [
            FlightState("icao-1", "CA123", "CN", 121.47, 31.23, 233.0, 84.0, False),
            FlightState("icao-2", "BA178", "GB", -73.78, 40.64, 241.0, 90.0, False),
            FlightState("icao-3", "DL101", "US", -84.43, 33.64, 214.0, 110.0, False),
            FlightState("icao-4", "UA900", "US", -118.4, 33.94, 205.0, 95.0, False),
            FlightState("icao-5", "MU512", "CN", 116.41, 39.9, 198.0, 102.0, False),
            FlightState("icao-6", "SQ318", "SG", 103.99, 1.36, 222.0, 88.0, False),
        ]
    )

    builder = CopilotContextBuilder(db_session, flight_cache=cache)
    context = await builder.build(
        user,
        CopilotAskRequest(
            question="今天最该关注什么？",
            subject_type="overview",
        ),
    )

    live_tower = context.subject["live_tower"]
    assert live_tower["total_flights"] == 6
    assert live_tower["data_stale"] is False
    assert live_tower["stale_seconds"] == 0
    assert len(live_tower["sample_flights"]) == 5
    assert [item["callsign"] for item in live_tower["sample_flights"]] == [
        "CA123",
        "BA178",
        "DL101",
        "UA900",
        "MU512",
    ]


@pytest.mark.asyncio
async def test_overview_context_keeps_live_tower_summary_for_user_without_policies(
    db_session: AsyncSession,
):
    from backend.copilot.context import CopilotContextBuilder
    from backend.copilot.schemas import CopilotAskRequest

    user = await make_user(db_session, email="owner@example.com")
    await make_flight(db_session, callsign="BA178", date="20260625")
    await db_session.commit()

    cache = FlightCache(ttl_seconds=30, now=lambda: 120)
    cache.store(
        [
            FlightState("icao-1", "BA178", "GB", -73.78, 40.64, 241.0, 90.0, False),
            FlightState("icao-2", "UA900", "US", -118.4, 33.94, 205.0, 95.0, False),
        ]
    )

    builder = CopilotContextBuilder(db_session, flight_cache=cache)
    context = await builder.build(
        user,
        CopilotAskRequest(
            question="现在有什么值得关注？",
            subject_type="overview",
        ),
    )

    assert context.subject["summary"] == {
        "flight_count": 0,
        "policy_count": 0,
        "claim_count": 0,
        "evidence_event_count": 0,
    }
    assert context.subject["live_tower"] == {
        "total_flights": 2,
        "data_stale": False,
        "stale_seconds": 0,
        "sample_flights": [
            {
                "callsign": "BA178",
                "origin": "LHR",
                "destination": "JFK",
                "status": "",
                "on_ground": False,
            },
            {
                "callsign": "UA900",
                "origin": "",
                "destination": "",
                "status": "",
                "on_ground": False,
            },
        ],
    }


@pytest.mark.asyncio
async def test_service_stream_emits_context_delta_suggestions_and_done_events(
    db_session: AsyncSession,
):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")
    flight = await make_flight(db_session, callsign="BA178", date="20260625")
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)
    await _make_claim(db_session, policy_id=policy.id)
    await db_session.commit()

    provider = _StreamingProvider()
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    events = [
        event
        async for event in service.stream(
            user,
            CopilotAskRequest(
                question="今天我最该关注什么？",
                subject_type="overview",
            ),
        )
    ]

    assert [event.event for event in events] == [
        "context",
        "delta",
        "delta",
        "suggestions",
        "done",
    ]
    assert events[0].data["subject_type"] == "overview"
    assert events[1].data == {"delta": "Tower is tracking "}
    assert events[2].data == {"delta": "BA178 near the payout threshold."}
    assert len(events[3].data["suggested_prompts"]) <= 5
    assert events[4].data["answer"] == "Tower is tracking BA178 near the payout threshold."
    assert events[4].data["status"] == "ok"
    assert events[4].data["suggested_prompts"] == events[3].data["suggested_prompts"]


@pytest.mark.asyncio
async def test_service_stream_emits_context_then_error_when_provider_stream_fails(
    db_session: AsyncSession,
):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")
    flight = await make_flight(db_session, callsign="BA178", date="20260625")
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)
    await _make_claim(db_session, policy_id=policy.id)
    await db_session.commit()

    provider = _FailingStreamingProvider(
        code="invalid_response",
        message="DeepSeek returned an unreadable structured response.",
    )
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    events = [
        event
        async for event in service.stream(
            user,
            CopilotAskRequest(
                question="今天我最该关注什么？",
                subject_type="overview",
            ),
        )
    ]

    assert [event.event for event in events] == ["context", "error"]
    assert events[0].data["subject_type"] == "overview"
    assert events[1].data == {
        "code": "invalid_response",
        "message": "DeepSeek returned an unreadable structured response.",
    }
    assert provider.calls[0].question == "今天我最该关注什么？"


@pytest.mark.asyncio
async def test_service_stream_emits_context_then_error_when_provider_stream_returns_non_english_visible_delta(
    db_session: AsyncSession,
):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")
    flight = await make_flight(db_session, callsign="BA178", date="20260625")
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)
    await _make_claim(db_session, policy_id=policy.id)
    await db_session.commit()

    provider = _StreamingProvider(chunks=["안녕하세요"])
    service = CopilotService(
        db_session,
        provider=provider,
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    events = [
        event
        async for event in service.stream(
            user,
            CopilotAskRequest(
                question="What needs attention right now?",
                subject_type="overview",
            ),
        )
    ]

    assert [event.event for event in events] == ["context", "error"]
    assert events[1].data == {
        "code": "invalid_response",
        "message": "DeepSeek returned non-English visible text.",
    }


@pytest.mark.asyncio
async def test_service_caps_non_stream_suggested_prompts_to_five(db_session: AsyncSession):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")
    flight = await make_flight(db_session, callsign="BA178", date="20260625")
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)
    await _make_claim(db_session, policy_id=policy.id)
    await db_session.commit()

    service = CopilotService(
        db_session,
        provider=_TooManySuggestionsProvider(),
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    response = await service.ask(
        user,
        CopilotAskRequest(
            question="今天我最该关注什么？",
            subject_type="overview",
        ),
    )

    assert response.status == "ok"
    assert response.suggested_prompts == [
        "Question 1",
        "Question 2",
        "Question 3",
        "Question 4",
        "Question 5",
    ]


@pytest.mark.asyncio
async def test_service_replaces_disallowed_provider_prompts_with_english_fallbacks(
    db_session: AsyncSession,
):
    from backend.copilot.schemas import CopilotAskRequest
    from backend.copilot.service import CopilotService

    user = await make_user(db_session, email="owner@example.com")
    flight = await make_flight(db_session, callsign="BA178", date="20260625")
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)
    await _make_claim(db_session, policy_id=policy.id)
    await db_session.commit()

    service = CopilotService(
        db_session,
        provider=_DisallowedSuggestionsProvider(),
        deepseek_api_key="test-deepseek-key",
        deepseek_model="deepseek-v4-pro",
    )

    response = await service.ask(
        user,
        CopilotAskRequest(
            question="What needs attention right now?",
            subject_type="overview",
        ),
    )

    assert response.status == "ok"
    assert response.answer == "Tower is tracking BA178 near the payout threshold."
    assert response.suggested_prompts == [
        "Which flights need attention right now?",
        "Which routes are closest to a payout threshold?",
        "Which live flights are still uninsured for me?",
        "Which recent claims deserve a review?",
        "Which evidence chains should I inspect first?",
    ]
