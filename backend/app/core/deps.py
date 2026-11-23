"""Small request helpers shared by the routes.

The platform has no user accounts, login or roles: every endpoint is open, so deployments must sit behind
their own network or gateway protection.
"""
from __future__ import annotations

from typing import Optional

ALL_PLANTS = "ALL"

# Recorded on audit entries, alert history and read receipts now that there are no user accounts.
ACTOR = "system"


def plant_filter(requested: Optional[str]) -> Optional[str]:
    """Return None for 'all plants' (empty or 'ALL'), otherwise the requested plant id."""
    req = (requested or "").strip()
    return None if req == "" or req.upper() == ALL_PLANTS else req
