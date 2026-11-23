# EHS Safety AI — Agent Architecture & System Specification

## 1. Executive Architecture Summary

The **EHS Safety AI** platform features an enterprise multi-agent intelligence architecture integrated with **Neon Serverless PostgreSQL (schema `ehs_core`)**, computer vision inference workers, and an automated rule/alert engine.

### System Classification Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DISCOVERED SYSTEM INVENTORY                          │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. AI Agent                    │ 2. ML / CV Inference Models           │
│  • EHS Safety Agent            │  • Fall & Posture (OpenFall)          │
│    (inspect_schema + run_query)│  • Smoke & Fire (YOLOv8)              │
│                                │  • Exit Obstruction (YOLOv8n)         │
│                                │  • Forklift Near Miss (Proximity)     │
│                                │  • Machine Guarding (Perimeter)       │
│                                │  • Unsafe Climbing (Height / Ladder)  │
│                                ├───────────────────────────────────────┤
│                                │ 3. Automated Rule & BI Engines        │
├────────────────────────────────┤  • Event Alert Sync & Escalation      │
│ 4. Conceptual / Planned        │  • Ingestion Lineage Engine           │
│  • 3D Digital Twin Simulation  │  • Data Connectors Engine             │
│  • Physical LOTO Sensors       │                                       │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 2. Four Primary Architecture Layers

Every autonomous agent and intelligence capability implements a disciplined four-layer architecture:

### Layer 1: INPUT — Data Acquisition Layer
* **Source Systems:** EHS event logs, HRIS timekeeper attendance, CMMS maintenance orders, industrial CCTV cameras.
* **Database:** Neon PostgreSQL 18.6 (schema `ehs_core`).
* **Source Tables:**
  * `ehs_core.fact_ehs_event` (Primary Key: `ehs_event_id`, 500+ records)
  * `ehs_core.fact_workforce_attendance` (Primary Key: `attendance_id`, 16,560 shift logs)
  * `ehs_core.fact_maintenance_work_order` (Primary Key: `work_order_id`, 400 work orders)
  * `ehs_core.safety_alerts` (Primary Key: `alert_id`, deduplicated active and historical alerts)
* **API Endpoints:**
  * `POST /api/v1/ai/query` (Multi-agent natural language query routing)
  * `GET /api/v1/ai/agents` (Agent registry metadata)
  * `GET /api/v1/ai/health` (DomoGPT connectivity probe)
  * `GET /api/v1/detection/library` & `POST /api/v1/detection/analyze` (Video CV inference)
  * `GET /api/v1/alerts` (Real-time safety alert query)

### Layer 2: PROCESSING — Data Engineering & Business Logic Layer
* **Pipeline Sequence:**
  1. *Schema Validation:* Pydantic models validate input parameters and payload structure.
  2. *Data Extraction:* Asynchronous read-only SQLAlchemy queries fetch raw dataset rows.
  3. *Business Rule Evaluation:* Severity classification, overdue date comparison (`due_date < CURRENT_DATE`), and Pareto sorting.
  4. *Evidence Token Budgeting:* Evidence citations formatted into JSON payloads capped for prompt window limits.
* **Component Locations:**
  * Agent loop: `backend/app/agents/agent.py` (instructions in `instruction.py`)
  * Tools: `backend/app/agents/tools/` (`inspect_schema.py`, `run_query.py`, `sql_guard.py`, `catalog.py`)
  * Video Workers: `backend/app/detection/workers/`

### Layer 3: PRESENTATION — Business Intelligence & UI Layer
* **UI Views:**
  * `/overview`: Executive Safety Operations Command Center with real-time KPIs, active alerts, and plant performance.
  * `/monitoring`: Dedicated Safety Video Intelligence analysis with 6 operational/heuristic scenarios and 3D Facility Twin.
  * `/events/hazards`: Hazard Register, action items, and inspection drawers.
  * `/agents`: AI Safety Assistant Studio with the EHS Safety Agent, evidence inspection and the tool-call trace.
  * `/agent-architecture`: Interactive architecture dashboard with pan/zoom diagrams and 4-layer inspection.
  * `/insights`: Data Connectors, Reports & Export, System Settings.
* **Verified KPIs:**
  * *Work Hours:* `SUM(actual_hours)` from `fact_workforce_attendance`.
  * *Training Compliance Rate:* `(COUNT(CURRENT) / Total) * 100`.
  * *Overdue CAPAs:* `COUNT(*) WHERE action_status != "CLOSED" AND due_date < CURRENT_DATE`.
  * *P1 Open Maintenance:* `COUNT(*) WHERE priority = "P1" AND status != "COMPLETED"`.
  * *Avoided Downtime:* `SUM(downtime_avoided_estimate_min) / 60`.

### Layer 4: AI INTELLIGENCE — Models & Guardrails
* **Cognitive Capabilities:**
  * **Analyse:** Identifies category concentrations, recurring shift hotspots, and failure modes.
  * **Detect:** Detects worker slips/falls (OpenFall), flames/smoke (YOLOv8), and blocked emergency doors (YOLOv8n).
  * **Predict:** Flags recurring near-miss clusters as probable precursors to recordable injuries.
  * **Recommend:** Proposes concrete containment actions, engineering controls, and refresher training.
  * **Automate:** Automates SLA reminders, alert generation, and evidence compilation.
* **Safety Guardrails & Regulatory Mandates:**
  * **Human-in-the-Loop:** Safety officers must review and confirm all alerts and CAPA recommendations before status changes.
  * **Zero Synthetic Hallucinations:** Every figure cited in assistant responses is grounded in explicit Neon PostgreSQL primary keys (`EvidenceItem`).
  * **Strict Negative Boundaries:** Prohibits inferring fatigue from overtime hours and prohibits claiming physical LOTO hardware isolation without field issuer verification.

---

## 3. Discovered Agents & ML Models Catalog

| System Identifier | Category | Status | Primary Input | Inference Engine | Output Destination |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`ehs_safety_agent`** | AI Agent | Operational | Natural Language Query | DomoGPT + `inspect_schema` / `run_query` read-only SQL tools over the 3 core tables | AI Safety Assistant |
| **`fall_detection`** | CV Inference Model | Operational | CCTV RTSP Video | OpenFall (MediaPipe 33 Landmark) | Video Monitoring View |
| **`smoke_fire`** | CV Inference Model | Operational | CCTV RTSP Video | Ultralytics YOLOv8 | Video Monitoring View |
| **`exit_obstruction`** | CV Inference Model | Operational | CCTV RTSP Video | Ultralytics YOLOv8n + ROI Tracker | Video Monitoring View |
| **`alert_engine`** | Automated Rule Engine | Operational | EHS Events + CV Alerts | Asyncio 15s Background Scheduler | Notifications Center |
| **`digital_twin_spatial`** | Simulation | Partial | Area Hazard Counts | Three.js WebGL Scene Graph | 3D Facility Twin |

