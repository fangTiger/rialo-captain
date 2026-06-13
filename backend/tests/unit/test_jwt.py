import time

import pytest

from backend.auth.jwt import JWTError, decode_session, encode_session


def test_encode_decode_roundtrip():
    token = encode_session(user_id="u123", ttl_hours=1)
    payload = decode_session(token)
    assert payload["sub"] == "u123"
    assert payload["exp"] > int(time.time())


def test_decode_rejects_garbage():
    with pytest.raises(JWTError):
        decode_session("not-a-token")


def test_decode_rejects_expired_token():
    token = encode_session(user_id="u123", ttl_hours=-1)
    with pytest.raises(JWTError):
        decode_session(token)
