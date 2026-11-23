import hashlib
import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Root directory of backend
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
ENV_FILE = os.path.join(BACKEND_DIR, ".env")


class Settings(BaseSettings):
    PROJECT_NAME: str = "EHS & Safety AI Platform"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Background alert engine: syncs event-derived alerts and sends reminders/escalations (in-app only).
    EHS_ALERT_SCHEDULER: bool = True
    EHS_ALERT_CYCLE_SECONDS: int = 60

    # Read from backend/.env directly
    DATABASE_URL: str = ""
    DB_SCHEMA: str = "ehs_core"

    # Dedicated separate database for Resource & Database Connector Management
    CONNECTOR_DATABASE_URL: str = ""
    CONNECTOR_ENCRYPTION_KEY: str = ""
    CONNECTOR_DB_POOL_SIZE: int = 5
    CONNECTOR_DB_MAX_OVERFLOW: int = 10

    # CORS
    # Vite dev (3000), Vite default (5173) and Vite preview (4173). Override via CORS_ORIGINS env.
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:4173,http://127.0.0.1:4173"
    )

    # DomoGPT Text Generation API Configuration (loaded from backend/.env)
    DOMO_BASE_URL: str = "https://gwcteq-partner.domo.com"
    DOMO_AI_ENDPOINT: str = "/api/ai/v1/text/generation"
    DOMO_AI_MODEL: str = "domo.domo_ai.domogpt-large-v2.2:anthropic"
    DOMO_DEVELOPER_TOKEN: str = ""
    DOMO_TIMEOUT_SECONDS: float = 45.0
    DOMO_MAX_RETRIES: int = 2

    @property
    def cors_origins_list(self) -> List[str]:
        origins = [o.strip() for o in (self.CORS_ORIGINS or "").split(",") if o.strip()]
        return origins or ["http://localhost:3000", "http://127.0.0.1:3000"]

    @property
    def effective_connector_db_url(self) -> str:
        """Dedicated connection URL for the separate Connector Database."""
        url = (self.CONNECTOR_DATABASE_URL or "").strip()
        if url:
            return url
        # Fallback to deriving from primary DATABASE_URL if PostgreSQL
        primary = (self.DATABASE_URL or "").strip()
        if "postgresql" in primary or "postgres" in primary:
            import re
            return re.sub(r"/neondb(\?|$)", r"/ehs_connector_db\1", primary)
        return "sqlite:///./ehs_connector_dev.db"

    @property
    def effective_connector_encryption_key(self) -> str:
        """Master encryption secret for connector credentials (AES-256-GCM)."""
        key = (self.CONNECTOR_ENCRYPTION_KEY or "").strip()
        if key:
            return key
        # Stable development fallback derived from the configured database (set CONNECTOR_ENCRYPTION_KEY in production).
        seed = (self.DATABASE_URL or self.DOMO_DEVELOPER_TOKEN or "ehs-local-dev-secret").encode("utf-8")
        return hashlib.sha256(seed).hexdigest()

    @property
    def domo_generation_url(self) -> str:
        base = (self.DOMO_BASE_URL or "").strip().rstrip("/")
        endpoint = "/" + (self.DOMO_AI_ENDPOINT or "").strip().lstrip("/")
        return f"{base}{endpoint}"

    @property
    def is_domo_configured(self) -> bool:
        token = (self.DOMO_DEVELOPER_TOKEN or "").strip()
        if not token:
            return False
        lowered = token.lower()
        return not any(marker in lowered for marker in ("your_domo", "placeholder", "changeme", "<token>"))

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")


settings = Settings()
