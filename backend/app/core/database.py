import time

from sqlalchemy import create_engine, event, exc
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

db_url = settings.DATABASE_URL
connect_args = {}

# Ensure postgresql+psycopg2 driver dialect is explicitly specified
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

if "postgresql" in db_url or "postgres" in db_url:
    if "sslmode" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"
    
    # The database is far away (every round trip costs ~0.5 s), so avoid needless ones:
    #  - no ping on every checkout (pool_pre_ping=True doubled the cost of each request); a connection is
    #    only verified when it has been idle for a while (see _ping_if_idle below);
    #  - TCP keepalives keep idle connections from being dropped silently.
    engine = create_engine(
        db_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=False,
        pool_recycle=240,
        connect_args={
            "connect_timeout": 15,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 3,
        },
        echo=False
    )

    _IDLE_PING_SECONDS = 20

    @event.listens_for(engine, "checkout")
    def _ping_if_idle(dbapi_conn, connection_record, connection_proxy):
        last = connection_record.info.get("last_used", 0.0)
        if time.monotonic() - last > _IDLE_PING_SECONDS and not engine.dialect.do_ping(dbapi_conn):
            raise exc.DisconnectionError("stale connection, reconnecting")

    @event.listens_for(engine, "checkin")
    def _mark_used(dbapi_conn, connection_record):
        connection_record.info["last_used"] = time.monotonic()
else:
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        db_url or "sqlite:///./ehs_dev.db",
        connect_args=connect_args,
        echo=False
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
