import pytest

from backend.auth import google


@pytest.fixture
def fake_google_payload(monkeypatch):
    def _fake(id_token: str, request, audience: str):
        if id_token == "valid":
            return {
                "sub": "google-sub-123",
                "email": "alice@example.com",
                "name": "Alice",
                "picture": "https://lh3.googleusercontent.com/a/x",
            }
        raise ValueError("Invalid token")

    monkeypatch.setattr(google.id_token, "verify_oauth2_token", _fake)


def test_verify_returns_profile_for_valid_token(fake_google_payload):
    profile = google.verify_id_token("valid")
    assert profile.sub == "google-sub-123"
    assert profile.email == "alice@example.com"
    assert profile.name == "Alice"
    assert profile.avatar_url.startswith("https://")


def test_verify_returns_none_for_invalid_token(fake_google_payload):
    assert google.verify_id_token("garbage") is None
