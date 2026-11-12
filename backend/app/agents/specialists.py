"""
Specialist EHS Logical Agents (Agents 2 through 8).

Every specialist retrieves validated read-only data from Neon PostgreSQL
via EhsNeonDataTools and invokes the shared DomoGPTService for grounded synthesis.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from app.agents.base import BaseEhsAgent
from app.agents.tools import EhsNeonDataTools
from app.schemas.ai_agent import EvidenceItem


class HazardAnalysisAgent(BaseEhsAgent):
    agent_key = "hazard_analysis"
    agent_name = "Hazard Analysis Agent"
    role = "Analyzes workplace hazard categories, CRITICAL/HIGH severity events, and plant/area/shift hotspots."
    data_sources = ["ehs_core.fact_ehs_event"]
    capabilities = [
        "Hazard category concentration analysis",
        "HIGH & CRITICAL risk identification",
        "Plant × Area × Shift recurring pattern detection",
        "Hotspot prioritization for safety officers",
    ]
    limitations = [
        "Analysis covers recorded event rows in ehs_core.fact_ehs_event; unlogged floor conditions or real-time IoT sensor telemetry are not present.",
    ]
    system_rules = (
        "- Focus on hazard_category breakdowns, HIGH and CRITICAL severity totals, and recurring plant/area/shift hotspots.\n"
        "- Distinguish HAZARD_OBSERVATION records from total event distribution when citing category counts.\n"
        "- Point safety officers to exact area names, plants, shifts, and sample ehs_event_id values requiring attention."
    )

    def retrieve_data(
        self, tools: EhsNeonDataTools, plant_id: Optional[str] = None
    ) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        return tools.get_hazard_analysis_data(plant_id)

    def build_fallback_summary(self, data: Dict[str, Any]) -> Tuple[str, List[str], List[str], List[str]]:
        scope = data["plant_scope"]
        total = data["total_events"]
        haz_cnt = data["hazard_observation_count"]
        sev = data["all_events_by_severity"]
        top_cats = sorted(data["all_events_by_hazard_category"].items(), key=lambda x: -x[1])[:3]
        top_spots = data["top_recurring_area_categories"][:2]

        summary = (
            f"Across {scope} ({total} total EHS events), {haz_cnt} records are classified as HAZARD_OBSERVATION, "
            f"with {sev.get('CRITICAL', 0)} CRITICAL and {sev.get('HIGH', 0)} HIGH severity events overall."
        )
        findings = [
            f"Top hazard categories (all events): {', '.join(f'{k} ({v})' for k, v in top_cats)}." if top_cats else "No hazard categories recorded.",
            f"Severity totals: CRITICAL={sev.get('CRITICAL', 0)}, HIGH={sev.get('HIGH', 0)}, MEDIUM={sev.get('MEDIUM', 0)}, LOW={sev.get('LOW', 0)}.",
            *[
                f"Recurring hotspot: {s['plant_id']} / {s['area']} logged {s['count']} {s['hazard_category']} events."
                for s in top_spots
            ],
        ]
        recs = [
            "Direct plant safety officers to inspect open CRITICAL and HIGH severity events in top recurring area/category pairs.",
            "Verify hazard containment controls during shift handovers in areas showing elevated concentration.",
        ]
        suggestions = [
            "Which overdue CAPAs affect our CRITICAL hazards?",
            "Break down permit exceptions by plant and area",
        ]
        return summary, findings, recs, suggestions


class IncidentAnalysisAgent(BaseEhsAgent):
    agent_key = "incident_analysis"
    agent_name = "Incident Analysis Agent"
    role = "Analyzes first-aid cases, near misses, and audit findings plus monthly incident trends."
    data_sources = ["ehs_core.fact_ehs_event"]
    capabilities = [
        "FIRST_AID, NEAR_MISS, and AUDIT_FINDING distribution",
        "Monthly trend tracking from recorded timestamps",
        "Lost-time injury verification",
    ]
    limitations = [
        "lost_time_injury is False in all current ehs_core.fact_ehs_event records; do not fabricate LTIFR/TRIFR injury rates without certified rate configuration.",
    ]
    system_rules = (
        "- Analyze FIRST_AID, NEAR_MISS, and AUDIT_FINDING counts, severity mix, areas, and monthly trends.\n"
        "- Explicitly note lost_time_injury_true_count from the database."
    )

    def retrieve_data(
        self, tools: EhsNeonDataTools, plant_id: Optional[str] = None
    ) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        return tools.get_incident_analysis_data(plant_id)

    def build_fallback_summary(self, data: Dict[str, Any]) -> Tuple[str, List[str], List[str], List[str]]:
        bt = data["by_event_type"]
        lti = data["lost_time_injury_true_count"]
        total_grp = data["incident_and_audit_total"]
        summary = (
            f"In scope {data['plant_scope']}, there are {total_grp} incident/audit events: "
            f"{bt.get('FIRST_AID', 0)} FIRST_AID, {bt.get('NEAR_MISS', 0)} NEAR_MISS, and "
            f"{bt.get('AUDIT_FINDING', 0)} AUDIT_FINDING records (lost_time_injury=True count: {lti})."
        )
        findings = [
            f"Event distribution: FIRST_AID={bt.get('FIRST_AID', 0)}, NEAR_MISS={bt.get('NEAR_MISS', 0)}, AUDIT_FINDING={bt.get('AUDIT_FINDING', 0)}.",
            f"Verified lost_time_injury=True rows across all events: {lti}.",
            f"Monthly observations cover {len(data['monthly_trends'])} months ({', '.join(sorted(data['monthly_trends'].keys()))}).",
        ]
        recs = [
            "Prioritize root-cause review with area supervisors on open CRITICAL/HIGH First-Aid and Near-Miss records.",
            "Track Audit Findings to closure alongside overdue CAPA follow-ups before closing investigation tickets.",
        ]
        suggestions = [
            "Show overdue corrective actions requiring follow-up",
            "Summarize critical workplace hazards by zone and shift",
        ]
        return summary, findings, recs, suggestions


class WorkforceSafetyAgent(BaseEhsAgent):
    agent_key = "workforce_safety"
    agent_name = "Workforce Safety Agent"
    role = "Analyzes shift attendance logs, safety training compliance, expired certifications, and overtime patterns."
    data_sources = ["ehs_core.fact_workforce_attendance"]
    capabilities = [
        "Shift attendance & actual/overtime hour aggregation across all 16,560 logs",
        "CURRENT vs EXPIRED training compliance breakdown",
        "Identification of plants, shifts, and employee IDs with EXPIRED training logs",
    ]
    limitations = [
        "Attendance and overtime hours alone CANNOT establish employee fatigue, medical alertness, or fitness for duty.",
        "Training records indicate binary compliance status (CURRENT/EXPIRED) without course-specific certification expiry timestamps.",
    ]
    system_rules = (
        "- Summarize total attendance logs, actual hours, overtime hours, shift breakdown, and CURRENT vs EXPIRED training compliance.\n"
        "- STRICT PROHIBITION: NEVER conclude or state that any employee or crew is fatigued or unfit for work based on attendance or overtime alone.\n"
        "- When listing expired training records, state log counts and employee IDs strictly as administrative training-compliance tracking."
    )

    def retrieve_data(
        self, tools: EhsNeonDataTools, plant_id: Optional[str] = None
    ) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        return tools.get_workforce_safety_data(plant_id)

    def build_fallback_summary(self, data: Dict[str, Any]) -> Tuple[str, List[str], List[str], List[str]]:
        total = data["total_attendance_records"]
        rate = data["training_compliance_rate_pct"]
        exp = data["training_expired_logs"]
        exp_emps = data["distinct_employees_with_expired_training"]
        ot = data["overtime_hours_total"]
        summary = (
            f"Across {total:,} attendance logs ({data['plant_scope']}), training compliance is {rate}% CURRENT "
            f"with {exp:,} EXPIRED logs spanning {exp_emps} distinct employees, and {ot:,.1f} recorded overtime hours. "
            "Attendance and overtime data alone cannot determine individual fatigue or fitness for duty."
        )
        findings = [
            f"Total actual work hours: {data['actual_hours_total']:,.1f} hrs across {data['distinct_employees']} distinct employees.",
            f"Training compliance: {data['training_current_logs']:,} CURRENT vs {exp:,} EXPIRED shift logs ({rate}%).",
            f"Overtime recorded across {data['logs_with_overtime']:,} shift logs totaling {ot:,.1f} overtime hours.",
        ]
        recs = [
            "Have HR and Plant Safety Coordinators schedule refresher verification for employees flagged with EXPIRED training logs.",
            "Review overtime concentration across shifts together with certified staffing rosters without inferring fatigue from hours alone.",
        ]
        suggestions = [
            "How are hazards distributed across Shifts A, B, and C?",
            "Combine workforce training and overdue CAPAs into a management brief",
        ]
        return summary, findings, recs, suggestions


class MaintenanceSafetyAgent(BaseEhsAgent):
    agent_key = "maintenance_safety"
    agent_name = "Maintenance Safety Agent"
    role = "Analyzes maintenance work orders, P1 priorities, failure modes, statuses, and downtime avoided."
    data_sources = ["ehs_core.fact_maintenance_work_order"]
    capabilities = [
        "Priority (P1/P2/P3) & execution status breakdown",
        "Failure mode & maintenance type concentration",
        "Top P1 machine backlog & downtime avoided estimation",
    ]
    limitations = [
        "fact_maintenance_work_order has NO permit_id, NO shift_id, and NO verified machine-to-area mapping; do not join machines to floor zones or permits.",
    ]
    system_rules = (
        "- Analyze only actual columns in fact_maintenance_work_order (work_order_id, machine_id, plant_id, maintenance_type, failure_mode, priority, status, downtime_avoided_estimate_min).\n"
        "- Do not invent area locations, shift assignments, or permit IDs for maintenance orders."
    )

    def retrieve_data(
        self, tools: EhsNeonDataTools, plant_id: Optional[str] = None
    ) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        return tools.get_maintenance_safety_data(plant_id)

    def build_fallback_summary(self, data: Dict[str, Any]) -> Tuple[str, List[str], List[str], List[str]]:
        total = data["total_work_orders"]
        p1 = data["p1_priority_total"]
        p1_open = data["p1_not_completed_count"]
        dt_min = data["downtime_avoided_estimate_min"]
        summary = (
            f"Maintenance data for {data['plant_scope']} covers {total} work orders, including {p1} P1 priority orders "
            f"({p1_open} not yet completed) and {dt_min:,} estimated downtime minutes avoided (~{data['downtime_avoided_hours']} hrs)."
        )
        findings = [
            f"Priority breakdown: {data['by_priority']}.",
            f"Status distribution: {data['by_status']} ({data['orders_missing_actual_start']} orders have null actual_start).",
            f"Failure modes observed: {data['by_failure_mode']}.",
        ]
        recs = [
            "Verify field isolation and permit readiness manually with maintenance supervisors before executing pending P1 work orders.",
            "Audit top repeat-failure machines alongside technician scheduling in daily maintenance reviews.",
        ]
        suggestions = [
            "Show permit exceptions requiring safety review",
            "What is our overall CAPA closure backlog?",
        ]
        return summary, findings, recs, suggestions


class CapaMonitoringAgent(BaseEhsAgent):
    agent_key = "capa_monitoring"
    agent_name = "Corrective Action Monitoring Agent"
    role = "Monitors OPEN, IN_PROGRESS, and CLOSED CAPAs, overdue due dates, and owner follow-up priorities."
    data_sources = ["ehs_core.fact_ehs_event"]
    capabilities = [
        "CAPA backlog breakdown (OPEN / IN_PROGRESS / CLOSED)",
        "Overdue calculation comparing due_date < current evaluation date",
        "Critical/High overdue triage by plant and action owner",
    ]
    limitations = [
        "Overdue calculations evaluate action_status != 'CLOSED' and due_date < current date; CAPAs cannot be modified or closed by AI.",
    ]
    system_rules = (
        "- Highlight pending vs completed CAPAs, exact overdue counts against evaluation_date, and highest-severity overdue IDs.\n"
        "- STRICT PROHIBITION: Never close or mark CAPA actions complete; explicitly note that human EHS officer sign-off and verified remediation evidence are mandatory."
    )

    def retrieve_data(
        self, tools: EhsNeonDataTools, plant_id: Optional[str] = None
    ) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        return tools.get_capa_monitoring_data(plant_id)

    def build_fallback_summary(self, data: Dict[str, Any]) -> Tuple[str, List[str], List[str], List[str]]:
        summary = (
            f"Across {data['total_capa_records']} CAPA-linked events ({data['plant_scope']}), "
            f"{data['pending_total_count']} remain pending ({data['open_count']} OPEN, {data['in_progress_count']} IN_PROGRESS) "
            f"and {data['closed_count']} are CLOSED ({data['closure_rate_pct']}%). "
            f"As of {data['evaluation_date']}, {data['overdue_total_count']} pending actions are past due_date "
            f"({data['overdue_high_or_critical_count']} CRITICAL/HIGH)."
        )
        findings = [
            f"Overdue by severity: {data['overdue_by_severity']}.",
            f"Overdue by plant: {data['overdue_by_plant']}.",
            f"Top action owners with overdue items: {', '.join(f'{o['action_owner']} ({o['overdue_count']})' for o in data['top_overdue_action_owners'][:4])}.",
        ]
        recs = [
            "Escalate overdue CRITICAL and HIGH severity CAPAs to listed action_owners for documented evidence verification before closure.",
            "Conduct a plant-level CAPA review meeting to validate root-cause remediation before any EHS officer updates action_status to CLOSED.",
        ]
        suggestions = [
            "Which hazards have the highest CRITICAL count?",
            "Summarize permit exceptions that are still OPEN",
        ]
        return summary, findings, recs, suggestions


class PermitComplianceAgent(BaseEhsAgent):
    agent_key = "permit_compliance"
    agent_name = "Permit Compliance Agent"
    role = "Analyzes PERMIT_EXCEPTION events and recorded permit_id references while enforcing LOTO scope boundaries."
    data_sources = ["ehs_core.fact_ehs_event"]
    capabilities = [
        "PERMIT_EXCEPTION frequency by plant, area, severity, and action status",
        "Unique permit_id reference audit across EHS events",
        "Open high-severity permit exception escalation",
    ]
    limitations = [
        "No separate LOTO hardware isolation / lock-box verification dataset exists in Neon PostgreSQL; full physical LOTO compliance CANNOT be claimed.",
        "Maintenance work orders do not include permit_id or shift_id columns for cross-table permit joins.",
    ]
    system_rules = (
        "- Report PERMIT_EXCEPTION counts, distinct permit_id references, and open CRITICAL/HIGH permit exceptions.\n"
        "- STRICT PROHIBITION: Do NOT claim physical LOTO isolation verification or permit validity beyond recorded fact_ehs_event attributes.\n"
        "- Never approve or clear permits; emphasize human safety officer & authorized issuer verification."
    )

    def retrieve_data(
        self, tools: EhsNeonDataTools, plant_id: Optional[str] = None
    ) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        return tools.get_permit_compliance_data(plant_id)

    def build_fallback_summary(self, data: Dict[str, Any]) -> Tuple[str, List[str], List[str], List[str]]:
        summary = (
            f"Within {data['plant_scope']}, {data['permit_exception_total']} events are recorded as PERMIT_EXCEPTION "
            f"({data['permit_exception_open_or_in_progress']} open/in-progress; {data['permit_exception_high_or_critical']} CRITICAL/HIGH) "
            f"across {data['distinct_permit_ids']} unique referenced permit_ids. Physical LOTO lock-out verification is outside available dataset telemetry."
        )
        findings = [
            f"Permit exceptions by plant: {data['exceptions_by_plant']}.",
            f"Top exception areas: {dict(list(data['exceptions_by_area'].items())[:5])}.",
            f"Hazard categories linked to permit exceptions: {data['exceptions_by_hazard_category']}.",
        ]
        recs = [
            "Require Permit-to-Work coordinators to inspect open CRITICAL/HIGH PERMIT_EXCEPTION records manually on site.",
            "Ingest a dedicated LOTO isolation log dataset before automating hardware lockout verification audits.",
        ]
        suggestions = [
            "How many P1 maintenance orders are pending execution?",
            "Create a full plant executive safety intelligence brief",
        ]
        return summary, findings, recs, suggestions


class SafetyIntelligenceAgent(BaseEhsAgent):
    agent_key = "safety_intelligence"
    agent_name = "Safety Intelligence and Reporting Agent"
    role = "Synthesizes cross-domain Neon telemetry and specialist findings into executive management briefings and safety reports."
    data_sources = [
        "ehs_core.fact_ehs_event",
        "ehs_core.fact_workforce_attendance",
        "ehs_core.fact_maintenance_work_order",
    ]
    capabilities = [
        "Executive management safety reporting across all 3 Neon tables",
        "Cross-domain synthesis combining specialist outputs",
        "Prioritized human-reviewed corrective recommendations",
    ]
    limitations = [
        "All dataset boundary constraints apply: no LTI>0 rows currently recorded, no fatigue inference from attendance, no LOTO isolation verification table, and no machine-to-area/permit join on maintenance orders.",
    ]
    system_rules = (
        "- Produce an executive, audit-ready management summary linking EHS events, CAPA overdue risk, permit exceptions, workforce training compliance, and P1 maintenance priorities.\n"
        "- Cite only verified numbers from the aggregated multi-domain snapshot or specialist inputs.\n"
        "- Never mix AI recommendations with factual findings and never recommend bypassing human safety sign-off."
    )

    def retrieve_data(
        self, tools: EhsNeonDataTools, plant_id: Optional[str] = None
    ) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        haz_data, haz_ev, haz_cnt = tools.get_hazard_analysis_data(plant_id)
        inc_data, inc_ev, _ = tools.get_incident_analysis_data(plant_id)
        wf_data, wf_ev, wf_cnt = tools.get_workforce_safety_data(plant_id)
        mwo_data, mwo_ev, mwo_cnt = tools.get_maintenance_safety_data(plant_id)
        capa_data, capa_ev, _ = tools.get_capa_monitoring_data(plant_id)
        ptw_data, ptw_ev, _ = tools.get_permit_compliance_data(plant_id)

        combined_payload = {
            "plant_scope": haz_data["plant_scope"],
            "events_and_hazards": {
                "total_events": haz_data["total_events"],
                "hazard_observations": haz_data["hazard_observation_count"],
                "by_severity": haz_data["all_events_by_severity"],
                "top_area_categories": haz_data["top_recurring_area_categories"][:5],
            },
            "incidents_and_audits": {
                "by_event_type": inc_data["by_event_type"],
                "lost_time_injury_true_count": inc_data["lost_time_injury_true_count"],
            },
            "capa_backlog": {
                "open_count": capa_data["open_count"],
                "in_progress_count": capa_data["in_progress_count"],
                "closed_count": capa_data["closed_count"],
                "overdue_total_count": capa_data["overdue_total_count"],
                "overdue_high_or_critical_count": capa_data["overdue_high_or_critical_count"],
            },
            "permits": {
                "permit_exception_total": ptw_data["permit_exception_total"],
                "permit_exception_open": ptw_data["permit_exception_open_or_in_progress"],
                "distinct_permit_ids": ptw_data["distinct_permit_ids"],
            },
            "workforce": {
                "total_attendance_records": wf_data["total_attendance_records"],
                "actual_hours_total": wf_data["actual_hours_total"],
                "overtime_hours_total": wf_data["overtime_hours_total"],
                "training_compliance_rate_pct": wf_data["training_compliance_rate_pct"],
                "training_expired_logs": wf_data["training_expired_logs"],
                "distinct_employees_with_expired_training": wf_data["distinct_employees_with_expired_training"],
            },
            "maintenance": {
                "total_work_orders": mwo_data["total_work_orders"],
                "p1_priority_total": mwo_data["p1_priority_total"],
                "p1_not_completed_count": mwo_data["p1_not_completed_count"],
                "downtime_avoided_estimate_min": mwo_data["downtime_avoided_estimate_min"],
                "by_failure_mode": mwo_data["by_failure_mode"],
            },
        }

        evidence = (haz_ev[:1] + inc_ev[:1] + capa_ev[:1] + ptw_ev[:1] + wf_ev[:1] + mwo_ev[:1])
        total_examined = haz_cnt + wf_cnt + mwo_cnt
        return combined_payload, evidence, total_examined

    def build_fallback_summary(self, data: Dict[str, Any]) -> Tuple[str, List[str], List[str], List[str]]:
        ev = data["events_and_hazards"]
        capa = data["capa_backlog"]
        wf = data["workforce"]
        mwo = data["maintenance"]
        ptw = data["permits"]
        summary = (
            f"Executive Safety Brief ({data['plant_scope']}): {ev['total_events']} EHS events ({ev['by_severity'].get('CRITICAL', 0)} CRITICAL), "
            f"{capa['overdue_total_count']} overdue CAPAs, {ptw['permit_exception_total']} permit exceptions, "
            f"{wf['training_compliance_rate_pct']}% workforce training compliance across {wf['total_attendance_records']:,} logs, "
            f"and {mwo['p1_priority_total']} P1 maintenance work orders ({mwo['p1_not_completed_count']} open/planned)."
        )
        findings = [
            f"EHS Events: {ev['total_events']} total; CRITICAL={ev['by_severity'].get('CRITICAL', 0)}, HIGH={ev['by_severity'].get('HIGH', 0)}.",
            f"CAPA & Permits: {capa['pending_total_count'] if 'pending_total_count' in capa else capa['open_count'] + capa['in_progress_count']} pending actions ({capa['overdue_total_count']} overdue); {ptw['permit_exception_total']} permit exceptions.",
            f"Workforce & Maintenance: {wf['training_expired_logs']:,} EXPIRED training logs; {mwo['p1_not_completed_count']} P1 maintenance orders not yet completed.",
        ]
        recs = [
            "Prioritize supervisor verification on CRITICAL/HIGH overdue CAPAs and open PERMIT_EXCEPTION events.",
            "Schedule safety training renewals for EXPIRED employee logs and coordinate P1 maintenance safety walkdowns.",
        ]
        suggestions = [
            "Which employees have the most expired training logs?",
            "List the highest-severity overdue CAPAs and their owners",
        ]
        return summary, findings, recs, suggestions

