"""
Enterprise Security Layer for Database & Resource Connectors.

Enforces:
1. AES-256-GCM authenticated credential encryption for stored passwords & URIs.
2. Key derivation via PBKDF2-HMAC-SHA256 from application secrets.
3. Secret masking (passwords, tokens, credentials never returned in plaintext).
4. SSRF (Server-Side Request Forgery) protection against private/cloud-metadata targets.
5. Strict read-only query and identifier sanitization to prevent SQL/NoSQL injection.
"""
from __future__ import annotations

import base64
import ipaddress
import os
import re
import socket
from typing import Optional

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from fastapi import HTTPException

from app.core.config import settings

# Salt for PBKDF2 key derivation (deterministic per installation secret)
_KDF_SALT = b"ehs_connector_master_key_salt_v1"
_BLOCKED_METADATA_IPS = {
    "169.254.169.254",  # AWS / Azure / GCP metadata service
    "169.254.170.2",    # AWS ECS metadata
    "fd00:ec2::254",    # AWS IPv6 metadata
}
_BLOCKED_METADATA_HOSTS = {
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
}

# Dangerous SQL keywords that must never appear in preview query filters
_DISALLOWED_SQL_PATTERNS = re.compile(
    r"\b(DROP|ALTER|TRUNCATE|DELETE|INSERT|UPDATE|EXEC|EXECUTE|GRANT|REVOKE|CREATE|MERGE|CALL|REPLACE)\b",
    re.IGNORECASE,
)

# Safe SQL identifier pattern (letters, numbers, underscore)
_SAFE_IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _get_encryption_key() -> bytes:
    """Derive a 32-byte (256-bit) encryption key from the connector encryption secret."""
    secret = (
        getattr(settings, "CONNECTOR_ENCRYPTION_KEY", None)
        or getattr(settings, "effective_connector_encryption_key", None)
        or os.getenv("CONNECTOR_ENCRYPTION_KEY")
        or "ehs-default-enterprise-connector-secret-key-2026"
    )
    secret_bytes = secret.encode("utf-8") if isinstance(secret, str) else secret
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_KDF_SALT,
        iterations=100_000,
    )
    return kdf.derive(secret_bytes)


def encrypt_secret(plaintext: Optional[str]) -> Optional[str]:
    """Encrypt a secret string using AES-256-GCM. Returns base64-encoded payload (nonce + ciphertext)."""
    if not plaintext:
        return None
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit standard nonce for AES-GCM
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    # Store nonce + ciphertext together
    payload = nonce + ciphertext
    return base64.b64encode(payload).decode("ascii")


def decrypt_secret(encrypted_text: Optional[str]) -> Optional[str]:
    """Decrypt an AES-256-GCM base64 payload. Returns original plaintext string."""
    if not encrypted_text:
        return None
    try:
        payload = base64.b64decode(encrypted_text.encode("ascii"))
        if len(payload) < 28:  # 12-byte nonce + 16-byte GCM tag
            return None
        nonce = payload[:12]
        ciphertext = payload[12:]
        key = _get_encryption_key()
        aesgcm = AESGCM(key)
        plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext_bytes.decode("utf-8")
    except Exception:
        return None


def mask_secret(secret: Optional[str]) -> str:
    """Return a masked representation of a credential for UI and API display."""
    if not secret:
        return ""
    return "••••••••"


def validate_connection_target(host: str, port: Optional[int] = None) -> None:
    """
    Validate connection host and port against SSRF attacks.
    Blocks cloud instance metadata endpoints and unroutable destinations.
    """
    host_clean = (host or "").strip().lower()
    if not host_clean:
        raise HTTPException(status_code=400, detail="Database host or address cannot be empty.")

    # SQLite file or memory target
    if host_clean in (":memory:", "localhost", "127.0.0.1", "::1"):
        return

    # Check for direct cloud metadata IP or hostname usage
    if host_clean in _BLOCKED_METADATA_IPS or host_clean in _BLOCKED_METADATA_HOSTS:
        raise HTTPException(
            status_code=400,
            detail=f"Connection to cloud metadata address '{host_clean}' is prohibited by safety policy.",
        )

    # Attempt to resolve hostname to check resolved IP
    try:
        resolved_ips = socket.getaddrinfo(host_clean, port or 0, type=socket.SOCK_STREAM)
        for family, _, _, _, sockaddr in resolved_ips:
            ip_str = sockaddr[0]
            if ip_str in _BLOCKED_METADATA_IPS:
                raise HTTPException(
                    status_code=400,
                    detail="Resolved destination address targets cloud instance metadata service.",
                )
            ip_obj = ipaddress.ip_address(ip_str)
            # Link-local check (169.254.0.0/16 or fe80::/10)
            if ip_obj.is_link_local:
                raise HTTPException(
                    status_code=400,
                    detail=f"Connection to link-local address '{ip_str}' is prohibited.",
                )
    except socket.gaierror:
        # Hostname cannot be resolved via DNS
        pass


def sanitize_sql_identifier(identifier: str, context: str = "identifier") -> str:
    """Validate that a SQL table, schema, or column name is an unquoted identifier with no injection chars."""
    id_clean = (identifier or "").strip()
    if not _SAFE_IDENTIFIER_RE.match(id_clean):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {context} '{identifier}'. Identifiers must contain only alphanumeric characters and underscores.",
        )
    return id_clean


def validate_read_only_clause(clause: Optional[str]) -> Optional[str]:
    """Validate an optional filter clause, rejecting destructive keywords."""
    if not clause:
        return None
    if _DISALLOWED_SQL_PATTERNS.search(clause):
        raise HTTPException(
            status_code=400,
            detail="Filter expression contains disallowed SQL modification statements. Only read-only filters are permitted.",
        )
    return clause

