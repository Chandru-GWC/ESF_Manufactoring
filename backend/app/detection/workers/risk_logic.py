"""
Pure geometry / rule logic for the three open-vocabulary scenarios. No model or I/O here, so every
rule can be unit-tested. All thresholds are named constants (the "defined risk conditions").

Honesty notes
-------------
* Distances are image-plane estimates scaled by the pedestrian's own height (assumed adult 1.7 m);
  they are NOT surveyed metric distances and are reported as estimates.
* Ladder *stability* cannot be measured by these models and is never claimed. Only observable
  posture (elevation on a ladder, lateral overreach, torso lean) is reported.
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional, Sequence, Tuple

Box = Tuple[float, float, float, float]

# ----------------------------------------------------------------------------- forklift / pedestrian
ASSUMED_PERSON_HEIGHT_M = 1.7
NEAR_MISS_PH = 1.0          # feet within 1 person-height (~1.7 m) of the forklift footprint
CLOSE_PROXIMITY_PH = 2.0    # within ~3.4 m
CONTACT_PH = 0.5            # ~0.85 m: a single sample is enough
FORKLIFT_MOVING_WIDTHS_PER_S = 0.1  # forklift centre moves at least 10 % of its width per second
OPERATOR_OVERLAP = 0.5      # a person mostly inside a forklift box is the operator, not a pedestrian
FOOTPRINT_FRACTION = 0.4    # lower 40 % of the forklift box approximates its ground footprint


def area(b: Box) -> float:
    return max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])


def inside_fraction(inner: Box, outer: Box) -> float:
    """Share of `inner`'s area that lies inside `outer`."""
    ix1, iy1, ix2, iy2 = max(inner[0], outer[0]), max(inner[1], outer[1]), min(inner[2], outer[2]), min(inner[3], outer[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    return inter / area(inner) if area(inner) > 0 else 0.0


def centre(b: Box) -> Tuple[float, float]:
    return (b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0


def is_operator(person: Box, forklift: Box) -> bool:
    return inside_fraction(person, forklift) >= OPERATOR_OVERLAP


def ground_distance_ph(person: Box, forklift: Box) -> float:
    """Distance in person-heights between the person's feet and the forklift's ground footprint band."""
    fx, fy = (person[0] + person[2]) / 2.0, person[3]
    band_top = forklift[1] + (1.0 - FOOTPRINT_FRACTION) * (forklift[3] - forklift[1])
    dx = max(forklift[0] - fx, 0.0, fx - forklift[2])
    dy = max(band_top - fy, 0.0, fy - forklift[3])
    return math.hypot(dx, dy) / max(1.0, person[3] - person[1])


def estimated_metres(distance_ph: float) -> float:
    return distance_ph * ASSUMED_PERSON_HEIGHT_M


def forklift_speed_widths_per_s(prev: Optional[Box], cur: Box, dt: float) -> Optional[float]:
    if prev is None or dt <= 0:
        return None
    pw = max(1.0, cur[2] - cur[0])
    return math.hypot(centre(cur)[0] - centre(prev)[0], centre(cur)[1] - centre(prev)[1]) / pw / dt


def classify_forklift_sample(distance_ph: float, forklift_moving: bool, closing: bool) -> str:
    """NEAR_MISS needs a close pedestrian AND forklift motion (or a closing approach); a parked forklift is not a near miss."""
    if distance_ph <= CONTACT_PH:
        return "NEAR_MISS"
    if distance_ph <= NEAR_MISS_PH and (forklift_moving or closing):
        return "NEAR_MISS"
    if distance_ph <= CLOSE_PROXIMITY_PH:
        return "CLOSE_PROXIMITY"
    return "CLEAR"


def near_miss_confirmed(states: Sequence[str], distances: Sequence[float]) -> bool:
    """Event rule: two consecutive NEAR_MISS samples, or one sample at contact distance."""
    for i, s in enumerate(states):
        if s != "NEAR_MISS":
            continue
        if distances[i] <= CONTACT_PH:
            return True
        if i + 1 < len(states) and states[i + 1] == "NEAR_MISS":
            return True
    return False


# ----------------------------------------------------------------------------- machinery zone
ZONE_MARGIN_FRACTION = 0.06      # restricted zone = machine box grown by 6 % of the frame width
INTRUSION_FEET_IN_ZONE = True
OVERLAP_MIN = 0.10               # >=10 % of the person's box overlapping the machine box
MOTION_MIN_MEAN_DIFF = 2.5       # mean absolute grey-level change (0-255) inside the machine box


def expand(b: Box, margin: float, frame_w: float, frame_h: float) -> Box:
    return max(0.0, b[0] - margin), max(0.0, b[1] - margin), min(frame_w, b[2] + margin), min(frame_h, b[3] + margin)


def point_in(box: Box, x: float, y: float) -> bool:
    return box[0] <= x <= box[2] and box[1] <= y <= box[3]


def classify_machinery_sample(person: Box, machine: Box, zone: Box, hands_on_machine: bool) -> str:
    """Per-sample state for a worker relative to a machine and its restricted zone."""
    feet = ((person[0] + person[2]) / 2.0, person[3])
    overlap = inside_fraction(person, machine)
    in_zone = point_in(zone, *feet)
    if hands_on_machine and (overlap >= OVERLAP_MIN or in_zone):
        return "HANDS_IN_MACHINE_AREA"
    if in_zone and overlap >= OVERLAP_MIN:
        return "ZONE_INTRUSION"
    return "OUTSIDE"


# ----------------------------------------------------------------------------- ladder posture
LEAN_DEG = 20.0
OVERREACH_RATIO = 1.1   # lateral wrist distance from hip centre >= 1.1x torso length (initial default, tuned on one clip)
ELEVATION_MIN = 0.12    # feet at least 12 % of the ladder height above its base
LM = {"nose": 0, "l_shoulder": 11, "r_shoulder": 12, "l_wrist": 15, "r_wrist": 16, "l_hip": 23, "r_hip": 24, "l_ankle": 27, "r_ankle": 28}


def _pt(lms: Dict[int, Tuple[float, float, float]], name: str, min_vis: float = 0.3):
    p = lms.get(LM[name])
    return (p[0], p[1]) if p and p[2] >= min_vis else None


def torso_metrics(lms: Dict[int, Tuple[float, float, float]]) -> Optional[Dict[str, float]]:
    """Torso length, lean from vertical (deg) and lateral overreach ratio (0 = arms at the body)."""
    ls, rs, lh, rh = _pt(lms, "l_shoulder"), _pt(lms, "r_shoulder"), _pt(lms, "l_hip"), _pt(lms, "r_hip")
    if not (ls and rs and lh and rh):
        return None
    sm = ((ls[0] + rs[0]) / 2.0, (ls[1] + rs[1]) / 2.0)
    hm = ((lh[0] + rh[0]) / 2.0, (lh[1] + rh[1]) / 2.0)
    torso = math.hypot(sm[0] - hm[0], sm[1] - hm[1])
    if torso < 5:
        return None
    lean = math.degrees(math.atan2(abs(sm[0] - hm[0]), max(1e-6, hm[1] - sm[1])))
    reach = 0.0
    for name in ("l_wrist", "r_wrist"):
        w = _pt(lms, name)
        if w:
            reach = max(reach, abs(w[0] - hm[0]) / torso)
    return {"torso_px": torso, "lean_deg": lean, "overreach_ratio": reach}


def feet_y(lms: Dict[int, Tuple[float, float, float]], fallback_bottom: float) -> float:
    ys = [p[1] for p in (_pt(lms, "l_ankle"), _pt(lms, "r_ankle")) if p]
    return max(ys) if ys else fallback_bottom


def elevation_ratio(feet_y_px: float, ladder: Box) -> float:
    """How far above the ladder's base the feet are, as a share of ladder height (negative = below the base)."""
    h = max(1.0, ladder[3] - ladder[1])
    return (ladder[3] - feet_y_px) / h


def person_on_ladder(person: Box, ladder: Box) -> bool:
    """Horizontal overlap with the ladder box and the person is not wholly outside it."""
    return inside_fraction(person, (ladder[0] - 0.25 * (ladder[2] - ladder[0]), ladder[1], ladder[2] + 0.25 * (ladder[2] - ladder[0]), ladder[3] + 0.1 * (ladder[3] - ladder[1]))) >= 0.35


def classify_ladder_sample(on_ladder: bool, elevation: float, metrics: Optional[Dict[str, float]]) -> Tuple[str, List[str]]:
    """Returns (state, observed unsafe conditions). Stability is never assessed."""
    if not on_ladder or elevation < ELEVATION_MIN:
        return "NOT_ELEVATED", []
    unsafe: List[str] = []
    if metrics:
        if metrics["overreach_ratio"] >= OVERREACH_RATIO:
            unsafe.append("overreach")
        if metrics["lean_deg"] >= LEAN_DEG:
            unsafe.append("torso lean")
    return ("UNSAFE_POSTURE" if unsafe else "WORKING_AT_HEIGHT"), unsafe
