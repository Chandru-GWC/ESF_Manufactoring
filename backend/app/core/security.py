"""
Lightweight zero-dependency security helpers (PBKDF2-SHA256 + HS256 JWT)
for Enterprise EHS authentication.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from app.core.config import settings


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(encoded: str) -> bytes:
    padding = "=" * (-len(encoded) % 4)
    return base64.urlsafe_b64decode(encoded + padding)


def hash_password(password: str, salt: Optional[str] = None) -> str:
    use_salt = salt or secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        use_salt.encode("utf-8"),
        120_000,
    )
    return f"pbkdf2_sha256$120000${use_salt}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algo, iter_str, salt, expected_hex = stored_hash.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iter_str)
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        ).hex()
        return hmac.compare_digest(derived, expected_hex)
    except Exception:
        return False


def create_access_token(payload: Dict[str, Any], expires_minutes: int = 480) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = datetime.now(timezone.utc)
    claims = {
        **payload,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    signing_input = ".".join(
        [
            _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64url_encode(json.dumps(claims, separators=(",", ":")).encode("utf-8")),
        ]
    )
    secret = settings.effective_auth_secret.encode("utf-8")
    sig = hmac.new(secret, signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url_encode(sig)}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = hmac.new(
            settings.effective_auth_secret.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(_b64url_decode(sig_b64), expected_sig):
            return None
        claims = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        exp = claims.get("exp")
        if not isinstance(exp, int) or datetime.now(timezone.utc).timestamp() >= exp:
            return None
        return claims
    except Exception:
        return None

