from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./rialo.db"
    jwt_secret: str = "change-me-in-prod-32-chars-min"
    jwt_cookie_name: str = "rialo_session"
    jwt_ttl_hours: int = 720
    cookie_secure: bool = False
    dev_login_enabled: bool = True
    google_client_id: str = ""
    rialo_mode: str = "mock"
    admin_token: str = "local-dev-admin-token"
    cinema_autoseed_enabled: bool = True
    opensky_base_url: str = "https://opensky-network.org/api"
    opensky_enabled: bool = True
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-v4-pro"
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_timeout_seconds: float = 20.0
    pool_simulator_enabled: bool = True
    pool_simulator_interval_min: int = 8
    pool_simulator_interval_max: int = 15
    pool_max_policies_per_pool: int = 100
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
