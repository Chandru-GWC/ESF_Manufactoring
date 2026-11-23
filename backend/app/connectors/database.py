"""
Dedicated Database Connection Configuration for EHS Resource & Database Connector Management.

Architectural Guarantees:
1. Complete isolation: Operates on a dedicated database (ehs_connector_db) completely separate
   from the primary EHS application database (neondb).
2. Separate connection pool, lifecycle management, error handling, and health probes.
3. Isolated declarative base (`ConnectorBase`) ensuring connector schema migrations and DDL
   never interfere with or mix into primary EHS application tables.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger("ehs.connectors.db")

# ---------------------------------------------------------------------------
# Engine & Pool Setup
# ---------------------------------------------------------------------------

_raw_url = settings.effective_connector_db_url

# Ensure postgresql+psycopg2 driver dialect is explicitly specified for PostgreSQL URLs
if _raw_url.startswith("postgresql://"):
    _db_url = _raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)
else:
    _db_url = _raw_url

if "postgresql" in _db_url or "postgres" in _db_url:
    if "sslmode" not in _db_url:
        separator = "&" if "?" in _db_url else "?"
        _db_url = f"{_db_url}{separator}sslmode=require"

    connector_engine = create_engine(
        _db_url,
        pool_size=settings.CONNECTOR_DB_POOL_SIZE,
        max_overflow=settings.CONNECTOR_DB_MAX_OVERFLOW,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=False,
    )
else:
    # SQLite local development / test engine
    connector_engine = create_engine(
        _db_url or "sqlite:///./ehs_connector_dev.db",
        connect_args={"check_same_thread": False},
        echo=False,
    )

ConnectorSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=connector_engine)

# Independent declarative base for all connector models
ConnectorBase = declarative_base()


# ---------------------------------------------------------------------------
# Dependency & Lifecycle
# ---------------------------------------------------------------------------

def get_connector_db() -> Generator[Session, None, None]:
    """FastAPI Dependency providing a database session bound strictly to the Connector DB."""
    db = ConnectorSessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_connector_db() -> None:
    """Ensure all connector management tables exist in the dedicated Connector Database."""
    try:
        import app.models.connector  # noqa: F401 - register models with ConnectorBase
        ConnectorBase.metadata.create_all(bind=connector_engine)
        logger.info("Successfully verified connector database tables in separate DB.")
    except Exception as e:
        logger.error(f"Failed to initialize connector database tables: {e}", exc_info=True)
        raise


def check_connector_db_health() -> Dict[str, Any]:
    """
    Perform a health check on the dedicated Connector Database.
    Returns connectivity status, latency, pool metrics, and driver dialect.
    """
    t0 = time.perf_counter()
    pool = connector_engine.pool
    pool_stats = {
        "size": getattr(pool, "size", lambda: None)(),
        "checked_in": getattr(pool, "checkedin", lambda: None)(),
        "checked_out": getattr(pool, "checkedout", lambda: None)(),
        "overflow": getattr(pool, "overflow", lambda: None)(),
    }

    try:
        with connector_engine.connect() as conn:
            res = conn.execute(text("SELECT 1")).scalar()
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            db_name_res = conn.execute(text("SELECT current_database()")).scalar() if connector_engine.dialect.name == "postgresql" else "sqlite"
            return {
                "healthy": res == 1,
                "status": "ONLINE",
                "database_name": db_name_res,
                "dialect": connector_engine.dialect.name,
                "latency_ms": latency_ms,
                "pool": pool_stats,
            }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        return {
            "healthy": False,
            "status": "OFFLINE",
            "error": str(e),
            "dialect": connector_engine.dialect.name,
            "latency_ms": latency_ms,
            "pool": pool_stats,
        }
