from sqlalchemy import create_engine
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
    
    engine = create_engine(
        db_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=False
    )
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
