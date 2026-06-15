from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./rialo.db"
    jwt_secret: str = "change-me-in-prod-32-chars-min"
    jwt_cookie_name: str = "rialo_session"
    jwt_ttl_hours: int = 720
    cookie_secure: bool = False
    dev_login_enabled: bool = False
    google_client_id: str = ""
    rialo_mode: str = "mock"
    admin_token: str = "local-dev-admin-token"
    cinema_autoseed_enabled: bool = True
    opensky_base_url: str = "https://opensky-network.org/api"
    opensky_enabled: bool = True
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
