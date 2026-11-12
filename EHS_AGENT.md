# EHS & Safety AI Agent — System Charter & Operational Specification

**Version**: 1.0.0 Enterprise  
**Status**: Active Production Specification  
**Authority**: Senior Product Designer, Enterprise UI Architect, EHS Domain Specialist  

---

## 1. Agent Mission and Scope

The **EHS and Safety Agent** is an enterprise AI assistant and operational monitoring system designed to support Environmental Health & Safety (EHS) officers, plant managers, and safety compliance teams. 

### Primary Responsibilities:
1. **Workplace Hazard & Risk Visibility**: Track reported hazards, inspect severity classifications, and correlate location hotspots.
2. **Incident & Near-Miss Monitoring**: Record and review safety incidents, near-miss occurrences, and immediate response logs.
3. **Corrective & Preventive Action (CAPA) Tracking**: Monitor outstanding remediations, assignees, due dates, and closure evidence.
4. **Permit-to-Work (PTW) & Isolation (LOTO) Governance**: Track active high-risk permits (Hot Work, Confined Space, Electrical LOTO) to ensure compliance windows.
5. **Shift & Workforce Safety Context**: Correlate safety event frequencies with shift attendance patterns from workforce records without drawing unfounded individual culpability.
6. **Maintenance & Safety Intersections**: Link high-criticality maintenance work orders with safety isolation and permits.

---

## 2. Approved Data Sources

The agent is strictly bound to **three approved data sources**:

| Source Identifier | Source File | Data Domains Covered | Permitted Usages |
|---|---|---|---|
| **DS-01** | `fact_ehs_event.csv` | Hazards, Incidents, Near Misses, Permits, Actions | Core safety event monitoring, risk levels, CAPA tracking, permit timelines |
| **DS-02** | `fact_workforce_attendance.csv` | Worker attendance, Shift logs, Headcount | Shift-wise event distribution, plant occupancy context during events |
| **DS-03** | `fact_maintenance_work_order.csv` | Maintenance work orders, Equipment tags, Work types | Cross-referencing maintenance interventions with permit requirements and hazardous conditions |

---

## 3. Strict Zero-Mock Data Policy & Governance

### Golden Rules:
- **NO FABRICATION**: Under no circumstances shall the application create fictional employees, synthetic incidents, simulated hazards, fabricated sensor readings, or invented compliance scores.
- **NO HARDCODED METRICS**: If an operational metric cannot be computed directly from an ingested file, display an **Awaiting Data Ingestion** or **Calculation Definition Missing** state.
- **NO UNGROUNDED TRIFR / LTIFR**: Total Recordable Incident Frequency Rate (TRIFR) and Lost Time Injury Frequency Rate (LTIFR) require certified total plant work-hours. Do not invent an arbitrary rate.
- **AUDITED EXCLUSIONS**: If a module (e.g. Audits, Training) lacks an approved dataset, the UI must explain the prerequisite data schema and prompt the data engineering team rather than rendering fake records.

---

## 4. Brand Palette & Visual Tokens (Section 9.1 Spec)

| Token Name | Light Theme Hex | Dark Theme Hex | Semantic Role |
|---|---|---|---|
| Brand Purple | `#6F3DBA` | `#A684EE` | Primary action, AI assistant badges, key active states |
| Brand Blue | `#4D8EEB` | `#78ACF5` | Informational status, secondary links, active focus rings |
| Brand Orange | `#F58A3A` | `#FFAB63` | Warning alerts, near-miss indicator, medium severity |
| Brand Navy | `#1F2F59` | `#E7EDFA` | Sidebar rail, dark accents, prominent heading contrast |
| Brand White | `#FFFFFF` | `#E9EEFA` | Cards, elevated popovers, inverted text |
| Brand Background | `#FCFCFE` | `#0B1220` | Base canvas, background underlying layers |
| Blue Soft | `#EAF4FF` | `#142339` | Info badge background, soft pill highlights |
| Purple Soft | `#F3EEFF` | `#1E1836` | AI suggestion pills, subtle purple highlights |
| Peach Soft | `#FFF2EB` | `#2B1D17` | Warning badges, cautionary banner backgrounds |
| Sky | `#7FB0F2` | `#9CC4F8` | Timeline nodes, auxiliary charts |
| Cyan | `#31B7C3` | `#4FD3DE` | Environmental monitors, positive telemetry |

### Surface Hierarchy
- **Light Theme**: Page background `#F5F7FA`, Surface `#FFFFFF`, Secondary Surface `#F8FAFD`, Muted Fill `#EEF1F6`.
- **Dark Theme**: Page background `#090E1A`, Surface `#26334D`, Secondary Surface `#111A2B`, Muted Fill `#151E30`.

---

## 5. Technology Stack & Integration Architecture

- **Frontend Core**: React 18, TypeScript 5, Vite 6, Tailwind CSS 3.4.
- **CSS Normalization**: `normalize.css` for consistent cross-browser baseline rendering.
- **Component Foundations**: `daisyui` (version 4) customized via CSS variables to match the EHS brand palette.
- **Animation System**: `motion` (`import { motion, AnimatePresence } from "motion/react"`).
- **Icons**: `lucide-react`.
- **Backend Architecture**:
  - Python FastAPI REST API (`/api/v1/*`)
  - Neon PostgreSQL Database (Read-only analytical querying; dedicated schema namespace)
  - LangChain + Domo AI Model for grounded EHS natural language queries
- **Missing Data Protocol**:
  1. Detect absence of required table/CSV.
  2. Emit `DataState.DISCONNECTED` or `DataState.UNAVAILABLE`.
  3. Render structured schema request cards with downloadable field definitions.

---

## 6. Safety Governance & AI Guardrails

1. **Human-in-the-Loop Always**: The AI Agent provides intelligence, retrieval, and pattern detection. It **never** automatically closes critical incidents or approves high-risk permits without human sign-off.
2. **No Hardware Overrides**: The agent has zero capability to bypass physical interlocks or issue machine-level PLC/SCADA commands.
3. **Escalation Protocol**: Immediate visual warnings and manager dispatch notifications for any Uncontrolled Critical Hazards.

