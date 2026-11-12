"""
Shift and Entity Normalization Layer for EHS Safety AI Platform
Adheres strictly to the rule: Normalize presentation/querying without modifying raw source values.
"""
from typing import Dict, Optional

# Canonical shift definitions
SHIFT_CANONICAL_MAP: Dict[str, str] = {
    "A": "Shift A",
    "B": "Shift B",
    "C": "Shift C",
    "SHIFT A": "Shift A",
    "SHIFT B": "Shift B",
    "SHIFT C": "Shift C",
}

SHIFT_TIMING_METADATA: Dict[str, Dict[str, str]] = {
    "A": {
        "label": "Shift A (Morning)",
        "standard_start": "06:00:00",
        "standard_end": "14:00:00",
        "scheduled_hours": "8"
    },
    "B": {
        "label": "Shift B (Evening)",
        "standard_start": "14:00:00",
        "standard_end": "22:00:00",
        "scheduled_hours": "8"
    },
    "C": {
        "label": "Shift C (Night)",
        "standard_start": "22:00:00",
        "standard_end": "06:00:00",
        "scheduled_hours": "8"
    }
}

def normalize_shift_id(raw_shift: Optional[str]) -> str:
    """
    Returns single character canonical key ('A', 'B', 'C') for safe database joins.
    Leaves original source record unchanged.
    """
    if not raw_shift:
        return "UNASSIGNED"
    clean = raw_shift.strip().upper()
    if clean in ("A", "SHIFT A", "SHIFT_A"):
        return "A"
    if clean in ("B", "SHIFT B", "SHIFT_B"):
        return "B"
    if clean in ("C", "SHIFT C", "SHIFT_C"):
        return "C"
    return clean

def get_shift_display_label(raw_shift: Optional[str]) -> str:
    """
    Returns user-facing presentation string.
    """
    code = normalize_shift_id(raw_shift)
    meta = SHIFT_TIMING_METADATA.get(code)
    return meta["label"] if meta else code

