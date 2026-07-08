from backend.config import Settings


def test_demo_defaults_keep_dev_login_enabled_without_env_file(monkeypatch):
    monkeypatch.delenv("DEV_LOGIN_ENABLED", raising=False)

    settings = Settings(_env_file=None)

    assert settings.dev_login_enabled is True


def test_pool_simulator_defaults(monkeypatch):
    monkeypatch.delenv("POOL_SIMULATOR_ENABLED", raising=False)
    monkeypatch.delenv("POOL_SIMULATOR_INTERVAL_MIN", raising=False)
    monkeypatch.delenv("POOL_SIMULATOR_INTERVAL_MAX", raising=False)
    monkeypatch.delenv("POOL_MAX_POLICIES_PER_POOL", raising=False)

    settings = Settings(_env_file=None)

    assert settings.pool_simulator_enabled is True
    assert settings.pool_simulator_interval_min == 8
    assert settings.pool_simulator_interval_max == 15
    assert settings.pool_max_policies_per_pool == 100
