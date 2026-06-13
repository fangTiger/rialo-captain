from backend.contracts.base import (
    ReactiveContractAdapter,
    Condition,
    ConditionType,
    ContractRef,
    ClaimPayload,
    TxResult,
)


def test_condition_type_enum_has_delay():
    assert ConditionType.DELAY.value == "delay"


def test_condition_is_triggered_by_delay():
    cond = Condition(type=ConditionType.DELAY, threshold_min=30)
    assert cond.is_triggered({"delay_minutes": 45}) is True
    assert cond.is_triggered({"delay_minutes": 10}) is False
    assert cond.is_triggered({}) is False


def test_contract_ref_carries_id():
    ref = ContractRef(id="mock-policy-1", mode="mock")
    assert ref.id == "mock-policy-1"
    assert ref.mode == "mock"


def test_tx_result_has_signature_and_settle_time():
    tx = TxResult(signature="0x" + "a" * 64, settle_duration_ms=1234)
    assert tx.signature.startswith("0x")
    assert tx.settle_duration_ms == 1234


def test_claim_payload_carries_delay():
    payload = ClaimPayload(delay_minutes=45, observed_at=1700000000)
    assert payload.delay_minutes == 45


def test_adapter_protocol_has_required_methods():
    methods = [m for m in dir(ReactiveContractAdapter) if not m.startswith("_")]
    for required in ("watch", "fetch_external", "trigger_claim", "get_signature"):
        assert required in methods, f"Protocol missing {required}"
