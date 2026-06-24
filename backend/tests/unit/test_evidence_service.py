import json

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.evidence.service import EvidenceNotFoundError, EvidenceService
from backend.models import Policy, PolicyEvent, PolicyStatus
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


@pytest.mark.asyncio
async def test_record_event_persists_policy_event(db_session: AsyncSession):
    user = await make_user(db_session)
    flight = await make_flight(db_session)
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)

    event = await EvidenceService(db_session).record_event(
        policy_id=policy.id,
        flight_id=flight.id,
        claim_id="claim-123",
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
    assert stored.claim_id == "claim-123"
    assert stored.event_type == "observation.received"
    assert stored.title == "收到观测"
    assert stored.source == "engine"
    assert json.loads(stored.payload_json) == {"delay_minutes": 45, "threshold_minutes": 30}
    assert stored.created_at > 0


@pytest.mark.asyncio
async def test_timeline_for_policy_orders_by_created_at_then_id(db_session: AsyncSession):
    user = await make_user(db_session)
    flight = await make_flight(db_session)
    policy = await _make_policy(db_session, user_id=user.id, flight_id=flight.id)

    db_session.add_all(
        [
            PolicyEvent(
                id="event-b",
                policy_id=policy.id,
                flight_id=flight.id,
                event_type="contract.watched",
                title="B",
                source="contract",
                payload_json="{}",
                created_at=200,
            ),
            PolicyEvent(
                id="event-a",
                policy_id=policy.id,
                flight_id=flight.id,
                event_type="policy.created",
                title="A",
                source="user",
                payload_json="{}",
                created_at=200,
            ),
            PolicyEvent(
                id="event-z",
                policy_id=policy.id,
                flight_id=flight.id,
                event_type="policy.created",
                title="Z",
                source="user",
                payload_json="{}",
                created_at=100,
            ),
        ]
    )
    await db_session.flush()

    timeline = await EvidenceService(db_session).timeline_for_policy(user, policy.id)

    assert [event.id for event in timeline.events] == ["event-z", "event-a", "event-b"]


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
        )
    )
    await db_session.flush()

    timeline = await EvidenceService(db_session).timeline_for_policy(user, policy.id)

    assert timeline.events[0].payload == {}
