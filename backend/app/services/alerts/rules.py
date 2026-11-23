"""
Configurable business rules for safety alerts: response windows, escalation levels and the
rule-based guidance shown with each alert. Guidance here is *standard EHS guidance keyed by hazard
type* — it is never presented as something a detector observed.

Override any numeric rule with the env var ``EHS_ALERT_RULES`` (JSON), e.g.
``{"response_minutes": {"CRITICAL": 10}, "recurrence_threshold": 5}``.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict

SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW")
ACTIVE_STATUSES = ("NEW", "ACKNOWLEDGED", "UNDER_INVESTIGATION", "ACTION_REQUIRED")
TERMINAL_STATUSES = ("RESOLVED", "DISMISSED")
ALL_STATUSES = ACTIVE_STATUSES + TERMINAL_STATUSES

# status -> statuses it may move to
TRANSITIONS: Dict[str, tuple] = {
    "NEW": ("ACKNOWLEDGED", "UNDER_INVESTIGATION", "ACTION_REQUIRED", "RESOLVED", "DISMISSED"),
    "ACKNOWLEDGED": ("UNDER_INVESTIGATION", "ACTION_REQUIRED", "RESOLVED", "DISMISSED"),
    "UNDER_INVESTIGATION": ("ACTION_REQUIRED", "RESOLVED", "DISMISSED"),
    "ACTION_REQUIRED": ("UNDER_INVESTIGATION", "RESOLVED", "DISMISSED"),
    "RESOLVED": (),
    "DISMISSED": (),
}

_DEFAULTS: Dict[str, Any] = {
    # minutes the team has to acknowledge a NEW alert
    "response_minutes": {"CRITICAL": 15, "HIGH": 60, "MEDIUM": 480, "LOW": 1440},
    # hours to resolve an alert once raised
    "resolution_hours": {"CRITICAL": 24, "HIGH": 72, "MEDIUM": 168, "LOW": 336},
    # minutes between escalation levels while an alert stays overdue
    "escalation_interval_minutes": {"CRITICAL": 30, "HIGH": 120, "MEDIUM": 720, "LOW": 2880},
    "escalation_roles": ["Responsible team lead", "Plant EHS manager", "Safety director"],
    # CAPA: days overdue that trigger escalation levels 1..3
    "capa_escalation_days": [7, 30, 60],
    # repeated incidents: N high/critical events in the same plant+area+hazard within the window
    "recurrence_threshold": 4,
    "recurrence_window_days": 90,
    # video: smoke/fire alert is CRITICAL at/above this model confidence, otherwise HIGH (needs verification)
    "fire_critical_confidence": 0.6,
    # cap how many event-derived alerts one sync may create (protects the dashboard from floods)
    "max_new_alerts_per_sync": 200,
}


def load_rules() -> Dict[str, Any]:
    rules = json.loads(json.dumps(_DEFAULTS))
    raw = os.getenv("EHS_ALERT_RULES")
    if raw:
        try:
            for key, value in json.loads(raw).items():
                if isinstance(value, dict) and isinstance(rules.get(key), dict):
                    rules[key].update(value)
                else:
                    rules[key] = value
        except Exception:  # bad override must never break alerting
            pass
    return rules


# --------------------------------------------------------------------------- guidance catalogue
# why_dangerous / consequences / immediate_action / corrective_action / team, keyed by scenario or
# hazard category. These are standard EHS guidance, labelled as such in the UI.
GUIDANCE: Dict[str, Dict[str, str]] = {
    "fall_detection": {
        "team": "Plant first-aid & EHS response team",
        "why": "A worker was detected on the floor after a loss of balance. Falls cause serious injury, and a worker who cannot get up may need immediate help.",
        "consequences": "Fractures, head injury or a delayed response to a worker who cannot call for help; a recordable or lost-time injury.",
        "immediate": "Send the nearest first aider to the location now, confirm the worker's condition, and make the area safe (check for spills or obstructions).",
        "corrective": "Identify the cause (wet floor, obstruction, footwear, lighting), fix it, and review housekeeping and slip-resistance controls for the area.",
    },
    "smoke_fire": {
        "team": "Plant fire response team",
        "why": "Smoke or flames were detected on camera. Fire spreads quickly in manufacturing areas and produces toxic smoke.",
        "consequences": "Injury or fatality from smoke inhalation or burns, equipment and stock loss, and production shutdown.",
        "immediate": "Verify on site immediately, raise the fire alarm if confirmed, evacuate the area, and call the fire response team. Do not wait for the review if there is any doubt.",
        "corrective": "Inspect the ignition source (electrical equipment, hot work, overheated machinery), repair or isolate it, and review detection and extinguishing coverage.",
    },
    "exit_obstruction": {
        "team": "Plant EHS & facilities team",
        "why": "An object or vehicle was detected in the emergency egress path. Blocked exits can trap people during an evacuation.",
        "consequences": "Delayed evacuation in a fire or emergency, serious injury or fatality, and regulatory non-compliance.",
        "immediate": "Clear the obstruction now and confirm the exit route and door are fully usable; station a person until it is clear.",
        "corrective": "Mark and enforce exit clearance zones, retrain staff on keeping egress routes clear, and add the area to routine inspections.",
    },
    "forklift_pedestrian": {
        "team": "Plant logistics safety team",
        "why": "A forklift and a pedestrian were in dangerous proximity. Forklifts have limited visibility and long stopping distances.",
        "consequences": "Pedestrian struck or crushed, serious injury or fatality.",
        "immediate": "Stop forklift traffic in the aisle, check the pedestrian is unharmed, and separate people from vehicle routes.",
        "corrective": "Review segregated walkways, speed limits, mirrors/beacons and traffic rules for the aisle; retrain the operator and pedestrians.",
    },
    "machinery_proximity": {
        "team": "Plant maintenance & EHS team",
        "why": "A worker was in dangerous proximity to moving machinery. Contact with moving parts causes crush, entanglement and amputation injuries.",
        "consequences": "Crush, entanglement or amputation injury.",
        "immediate": "Stop the machine using the emergency stop, remove the worker from the hazard zone and check their condition.",
        "corrective": "Verify guarding and interlocks, enforce lockout-tagout for access, and review the safe-distance markings and training.",
    },
    "unsafe_climbing": {
        "team": "Plant EHS team",
        "why": "Unsafe behaviour was detected while a worker worked at height. Falls from height are a leading cause of serious injury.",
        "consequences": "Fall from height with serious or fatal injury.",
        "immediate": "Have the worker come down safely, check the ladder or platform, and stop the task until it is made safe.",
        "corrective": "Review work-at-height procedures, ladder inspection and three-points-of-contact practice, and consider a safer access method.",
    },
    "FIRE": {
        "team": "Plant fire safety team",
        "why": "A critical fire-related event is still open. Uncontrolled fire hazards can escalate rapidly.",
        "consequences": "Fire, injury, evacuation and production loss.",
        "immediate": "Confirm the hazard is controlled today; if not, isolate the area and remove ignition sources.",
        "corrective": "Complete the corrective action, verify fire protection systems, and review hot-work and housekeeping controls.",
    },
    "ELECTRICAL": {
        "team": "Plant electrical safety team",
        "why": "A critical electrical event is still open. Electrical faults can cause shock, arc flash and fire.",
        "consequences": "Electric shock, burns, equipment fire.",
        "immediate": "Isolate the equipment if it is still live and unsafe, and restrict access until a qualified person inspects it.",
        "corrective": "Repair or replace the faulty equipment, verify earthing and protection, and review inspection frequency.",
    },
    "CHEMICAL": {
        "team": "Plant EHS / chemical safety team",
        "why": "A critical chemical event is still open. Exposure or release can harm health and the environment.",
        "consequences": "Chemical burns, inhalation injury, environmental release.",
        "immediate": "Confirm containment and ventilation, restrict access, and check PPE and spill-response readiness.",
        "corrective": "Complete the corrective action, review storage and handling procedures, and refresh chemical safety training.",
    },
    "FORKLIFT": {
        "team": "Plant logistics safety team",
        "why": "A critical forklift-related event is still open. Vehicle and pedestrian conflicts cause severe injuries.",
        "consequences": "Pedestrian strike, load collapse, severe injury.",
        "immediate": "Check traffic separation in the area and brief operators and pedestrians today.",
        "corrective": "Complete the corrective action, review routes, speed control and operator competence.",
    },
    "SLIP_TRIP": {
        "team": "Plant EHS & housekeeping team",
        "why": "A critical slip/trip event is still open. These are a common cause of injury and are usually preventable.",
        "consequences": "Falls, fractures, lost-time injury.",
        "immediate": "Make sure the walking surface is clean, dry and unobstructed today.",
        "corrective": "Complete the corrective action and review housekeeping, drainage and footwear controls.",
    },
    "ERGONOMIC": {
        "team": "Plant EHS & ergonomics team",
        "why": "A critical ergonomic event is still open. Repeated strain leads to long-term injury.",
        "consequences": "Musculoskeletal injury and absence.",
        "immediate": "Review the task with the worker and adjust it or the workstation now.",
        "corrective": "Complete the corrective action and redesign the task or provide lifting aids.",
    },
    "ESD": {
        "team": "Plant quality & EHS team",
        "why": "A critical electrostatic-discharge event is still open. ESD can damage product and ignite flammable atmospheres.",
        "consequences": "Product damage and, in some areas, ignition risk.",
        "immediate": "Check ESD controls (grounding, wrist straps, flooring) in the area.",
        "corrective": "Complete the corrective action and audit ESD controls.",
    },
    "DEFAULT": {
        "team": "Plant EHS team",
        "why": "A critical safety event is still open and requires action.",
        "consequences": "Injury, regulatory non-compliance or operational loss if the hazard is not controlled.",
        "immediate": "Confirm the hazard is currently controlled and assign an owner.",
        "corrective": "Complete the open corrective action and record evidence of closure.",
    },
    "RECURRENCE": {
        "team": "Plant EHS manager",
        "why": "The same hazard keeps recurring at this location, which means earlier corrective actions did not remove the root cause.",
        "consequences": "A higher chance of a serious incident and repeated regulatory exposure.",
        "immediate": "Review the recent events at this location together and confirm the current controls are working.",
        "corrective": "Run a root-cause investigation for the location and replace repeat temporary fixes with a permanent control.",
    },
}


def guidance_for(key: str) -> Dict[str, str]:
    return GUIDANCE.get(key) or GUIDANCE["DEFAULT"]
