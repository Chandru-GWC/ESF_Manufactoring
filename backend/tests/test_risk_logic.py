"""Unit tests for the geometry / rule layer of the forklift, machinery and ladder pipelines (no models)."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app", "detection", "workers"))

import risk_logic as rl  # noqa: E402


# ------------------------------------------------------------------ forklift
def test_operator_inside_forklift_is_not_a_pedestrian():
    forklift = (600, 200, 900, 500)
    assert rl.is_operator((700, 220, 760, 380), forklift)
    assert not rl.is_operator((300, 300, 380, 560), forklift)


def test_ground_distance_scales_with_person_height_and_is_zero_inside_footprint():
    forklift = (600, 200, 900, 500)  # footprint band y in [380, 500]
    inside = (640, 300, 700, 440)  # feet at (670, 440) inside the band
    assert rl.ground_distance_ph(inside, forklift) == 0.0
    person = (300, 300, 380, 560)  # height 260, feet (340, 560)
    d = rl.ground_distance_ph(person, forklift)
    assert d == pytest.approx(((600 - 340) ** 2 + (560 - 500) ** 2) ** 0.5 / 260, rel=1e-6)
    far = (0, 300, 80, 560)
    assert rl.ground_distance_ph(far, forklift) > d


def test_forklift_sample_rules():
    assert rl.classify_forklift_sample(0.4, False, False) == "NEAR_MISS"  # contact distance even if parked
    assert rl.classify_forklift_sample(0.8, True, False) == "NEAR_MISS"
    assert rl.classify_forklift_sample(0.8, False, True) == "NEAR_MISS"  # closing counts as movement
    assert rl.classify_forklift_sample(0.8, False, False) == "CLOSE_PROXIMITY"  # parked forklift is not a near miss
    assert rl.classify_forklift_sample(1.7, True, True) == "CLOSE_PROXIMITY"
    assert rl.classify_forklift_sample(2.6, True, True) == "CLEAR"


def test_near_miss_event_needs_two_consecutive_samples_or_contact():
    assert not rl.near_miss_confirmed(["CLEAR", "NEAR_MISS", "CLEAR"], [3, 0.9, 3])
    assert rl.near_miss_confirmed(["CLEAR", "NEAR_MISS", "NEAR_MISS"], [3, 0.9, 0.8])
    assert rl.near_miss_confirmed(["CLEAR", "NEAR_MISS", "CLEAR"], [3, 0.4, 3])
    assert not rl.near_miss_confirmed(["NEAR_MISS", "CLEAR", "NEAR_MISS"], [0.9, 3, 0.9])


def test_forklift_speed_in_widths_per_second():
    prev, cur = (100, 100, 300, 300), (200, 100, 400, 300)  # moved 100 px, width 200 -> 0.5 widths per 1 s
    assert rl.forklift_speed_widths_per_s(prev, cur, 1.0) == pytest.approx(0.5)
    assert rl.forklift_speed_widths_per_s(None, cur, 1.0) is None


# ------------------------------------------------------------------ machinery
def test_machinery_zone_states():
    machine = (400, 200, 900, 500)
    zone = rl.expand(machine, 60, 1280, 720)
    outside = (50, 250, 130, 520)
    in_zone = (430, 250, 520, 520)  # feet (475, 520) inside the expanded zone, overlapping the machine
    assert rl.classify_machinery_sample(outside, machine, zone, False) == "OUTSIDE"
    assert rl.classify_machinery_sample(in_zone, machine, zone, False) == "ZONE_INTRUSION"
    assert rl.classify_machinery_sample(in_zone, machine, zone, True) == "HANDS_IN_MACHINE_AREA"
    assert rl.classify_machinery_sample(outside, machine, zone, True) == "OUTSIDE"  # hands need the person near the machine


# ------------------------------------------------------------------ ladder
def _lms(**kw):
    base = {11: (480, 300, 1.0), 12: (520, 300, 1.0), 23: (485, 400, 1.0), 24: (515, 400, 1.0),
            15: (470, 380, 1.0), 16: (530, 380, 1.0), 27: (490, 520, 1.0), 28: (510, 520, 1.0)}
    base.update(kw)
    return base


def test_torso_metrics_upright_vs_overreach_vs_lean():
    upright = rl.torso_metrics(_lms())
    assert upright["lean_deg"] < 5 and upright["overreach_ratio"] < 0.7
    wide = _lms()
    wide[16] = (700, 330, 1.0)  # right wrist far to the side
    assert rl.torso_metrics(wide)["overreach_ratio"] >= rl.OVERREACH_RATIO
    lean = _lms()
    lean[11], lean[12] = (560, 300, 1.0), (600, 300, 1.0)  # shoulders shifted sideways over the hips
    assert rl.torso_metrics(lean)["lean_deg"] >= rl.LEAN_DEG
    assert rl.torso_metrics({11: (1, 1, 0.1)}) is None  # not enough visible landmarks


def test_ladder_states_never_claim_stability():
    ladder = (450, 100, 560, 560)
    assert rl.elevation_ratio(500, ladder) == pytest.approx(60 / 460)
    assert rl.classify_ladder_sample(False, 0.5, {"lean_deg": 40, "overreach_ratio": 2})[0] == "NOT_ELEVATED"
    assert rl.classify_ladder_sample(True, 0.05, None)[0] == "NOT_ELEVATED"
    assert rl.classify_ladder_sample(True, 0.3, {"lean_deg": 5, "overreach_ratio": 0.3}) == ("WORKING_AT_HEIGHT", [])
    state, unsafe = rl.classify_ladder_sample(True, 0.3, {"lean_deg": 30, "overreach_ratio": 1.2})
    assert state == "UNSAFE_POSTURE" and set(unsafe) == {"overreach", "torso lean"}
    assert all("stab" not in u for u in unsafe)


def test_person_on_ladder_requires_overlap():
    ladder = (450, 100, 560, 560)
    assert rl.person_on_ladder((440, 150, 570, 420), ladder)
    assert not rl.person_on_ladder((900, 150, 1000, 420), ladder)
