from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, String
from app.core.database import Base


class EhsUser(Base):
    """Enterprise operator account stored in Neon PostgreSQL ehs_core.users."""

    __tablename__ = "users"
    __table_args__ = {"schema": "ehs_core"}

    user_id = Column(String(40), primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=False)
    role = Column(String(40), nullable=False, default="safety_officer")
    plant_scope = Column(String(50), nullable=False, default="ALL")
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

