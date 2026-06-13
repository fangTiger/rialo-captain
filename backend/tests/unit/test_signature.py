from backend.claims.signature import build_signature


def test_signature_format_is_0x_prefixed_64_hex():
    sig = build_signature(policy_id="p1", timestamp=1700000000, nonce=42)
    assert sig.startswith("0x")
    assert len(sig) == 66
    assert all(c in "0123456789abcdef" for c in sig[2:])


def test_signature_is_deterministic():
    a = build_signature(policy_id="p1", timestamp=1700000000, nonce=42)
    b = build_signature(policy_id="p1", timestamp=1700000000, nonce=42)
    assert a == b


def test_signature_changes_with_inputs():
    a = build_signature(policy_id="p1", timestamp=1700000000, nonce=42)
    b = build_signature(policy_id="p2", timestamp=1700000000, nonce=42)
    c = build_signature(policy_id="p1", timestamp=1700000001, nonce=42)
    d = build_signature(policy_id="p1", timestamp=1700000000, nonce=43)
    assert len({a, b, c, d}) == 4
