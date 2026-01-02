from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    NPM_DATABASE_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Ollama
    OLLAMA_URL: str = "http://100.64.0.14:11434"
    OLLAMA_MODEL: str = "mistral:7b"

    # Sync
    SYNC_INTERVAL_MINUTES: int = 5

    # Redis cache
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_ENABLED: bool = True
    REDIS_CACHE_TTL: int = 30  # Default TTL in seconds

    # WebSocket
    WS_ENABLED: bool = True
    WS_HEARTBEAT_INTERVAL: int = 30  # Heartbeat every 30 seconds

    # Webhooks
    WEBHOOK_BASE_URL: Optional[str] = None  # Base URL for webhook callbacks (e.g., https://api.example.com)

    # Application
    APP_NAME: str = "Dashboard Auto"
    APP_VERSION: str = "1.0.0"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
