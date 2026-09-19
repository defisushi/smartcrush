from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from ``backend/.env`` or the environment."""

    NANSEN_API_KEY: str = ""
    NANSEN_BASE_URL: str = "https://api.nansen.ai"
    DB_PATH: str = "./data/nansen.db"
    POLL_INTERVAL_MINUTES: int = 15
    MOCK_NANSEN: bool = True
    COPYCATS_BACKGROUND: bool = True
    CREDIT_BUDGET_HOUR: int = 350

    model_config = SettingsConfigDict(
        env_file=(Path(__file__).resolve().parents[1] / ".env", Path(__file__).resolve().parents[2] / ".env.local", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
