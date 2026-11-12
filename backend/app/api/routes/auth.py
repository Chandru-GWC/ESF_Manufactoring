from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import engine, get_db
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.models.user import EhsUser

router = APIRouter(prefix="/auth", tags=["Authentication"])

_USERS_TABLE_ENSURED: set[int] = set()


class LoginRequest(BaseModel):
    email: str
    password: str


class UserProfile(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    plant_scope: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


def _ensure_users_table_and_seed(db: Session) -> None:
    eng_id = id(engine)
    if eng_id not in _USERS_TABLE_ENSURED:
        EhsUser.__table__.create(bind=engine, checkfirst=True)
        _USERS_TABLE_ENSURED.add(eng_id)

    seed_email = (os.getenv("EHS_OPERATOR_EMAIL") or "safety.director@ehs-enterprise.local").strip().lower()
    seed_password = os.getenv("EHS_OPERATOR_PASSWORD") or "EhsSafety#2026"

    existing = db.query(EhsUser).filter(EhsUser.email == seed_email).first()
    if not existing:
        user = EhsUser(
            user_id="USR-EHS-001",
            email=seed_email,
            full_name="Plant Safety Director",
            role="safety_director",
            plant_scope="ALL",
            password_hash=hash_password(seed_password),
            is_active=True,
        )
        db.add(user)
        db.commit()


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.strip().split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    _ensure_users_table_and_seed(db)
    email_clean = (payload.email or "").strip().lower()
    if not email_clean or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    user = db.query(EhsUser).filter(EhsUser.email == email_clean).first()
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid enterprise safety credentials.")

    token = create_access_token(
        {
            "sub": user.user_id,
            "email": user.email,
            "role": user.role,
            "plant_scope": user.plant_scope,
        }
    )
    return LoginResponse(
        access_token=token,
        user=UserProfile(
            user_id=user.user_id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            plant_scope=user.plant_scope,
        ),
    )


@router.get("/me", response_model=UserProfile)
def get_current_profile(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    _ensure_users_table_and_seed(db)
    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication bearer token required.")
    claims = decode_access_token(token)
    if not claims or not claims.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")

    user = db.query(EhsUser).filter(EhsUser.user_id == claims["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account is inactive or unavailable.")

    return UserProfile(
        user_id=user.user_id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        plant_scope=user.plant_scope,
    )

