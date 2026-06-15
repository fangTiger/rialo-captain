import json
import re

import pytest
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
from backend.models import FailedTrigger, Policy, PolicyStatus
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
