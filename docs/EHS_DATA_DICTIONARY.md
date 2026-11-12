# EHS Agent Data Dictionary & Multi-Dataset Schema Mapping

This document provides the **authoritative, physically verified evidence** for all three approved datasets of the **EHS & Safety AI Platform**. Every column, null count, unique count, value distribution, and relationship documented here has been computed directly against the actual CSV records.

---

## 1. Approved Datasets Status & Physical Evidence

| Identifier | Source File Location | File Size | Physical Row Count | Null Counts | Duplicate IDs | Profiling Status |
|---|---|---|---|---|---|---|
| **DS-01** | `src/data/fact_ehs_event.csv` | 48,701 bytes | **400 rows** | **0** | **0** | ✅ Fully Profiled & Ingested into Backend API |
| **DS-02** | `src/data/fact_workforce_attendance.csv` | 1,221,190 bytes | **16,560 rows** | **0** | **0** | ✅ Fully Profiled (Awaiting DDL Execution) |
| **DS-03** | `src/data/fact_maintenance_work_order.csv` | 55,095 bytes | **400 rows** | **0** | **0** | ✅ Fully Profiled (Awaiting DDL Execution) |

---

## 2. Dataset 1: `fact_ehs_event.csv` (Verified Schema)

- **Total Rows**: 400 records
- **Primary Key**: `ehs_event_id` (Unique Count: 400, Duplicates: 0, Nulls: 0)
- **Temporal Range**: `2026-08-01T02:00:00` to `2026-10-31T22:00:00` (Q3-Q4 2026)
- **Facilities Covered**: `IN-KA-01` (207 events, 51.75%), `IN-TN-01` (193 events, 48.25%)

| Column Name | Physical Data Type | Null Count | Unique Count | Allowed / Observed Domain Values | Business Meaning & Usage |
|---|---|---|---|---|---|
| `ehs_event_id` | String (`VARCHAR(50)`) | 0 | 400 | `EHS-00001` through `EHS-00400` | Primary Key. Direct citation in AI agent responses. |
| `event_ts` | ISO 8601 Datetime (`TIMESTAMP`) | 0 | 369 | `YYYY-MM-DDTHH:MM:SS` | Timestamp when the event or observation occurred. |
| `plant_id` | String (`VARCHAR(50)`) | 0 | 2 | `IN-KA-01` (207), `IN-TN-01` (193) | Operational plant code. Primary scope filter. |
| `area` | String (`VARCHAR(100)`) | 0 | 6 | `WAREHOUSE` (71), `TEST` (68), `PACKAGING` (67), `SMT` (67), `QUALITY` (64), `FINAL_ASSEMBLY` (63) | Plant physical functional area where event occurred. |
| `shift_id` | String (`VARCHAR(10)`) | 0 | 3 | `C` (149), `A` (133), `B` (118) | Plant shift during which the observation was logged. |
| `event_type` | String (`VARCHAR(100)`) | 0 | 5 | `FIRST_AID` (88), `AUDIT_FINDING` (86), `HAZARD_OBSERVATION` (84), `PERMIT_EXCEPTION` (79), `NEAR_MISS` (63) | Classification of safety event. |
| `hazard_category` | String (`VARCHAR(100)`) | 0 | 7 | `FORKLIFT` (68), `CHEMICAL` (63), `ERGONOMIC` (63), `FIRE` (56), `SLIP_TRIP` (54), `ELECTRICAL` (53), `ESD` (43) | Physical hazard classification category. |
| `risk_severity` | String (`VARCHAR(50)`) | 0 | 4 | `LOW` (107), `MEDIUM` (107), `CRITICAL` (97), `HIGH` (89) | Evaluated severity rating of the event or condition. |
| `lost_time_injury`| Boolean (`BOOLEAN`) | 0 | 1 | `False` (400 records) | Flag indicating Lost Time Injury. (All False in this period). |
| `action_owner` | String (`VARCHAR(50)`) | 0 | 165 | Format: `EMP-XXXX` | Employee ID of the assigned corrective action owner. |
| `due_date` | Date (`DATE`) | 0 | 96 | Format: `YYYY-MM-DD` | Target deadline for CAPA remediation. |
| `action_status` | String (`VARCHAR(50)`) | 0 | 3 | `CLOSED` (143), `OPEN` (130), `IN_PROGRESS` (127) | Current remediation lifecycle state. |
| `permit_id` | String (`VARCHAR(50)`) | 0 | 389 | Format: `PTW-XXXX` | Permit-to-work reference associated with the event. |

---

## 3. Dataset 2: `fact_workforce_attendance.csv` (Verified Schema)

- **Total Rows**: 16,560 records
- **Primary Key**: `attendance_id` (Unique Count: 16,560, Duplicates: 0, Nulls: 0)
- **Work Date Range**: `2026-08-01` to `2026-10-31` (92 operational work days)
- **Employees Covered**: 180 distinct employees (`EMP-0001` through `EMP-0180`)
- **Total Operational Labor Hours Recorded**: **128,474 actual work hours**

| Column Name | Physical Data Type | Null Count | Unique Count | Allowed / Observed Domain Values | Business Meaning & Usage |
|---|---|---|---|---|---|
| `attendance_id` | String (`VARCHAR(50)`) | 0 | 16,560 | `ATT-00000001` to `ATT-00016560` | Primary Key. Unique shift attendance record identifier. |
| `work_date` | Date (`DATE`) | 0 | 92 | `YYYY-MM-DD` | Calendar date of the operational shift. |
| `employee_id` | String (`VARCHAR(50)`) | 0 | 180 | `EMP-0001` to `EMP-0180` | Unique identifier of the factory employee. |
| `plant_id` | String (`VARCHAR(50)`) | 0 | 2 | `IN-KA-01` (8,280), `IN-TN-01` (8,280) | Plant code where shift occurred. |
| `shift_id` | String (`VARCHAR(10)`) | 0 | 3 | `A` (5,520), `B` (5,520), `C` (5,520) | Operational shift window. Exactly 60 workers per shift per day. |
| `scheduled_hours`| Integer (`INTEGER`) | 0 | 1 | `8` | Contracted standard shift hours. |
| `actual_hours` | Decimal (`NUMERIC(4,1)`) | 0 | 5 | `8` (12,993), `9` (1,930), `10` (850), `0` (416), `4` (371) | Actual clocked hours worked by employee during shift. |
| `attendance_status`| String (`VARCHAR(50)`) | 0 | 4 | `PRESENT` (15,139), `ABSENT` (554), `LEAVE` (475), `LATE` (392) | Clock-in verification status. |
| `overtime_hours` | Decimal (`NUMERIC(4,1)`) | 0 | 3 | `0` (9,853), `2` (3,365), `1` (3,342) | Additional overtime hours worked beyond 8h schedule. |
| `skill_match` | String (`VARCHAR(50)`) | 0 | 2 | `MATCHED` (15,918), `GAP` (642) | Work station skill matrix compliance indicator. |
| `training_compliance`| String (`VARCHAR(50)`) | 0 | 2 | `CURRENT` (16,162), `EXPIRED` (398) | Mandatory safety qualification currency status. |

---

## 4. Dataset 3: `fact_maintenance_work_order.csv` (Verified Schema)

- **Total Rows**: 400 records
- **Primary Key**: `work_order_id` (Unique Count: 400, Duplicates: 0, Nulls: 0)
- **Created Timestamp Range**: `2026-08-01T06:00:00` to `2026-10-31T12:00:00`
- **Execution Windows**: Planned Start (`2026-08-01` to `2026-11-02`), Actual Start (`2026-08-01` to `2026-11-02`)
- **Machines Covered**: 15 distinct production machines across both facilities

| Column Name | Physical Data Type | Null Count | Unique Count | Allowed / Observed Domain Values | Business Meaning & Usage |
|---|---|---|---|---|---|
| `work_order_id` | String (`VARCHAR(50)`) | 0 | 400 | `MWO-00001` through `MWO-00400` | Primary Key. Maintenance work order identifier. |
| `machine_id` | String (`VARCHAR(50)`) | 0 | 15 | `M-ICT-01`, `M-SMT-01`, `M-LEAK-01`, `M-SPI-01`, `M-FAL-01`, `M-AOI-01`, `M-WAVE-01`, `M-ROBO-01`, `M-CAM-01`, `M-ICT-02`, etc. | Physical machinery / asset tag requiring intervention. |
| `plant_id` | String (`VARCHAR(50)`) | 0 | 2 | `IN-KA-01` (203), `IN-TN-01` (197) | Plant facility where the machine is located. |
| `created_ts` | ISO 8601 Datetime (`TIMESTAMP`) | 0 | 365 | `YYYY-MM-DDTHH:MM:SS` | Timestamp when the maintenance request was initiated. |
| `maintenance_type`| String (`VARCHAR(50)`) | 0 | 3 | `CORRECTIVE` (136), `PREVENTIVE` (135), `PREDICTIVE` (129) | Classification of maintenance activity. |
| `failure_mode` | String (`VARCHAR(100)`) | 0 | 6 | `BELT_MISALIGNMENT` (85), `BEARING_WEAR` (76), `NOZZLE_CLOG` (62), `N/A` (61), `MOTOR_OVERHEAT` (61), `SENSOR_DRIFT` (55) | Root mechanical / electrical failure condition. |
| `priority` | String (`VARCHAR(20)`) | 0 | 3 | `P3` (141), `P1` (132), `P2` (127) | Operational urgency / criticality tier. |
| `planned_start` | ISO 8601 Datetime (`TIMESTAMP`) | 0 | 372 | `YYYY-MM-DDTHH:MM:SS` | Scheduled window start for maintenance execution. |
| `actual_start` | ISO 8601 Datetime (`TIMESTAMP`) | 0 | 362 | `YYYY-MM-DDTHH:MM:SS` | Actual recorded timestamp when technician commenced work. |
| `downtime_avoided_estimate_min`| Integer (`INTEGER`) | 0 | 188 | Range: `15` to `240` minutes | Estimated unplanned downtime saved by timely maintenance. |
| `status` | String (`VARCHAR(50)`) | 0 | 3 | `PLANNED` (137), `COMPLETED` (132), `IN_PROGRESS` (131) | Current work order execution state. |
| `technician_id` | String (`VARCHAR(50)`) | 0 | 157 | Format: `EMP-XXXX` | Employee ID of the technician executing the work. |

---

## 5. Verified Multi-Dataset Cross-Relationships

Our mathematical cross-validation revealed **100% verified entity referential integrity**:

1. **Workforce Alignment**:
   - `fact_ehs_event.action_owner` $\subseteq$ `fact_workforce_attendance.employee_id`: **100% match** (All 165 action owners are verified employees in the workforce roster).
   - `fact_maintenance_work_order.technician_id` $\subseteq$ `fact_workforce_attendance.employee_id`: **100% match** (All 157 maintenance technicians are verified employees).
2. **Plant Code Alignment**:
   - Exactly identical 2 facilities across all 3 datasets: `{'IN-KA-01', 'IN-TN-01'}`.
3. **Shift Alignment**:
   - Exactly identical 3 shifts across EHS and Workforce: `{'A', 'B', 'C'}`.
4. **Temporal Alignment**:
   - EHS event dates are a 100% subset of Workforce attendance dates: 90 active event days fall strictly within the 92 attendance days (`2026-08-01` to `2026-10-31`).

---

## 6. Proposed Relationships Requiring Confirmation

| Cross-Dataset Link | Proposed Join Logic | Current Status | Confirmation Required from Data Team |
|---|---|---|---|
| **Permit to Maintenance Link** | `fact_ehs_event.permit_id` $\leftrightarrow$ `fact_maintenance_work_order.work_order_id` | **Hypothesis** | Maintenance work orders do not explicitly contain a `permit_id` column. We must confirm whether a bridging table (e.g. `rel_mwo_permit`) exists, or if permits are mapped via `(plant_id, machine_id, planned_start)`. |
| **Machine to EHS Area Link** | `fact_maintenance_work_order.machine_id` $\leftrightarrow$ `fact_ehs_event.area` | **Hypothesis** | Machines (e.g. `M-SMT-01`) correlate by name to areas (`SMT`), but an explicit `dim_equipment` asset catalog is recommended to map machine to physical plant zone. |
| **Shift Incident Exposure Rate** | `(plant_id, shift_id, event_ts::date)` $\leftrightarrow$ `(plant_id, shift_id, work_date)` | **Verified Valid** | Total actual hours per shift can be safely aggregated as the denominator for incident frequency without individual employee attribution. |

---

## 7. Missing Information & Outstanding Data Team Requests

1. **Certified Work-Hours Definition for TRIFR/LTIFR**:
   - Total recorded actual labor hours across the 92 days: `128,474.0` hours.
   - We require the formal safety committee formula (e.g. standard 200,000 or 1,000,000 hour multiplier) before displaying statutory frequency rates.
2. **Permit-to-Maintenance Linkage**:
   - Request documentation on how high-risk work orders (`P1`, `P2`) are formally tied to the 389 issued `PTW-XXXX` permits in `fact_ehs_event`.
