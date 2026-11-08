
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
import app.core.dns_patch  # noqa: F401


# backend/.env
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    app_name: str = "LedgerLine"
    app_env: str = "development"

    database_url: str
    migration_database_url: str
    session_ttl_hours: int = 24

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()
