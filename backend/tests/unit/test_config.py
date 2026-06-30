from backend.config import Settings


def test_demo_defaults_keep_dev_login_enabled_without_env_file(monkeypatch):
    monkeypatch.delenv("DEV_LOGIN_ENABLED", raising=False)

    settings = Settings(_env_file=None)

    assert settings.dev_login_enabled is True
