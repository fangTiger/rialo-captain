import json
import logging
import re

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.auth.google import GoogleProfile
from backend.auth.service import UserService
from backend.claims.engine import ClaimEngine
from backend.contracts.base import (
    ClaimPayload,
    ContractRef,
    ReactiveContractAdapter,
    TxResult,
)
from backend.evidence.service import EvidenceService
from backend.models import Claim, FailedTrigger, Policy, PolicyEvent, PolicyStatus, User
from backend.tests.factories import make_flight


class FakeAdapter(ReactiveContractAdapter):
    def __init__(self, *, observation: dict | None = None, raise_on_fetch: Exception | None = None):
        self._observation = observation or {}
        self._raise_on_fetch = raise_on_fetch
        self.trigger_calls: list[tuple[ContractRef, ClaimPayload]] = []

    async def watch(self, policy_id, flight_id, condition):
        return ContractRef(id=f"mock-{policy_id}", mode="mock")

    async def fetch_external(self, url: str) -> dict:
        if self._raise_on_fetch is not None:
            raise self._raise_on_fetch
        return dict(self._observation)

    async def trigger_claim(self, contract_ref, payload):
        self.trigger_calls.append((contract_ref, payload))
        return TxResult(signature="0x" + "f" * 64, settle_duration_ms=42)

    async def get_signature(self, tx):
        return tx.signature


def _now() -> int:
    return 1_700_000_000


def _session_factory(db_session: AsyncSession):
    return async_sessionmaker(db_session.bind, expire_on_commit=False)


async def _policy_events(db_session: AsyncSession, policy_id: str) -> list[PolicyEvent]:
    return (
        await db_session.execute(
            select(PolicyEvent)
            .where(PolicyEvent.policy_id == policy_id)
            .order_by(
                PolicyEvent.created_at.asc(),
                PolicyEvent.event_sequence.asc(),
                PolicyEvent.id.asc(),
            )
        )
    ).scalars().all()


async def _seed_policy(db_session, callsign: str = "BA178") -> Policy:
    users = UserService(db_session)
    user = await users.create_or_get(
        GoogleProfile(sub=f"s-{callsign}", email="e@x", name="n", avatar_url="")
    )
    flight = await make_flight(db_session, callsign=callsign, date="20260614")
    policy = Policy(
        user_id=user.id,
        flight_id=flight.id,
        premium=10,
        payout=80,
        condition_json=json.dumps({"type": "delay", "threshold_min": 30}),
        status=PolicyStatus.ACTIVE,
        contract_ref=f"mock-seed-{callsign}",
    )
    db_session.add(policy)
    await db_session.flush()
    return policy


@pytest.mark.asyncio
async def test_run_once_triggers_claim_when_delay_exceeds_threshold(db_session: AsyncSession):
    await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45})
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    summary = await engine.run_once()

    assert summary.triggered == 1
    assert summary.failed == 0
    assert summary.checked == 1
    assert len(adapter.trigger_calls) == 1


@pytest.mark.asyncio
async def test_run_for_flight_only_triggers_target_active_policies(db_session: AsyncSession):
    target = await _seed_policy(db_session, callsign="BA178")
    other = await _seed_policy(db_session, callsign="DL101")
    target_id = target.id
    target_flight_id = target.flight_id
    other_id = other.id
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45})
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    summary = await engine.run_for_flight(target_flight_id)

    assert summary.checked == 1
    assert summary.triggered == 1
    assert summary.failed == 0
    assert len(adapter.trigger_calls) == 1

    target_after = await db_session.get(Policy, target_id)
    other_after = await db_session.get(Policy, other_id)
    assert target_after is not None
    assert other_after is not None
    await db_session.refresh(target_after)
    await db_session.refresh(other_after)
    assert target_after.status == PolicyStatus.PAID
    assert other_after.status == PolicyStatus.ACTIVE


@pytest.mark.asyncio
async def test_run_for_flight_logs_checked_policy_count(
    db_session: AsyncSession,
    caplog: pytest.LogCaptureFixture,
):
    policy = await _seed_policy(db_session, callsign="BA178")
    flight_id = policy.flight_id
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45})
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    with caplog.at_level(logging.INFO, logger="backend.claims.engine"):
        await engine.run_for_flight(flight_id)

    assert f"checking flight={flight_id} policies=1" in caplog.text


@pytest.mark.asyncio
async def test_run_once_logs_triggered_settled_and_landed(
    db_session: AsyncSession,
    caplog: pytest.LogCaptureFixture,
):
    policy = await _seed_policy(db_session, callsign="BA178")
    policy_id = policy.id
    flight_id = policy.flight_id
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45})

    captured: list[dict] = []

    class FakeBroadcaster:
        async def broadcast(self, message: dict) -> None:
            captured.append(message)

        async def send_to_user(self, user_id: str, message: dict) -> None:
            pass

    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        broadcaster=FakeBroadcaster(),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    with caplog.at_level(logging.INFO, logger="backend.claims.engine"):
        await engine.run_once()

    settled = next(event for event in captured if event["type"] == "claim.settled")
    assert f"triggered policy={policy_id} delay=45" in caplog.text
    assert f"settled policy={policy_id} tx={settled['payload']['tx_hash']}" in caplog.text
    assert f"landed flight={flight_id}" in caplog.text


@pytest.mark.asyncio
async def test_run_once_no_trigger_when_below_threshold(db_session: AsyncSession):
    await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 5})
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )
    summary = await engine.run_once()
    assert summary.triggered == 0
    assert summary.checked == 1
    assert adapter.trigger_calls == []


@pytest.mark.asyncio
async def test_run_once_does_not_broadcast_claim_triggered_when_below_threshold(
    db_session: AsyncSession,
):
    await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 5, "source": "opensky"})

    captured: list[dict] = []

    class FakeBroadcaster:
        async def broadcast(self, message: dict) -> None:
            captured.append(message)

        async def send_to_user(self, user_id: str, message: dict) -> None:
            pass

    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        broadcaster=FakeBroadcaster(),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    summary = await engine.run_once()

    assert summary.triggered == 0
    assert "claim.triggered" not in [event["type"] for event in captured]
    assert captured == []


@pytest.mark.asyncio
async def test_run_once_isolates_single_failure(db_session: AsyncSession):
    await _seed_policy(db_session, callsign="BA178")
    await _seed_policy(db_session, callsign="DL101")
    await _seed_policy(db_session, callsign="UA200")
    await db_session.commit()

    class FlakyAdapter(FakeAdapter):
        def __init__(self):
            super().__init__(observation={"delay_minutes": 45})

        async def fetch_external(self, url: str) -> dict:
            if "DL101" in url:
                raise RuntimeError("boom")
            return await super().fetch_external(url)

    adapter = FlakyAdapter()
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    summary = await engine.run_once()
    assert summary.checked == 3
    assert summary.triggered == 2
    assert summary.failed == 1
    from sqlalchemy import select

    failed = (await db_session.execute(select(FailedTrigger))).scalars().all()
    assert any("boom" in f.error_text for f in failed)


@pytest.mark.asyncio
async def test_run_once_broadcasts_flare_when_triggered(db_session: AsyncSession):
    policy = await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45})

    captured: list[dict] = []
    toasts: list[tuple[str, dict]] = []

    class FakeBroadcaster:
        async def broadcast(self, message: dict) -> None:
            captured.append(message)

        async def send_to_user(self, user_id: str, message: dict) -> None:
            toasts.append((user_id, message))

    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        broadcaster=FakeBroadcaster(),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )
    summary = await engine.run_once()
    assert summary.triggered == 1
    flare = next(event for event in captured if event["type"] == "flare")
    assert flare["type"] == "flare"
    assert flare["payload"]["flight_id"] == policy.flight_id
    assert flare["payload"]["payout"] == policy.payout
    assert flare["payload"]["signature"].startswith("0x")
    # 同时给保单持有者发 toast
    assert len(toasts) == 1
    user_id, toast = toasts[0]
    assert user_id == policy.user_id
    assert toast["type"] == "toast"
    assert "RIA" in toast["payload"]


@pytest.mark.asyncio
async def test_run_once_broadcasts_claim_triggered_before_settlement(
    db_session: AsyncSession,
):
    policy = await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45, "source": "opensky"})

    captured: list[dict] = []

    class FakeBroadcaster:
        async def broadcast(self, message: dict) -> None:
            captured.append(message)

        async def send_to_user(self, user_id: str, message: dict) -> None:
            pass

    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        broadcaster=FakeBroadcaster(),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    summary = await engine.run_once()

    assert summary.triggered == 1
    event_types = [event["type"] for event in captured]
    assert "claim.triggered" in event_types
    assert event_types.index("claim.triggered") < event_types.index("claim.settled")
    triggered = next(event for event in captured if event["type"] == "claim.triggered")
    assert triggered["payload"] == {
        "flight_id": policy.flight_id,
        "policy_id": policy.id,
        "delay_minutes": 45,
        "source": "opensky",
        "airport_iata": "JFK",
    }


@pytest.mark.asyncio
async def test_run_once_broadcasts_claim_settled_with_mock_chain_fields(
    db_session: AsyncSession,
):
    first = await _seed_policy(db_session, callsign="BA178")
    second = await _seed_policy(db_session, callsign="DL101")
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45})

    captured: list[dict] = []

    class FakeBroadcaster:
        async def broadcast(self, message: dict) -> None:
            captured.append(message)

        async def send_to_user(self, user_id: str, message: dict) -> None:
            pass

    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        broadcaster=FakeBroadcaster(),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    summary = await engine.run_once()

    assert summary.triggered == 2
    flare_events = [event for event in captured if event["type"] == "flare"]
    settled_events = [event for event in captured if event["type"] == "claim.settled"]
    assert [event["payload"]["policy_id"] for event in flare_events] == [first.id, second.id]
    assert [event["payload"]["policy_id"] for event in settled_events] == [first.id, second.id]
    assert [event["payload"]["block_height"] for event in settled_events] == [1, 2]
    for event in settled_events:
        payload = event["payload"]
        assert payload["flight_id"]
        assert payload["payout"] == 80
        assert payload["delay_minutes"] == 45
        assert payload["signature"].startswith("0x")
        assert re.fullmatch(r"0x[0-9a-f]{40}", payload["tx_hash"])
        assert payload["source"] == "mock"


@pytest.mark.asyncio
async def test_run_once_broadcasts_flight_landed_after_settlement(
    db_session: AsyncSession,
):
    policy = await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45})

    captured: list[dict] = []

    class FakeBroadcaster:
        async def broadcast(self, message: dict) -> None:
            captured.append(message)

        async def send_to_user(self, user_id: str, message: dict) -> None:
            pass

    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        broadcaster=FakeBroadcaster(),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    summary = await engine.run_once()

    assert summary.triggered == 1
    event_types = [event["type"] for event in captured]
    assert event_types.index("claim.settled") < event_types.index("flight.landed")
    landed = next(event for event in captured if event["type"] == "flight.landed")
    assert landed["payload"] == {
        "flight_id": policy.flight_id,
        "policy_id": policy.id,
        "landed_at": _now(),
        "source": "mock",
    }


@pytest.mark.asyncio
async def test_run_once_keeps_existing_settlement_event_payload_shapes(
    db_session: AsyncSession,
):
    await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45, "source": "opensky"})

    captured: list[dict] = []

    class FakeBroadcaster:
        async def broadcast(self, message: dict) -> None:
            captured.append(message)

        async def send_to_user(self, user_id: str, message: dict) -> None:
            pass

    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        broadcaster=FakeBroadcaster(),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    await engine.run_once()

    flare = next(event for event in captured if event["type"] == "flare")
    settled = next(event for event in captured if event["type"] == "claim.settled")
    landed = next(event for event in captured if event["type"] == "flight.landed")
    assert set(flare["payload"]) == {
        "flight_id",
        "policy_id",
        "payout",
        "delay_minutes",
        "signature",
        "settle_duration_ms",
    }
    assert set(settled["payload"]) == {
        "flight_id",
        "policy_id",
        "payout",
        "delay_minutes",
        "signature",
        "settle_duration_ms",
        "tx_hash",
        "block_height",
        "source",
    }
    assert set(landed["payload"]) == {
        "flight_id",
        "policy_id",
        "landed_at",
        "source",
    }


@pytest.mark.asyncio
async def test_run_once_records_evidence_events_in_settlement_order(
    db_session: AsyncSession,
):
    policy = await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45, "source": "opensky"})
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    summary = await engine.run_once()

    assert summary.triggered == 1
    events = await _policy_events(db_session, policy.id)
    assert [event.event_type for event in events] == [
        "observation.received",
        "condition.matched",
        "claim.triggered",
        "claim.settled",
        "balance.credited",
        "flight.landed",
    ]

    observation_payload = json.loads(events[0].payload_json)
    condition_payload = json.loads(events[1].payload_json)
    triggered_payload = json.loads(events[2].payload_json)
    settled_payload = json.loads(events[3].payload_json)
    balance_payload = json.loads(events[4].payload_json)
    landed_payload = json.loads(events[5].payload_json)

    assert observation_payload == {
        "delay_minutes": 45,
        "source": "opensky",
    }
    assert condition_payload == {
        "delay_minutes": 45,
        "threshold_minutes": 30,
    }
    assert triggered_payload == {
        "delay_minutes": 45,
    }
    assert events[3].claim_id is not None
    assert settled_payload["payout"] == 80
    assert settled_payload["signature"].startswith("0x")
    assert re.fullmatch(r"0x[0-9a-f]{40}", settled_payload["tx_hash"])
    assert settled_payload["settle_duration_ms"] == 42
    assert balance_payload == {
        "payout": 80,
        "balance_after": 1080,
    }
    assert landed_payload == {
        "landed_at": _now(),
        "source": "mock",
    }


@pytest.mark.asyncio
async def test_run_once_records_only_observation_evidence_below_threshold(
    db_session: AsyncSession,
):
    policy = await _seed_policy(db_session)
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 5, "source": "opensky"})
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    summary = await engine.run_once()

    assert summary.triggered == 0
    events = await _policy_events(db_session, policy.id)
    assert [event.event_type for event in events] == ["observation.received"]
    assert json.loads(events[0].payload_json) == {
        "delay_minutes": 5,
        "source": "opensky",
    }


@pytest.mark.asyncio
async def test_run_once_keeps_successful_settlement_when_evidence_write_fails(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
):
    policy = await _seed_policy(db_session)
    policy_id = policy.id
    user_id = policy.user_id
    await db_session.commit()
    adapter = FakeAdapter(observation={"delay_minutes": 45, "source": "opensky"})
    engine = ClaimEngine(
        adapter=adapter,
        session_factory=_session_factory(db_session),
        observe_url=lambda fid: f"https://opensky.test/state/{fid}",
        now=_now,
    )

    async def fail_record_event(self, **kwargs):
        raise RuntimeError("evidence boom")

    monkeypatch.setattr(EvidenceService, "record_event", fail_record_event)

    with caplog.at_level(logging.ERROR, logger="backend.claims.engine"):
        summary = await engine.run_once()

    assert summary.checked == 1
    assert summary.triggered == 1
    assert summary.failed == 0
    assert "证据事件写入失败" in caplog.text

    policy_after = await db_session.get(Policy, policy_id)
    user_after = await db_session.get(User, user_id)
    assert policy_after is not None
    assert user_after is not None
    await db_session.refresh(policy_after)
    await db_session.refresh(user_after)
    assert policy_after.status == PolicyStatus.PAID
    assert user_after.balance == 1080

    claims = (await db_session.execute(select(Claim))).scalars().all()
    assert len(claims) == 1
