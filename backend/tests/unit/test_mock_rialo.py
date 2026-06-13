import hashlib

import httpx
import pytest

from backend.contracts.base import ClaimPayload, Condition, ConditionType
from backend.contracts.mock_rialo import MockRialoAdapter


@pytest.mark.asyncio
async def test_watch_returns_mock_contract_ref():
    adapter = MockRialoAdapter()
    try:
        ref = await adapter.watch(
            policy_id="p1",
            flight_id="BA178-20260613",
            condition=Condition(type=ConditionType.DELAY, threshold_min=30),
        )
    finally:
        await adapter.aclose()
    assert ref.mode == "mock"
    assert ref.id == "mock-p1"


@pytest.mark.asyncio
async def test_fetch_external_calls_httpx():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ok": True, "url": str(request.url)})

    transport = httpx.MockTransport(handler)
    adapter = MockRialoAdapter(transport=transport)
    try:
        data = await adapter.fetch_external("https://example.test/x")
    finally:
        await adapter.aclose()
    assert data["ok"] is True


@pytest.mark.asyncio
async def test_trigger_claim_generates_signature():
    adapter = MockRialoAdapter()
    try:
        ref = await adapter.watch(
            policy_id="p2",
            flight_id="DL101-20260613",
            condition=Condition(type=ConditionType.DELAY, threshold_min=30),
        )
        tx = await adapter.trigger_claim(ref, ClaimPayload(delay_minutes=45, observed_at=1700000000))
    finally:
        await adapter.aclose()
    assert tx.signature.startswith("0x")
    assert len(tx.signature) == 66
    assert tx.settle_duration_ms >= 0


@pytest.mark.asyncio
async def test_get_signature_returns_tx_signature():
    adapter = MockRialoAdapter()
    try:
        ref = await adapter.watch(
            policy_id="p3",
            flight_id="x-20260613",
            condition=Condition(type=ConditionType.DELAY, threshold_min=30),
        )
        tx = await adapter.trigger_claim(ref, ClaimPayload(delay_minutes=45, observed_at=1700000000))
        sig = await adapter.get_signature(tx)
    finally:
        await adapter.aclose()
    assert sig == tx.signature


@pytest.mark.asyncio
async def test_signature_is_deterministic_for_same_inputs():
    adapter = MockRialoAdapter(nonce_source=lambda: 42)
    try:
        ref = await adapter.watch(
            policy_id="p4",
            flight_id="x-20260613",
            condition=Condition(type=ConditionType.DELAY, threshold_min=30),
        )
        tx1 = await adapter.trigger_claim(ref, ClaimPayload(delay_minutes=45, observed_at=1700000000))
        tx2 = await adapter.trigger_claim(ref, ClaimPayload(delay_minutes=45, observed_at=1700000000))
    finally:
        await adapter.aclose()
    expected = "0x" + hashlib.sha256(b"mock-p4|45|1700000000|42").hexdigest()
    assert tx1.signature == expected
    assert tx2.signature == expected
