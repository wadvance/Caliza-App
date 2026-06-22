from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "Caliza Explorer API"
    DEBUG: bool = True

    DATABASE_URL: str = "postgresql+asyncpg://caliza:caliza_secret_2026@db:5432/caliza_explorer"
    DATABASE_SYNC_URL: str = "postgresql://caliza:caliza_secret_2026@db:5432/caliza_explorer"

    REDIS_URL: str = "redis://redis:6379/0"

    SECRET_KEY: str = "caliza-explorer-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    S3_ENDPOINT: str = "http://minio:9000"
    S3_ACCESS_KEY: str = "caliza"
    S3_SECRET_KEY: str = "minio_secret_2026"
    S3_BUCKET: str = "caliza-uploads"
    S3_REGION: str = "us-east-1"

    SENTRY_DSN: str = ""

    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
