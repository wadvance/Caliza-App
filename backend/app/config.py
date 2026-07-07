from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    APP_NAME: str = "Caliza Explorer API"
    DEBUG: bool = True

    SECRET_KEY: str = "caliza-explorer-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Firebase
    FIREBASE_SERVICE_ACCOUNT_PATH: str = os.getenv(
        "GOOGLE_APPLICATION_CREDENTIALS", "firebase-service-account.json"
    )
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "")
    FIREBASE_STORAGE_BUCKET: str = os.getenv(
        "FIREBASE_STORAGE_BUCKET", ""
    )

    # Cloud Run / Cloud
    PORT: int = int(os.getenv("PORT", "8080"))

    SENTRY_DSN: str = ""
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
