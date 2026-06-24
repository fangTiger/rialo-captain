import json

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import backend.models as evidence_models
from backend.evidence.service import (
    EvidenceIntegrityError,
    EvidenceNotFoundError,
    EvidenceService,
)
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
    signature: str = "0x" + "a" * 64,
) -> Claim:
    claim = Claim(
        policy_id=policy_id,
        payout=payout,
        delay_minutes=delay_minutes,
        signature=signature,
        settle_duration_ms=123,
    )
    session.add(claim)
    await session.flush()
    return claim


@pytest.mark.asyncio
async def test_record_event_persists_policy_event(db_session: AsyncSession):
    user = await make_user(db_session)
    flight = await make_flight(db_session)
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)
    claim = await _make_claim(db_session, policy_id=policy.id)

    event = await EvidenceService(db_session).record_event(
        policy_id=policy.id,
        flight_id=flight.id,
        claim_id=claim.id,
        event_type="observation.received",
        title="收到观测",
        source="engine",
        payload={"delay_minutes": 45, "threshold_minutes": 30},
    )

    stored = (
        await db_session.execute(select(PolicyEvent).where(PolicyEvent.id == event.id))
    ).scalar_one()

    assert stored.policy_id == policy.id
    assert stored.flight_id == flight.id
    assert stored.claim_id == claim.id
    assert stored.event_type == "observation.received"
    assert stored.title == "收到观测"
    assert stored.source == "engine"
    assert json.loads(stored.payload_json) == {"delay_minutes": 45, "threshold_minutes": 30}
    assert stored.created_at > 0
    assert stored.event_sequence > 0


@pytest.mark.asyncio
async def test_timeline_for_policy_orders_same_second_events_by_write_sequence(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
):
    user = await make_user(db_session)
    flight = await make_flight(db_session)
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)

    class FakeUuid:
        def __init__(self, hex_value: str):
            self.hex = hex_value

    generated_ids = iter(
        [
            FakeUuid("ffffffffffffffffffffffffffffffff"),
            FakeUuid("00000000000000000000000000000000"),
        ]
    )
    monkeypatch.setattr(evidence_models.uuid, "uuid4", lambda: next(generated_ids))
    monkeypatch.setattr(evidence_models.time, "time", lambda: 200)

    service = EvidenceService(db_session)
    first = await service.record_event(
        policy_id=policy.id,
        flight_id=flight.id,
        event_type="policy.created",
        title="first",
        source="user",
    )
    second = await service.record_event(
        policy_id=policy.id,
        flight_id=flight.id,
        event_type="contract.watched",
        title="second",
        source="contract",
    )

    timeline = await service.timeline_for_policy(user, policy.id)

    assert first.id > second.id
    assert [event.title for event in timeline.events] == ["first", "second"]
    assert [event.id for event in timeline.events] == [first.id, second.id]

    stored_events = (
        await db_session.execute(
            select(PolicyEvent)
            .where(PolicyEvent.policy_id == policy.id)
            .order_by(PolicyEvent.event_sequence.asc())
        )
    ).scalars().all()
    assert [event.event_sequence for event in stored_events] == [1, 2]


@pytest.mark.asyncio
async def test_timeline_for_policy_returns_empty_events_for_owned_policy_without_events(
    db_session: AsyncSession,
):
    user = await make_user(db_session)
    flight = await make_flight(db_session)
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)

    timeline = await EvidenceService(db_session).timeline_for_policy(user, policy.id)

    assert timeline.subject.policy_id == policy.id
    assert timeline.subject.flight_id == flight.id
    assert timeline.subject.claim_id is None
    assert timeline.events == []


@pytest.mark.asyncio
async def test_timeline_for_policy_hides_other_users_policy_as_not_found(db_session: AsyncSession):
    owner = await make_user(db_session, email="owner@example.com")
    viewer = await make_user(db_session, email="viewer@example.com")
    flight = await make_flight(db_session)
    policy = await _make_policy(db_session, user_id=owner.id, flight_id=flight.id)

    with pytest.raises(EvidenceNotFoundError):
        await EvidenceService(db_session).timeline_for_policy(viewer, policy.id)


@pytest.mark.asyncio
async def test_record_event_raises_not_found_for_missing_policy(db_session: AsyncSession):
    flight = await make_flight(db_session)

    with pytest.raises(EvidenceNotFoundError):
        await EvidenceService(db_session).record_event(
            policy_id="missing-policy",
            flight_id=flight.id,
            event_type="policy.created",
            title="保单不存在",
            source="engine",
        )

    stored = (await db_session.execute(select(PolicyEvent))).scalars().all()
    assert stored == []


@pytest.mark.asyncio
async def test_record_event_rejects_mismatched_flight_and_persists_nothing(db_session: AsyncSession):
    user = await make_user(db_session)
    policy_flight = await make_flight(db_session, callsign="BA178", date="20260614")
    other_flight = await make_flight(db_session, callsign="CA999", date="20260614")
    policy = await _make_policy(db_session, user_id=user.id, flight_id=policy_flight.id)

    with pytest.raises(EvidenceIntegrityError):
        await EvidenceService(db_session).record_event(
            policy_id=policy.id,
            flight_id=other_flight.id,
            event_type="policy.created",
            title="错误航班",
            source="engine",
        )

    stored = (await db_session.execute(select(PolicyEvent))).scalars().all()
    assert stored == []


@pytest.mark.asyncio
async def test_record_event_rejects_mismatched_claim_and_persists_nothing(db_session: AsyncSession):
    user = await make_user(db_session)
    first_flight = await make_flight(db_session, callsign="BA178", date="20260614")
    second_flight = await make_flight(db_session, callsign="CA999", date="20260614")
    first_policy = await _make_policy(db_session, user_id=user.id, flight_id=first_flight.id)
    second_policy = await _make_policy(db_session, user_id=user.id, flight_id=second_flight.id)
    first_claim = await _make_claim(db_session, policy_id=first_policy.id)

    with pytest.raises(EvidenceIntegrityError):
        await EvidenceService(db_session).record_event(
            policy_id=second_policy.id,
            flight_id=second_flight.id,
            claim_id=first_claim.id,
            event_type="claim.settled",
            title="错误赔付关联",
            source="engine",
        )

    stored = (await db_session.execute(select(PolicyEvent))).scalars().all()
    assert stored == []


@pytest.mark.asyncio
async def test_timeline_for_policy_degrades_malformed_payload_to_empty_dict(db_session: AsyncSession):
    user = await make_user(db_session)
    flight = await make_flight(db_session)
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)
    db_session.add(
        PolicyEvent(
            id="event-bad-payload",
            policy_id=policy.id,
            flight_id=flight.id,
            event_type="claim.settled",
            title="赔付完成",
            source="engine",
            payload_json="{bad json",
            created_at=123,
            event_sequence=1,
        )
    )
    await db_session.flush()

    timeline = await EvidenceService(db_session).timeline_for_policy(user, policy.id)

    assert timeline.events[0].payload == {}
