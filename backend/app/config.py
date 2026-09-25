from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """تنظیمات فقط از محیط یا فایل .env خوانده می‌شود."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = f"sqlite:///{(BACKEND_DIR / 'tsp.db').as_posix()}"
    secret_key: str = "dev-only-change-me-tsp-v03-not-for-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cors_origin_regex: str = r"https://.*\.e2b\.app"

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
