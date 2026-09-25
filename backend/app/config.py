from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./tsp.db"
    secret_key: str = "change-this-secret-key-in-production"
    access_token_minutes: int = 1440
    cors_origins: str = "http://localhost:3000"
    upload_dir: str = "./uploads"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
