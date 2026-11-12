---
name: ehs-analytics-ui
description: Enterprise Data Visualization and KPI Card Standards for EHS Safety AI, adapted from Tremor's dashboard visualization architecture and Neon PostgreSQL zero-mock data integrity.
---

# EHS Analytics & Data Visualization Standard

Adapted from **Tremor** (`Card`, `BarChart`, `AreaChart`, `Tracker`, `Tooltip`) for TypeScript + React + Tailwind + Lucide + SVG/HTML accessible visualizations.

---

## 1. Chart Selection by Data Semantics

Every chart must answer a concrete operational question using verified Neon PostgreSQL data:

| Operational Question | Chart Type | Source Data Field |
| :--- | :--- | :--- |
| Daily/Weekly EHS Event Volume Over Time | **Area / Trend Chart** (`AnalyticsChart` variant=`area`) | `fact_ehs_event.event_ts` bucketed by week/date |
| Events by Plant Area / Hazard Category / Failure Mode | **Horizontal Bar Comparison** (`variant="bar-horizontal"`) | `/events/summary` (`by_area`, `by_hazard_category`) & `/maintenance/summary` (`by_failure_mode`) |
| Multi-Shift Comparison (Shift A / B / C) | **Grouped Column / Comparison Bar** (`variant="bar-vertical"`) | `/events/summary` (`by_shift`), `/workforce/summary` (`by_shift`) |
| Proportional Composition (CAPA Status / Severity / Priority) | **Segmented Proportional Bar + Legend** (`variant="stacked-bar"`) | `/events/summary` (`by_action_status`, `by_severity`), `/maintenance/summary` (`by_priority`) |
| Certification / Shift Health Strip | **Segmented Tracker** (`variant="tracker"`) | `/workforce/summary` (`by_training_compliance`, `by_status`) |

---

## 2. Tremor-Inspired Component Anatomy (`AnalyticsChart` & `KPIStatCard`)

1. **Card Frame**:
   - Crisp header with title, concise subtitle explaining exact scope/unit, and source table pill (`ehs_core.fact_*`).
   - Summary total or delta in `font-mono tabular-nums` right-aligned in the header.
2. **Readable Axes, Legends & Direct Labels**:
   - Always label axes or bars directly with exact counts and percentages (reconciled to the exact sum!).
   - Do not encode status using color alone — always include text labels, numeric counts, and legends.
3. **Interactive Tooltips**:
   - Hovering or focusing a bar, point, or segment surfaces a theme-aware tooltip (`bg-canvas-surface border-line-default text-ink-primary shadow-elevated`) displaying label, exact count, percentage share, and unit.
4. **Accurate Proportions (No Arbitrary Multipliers)**:
   - Bar widths must be calculated honestly relative to the maximum bar (`value / maxValue * 100%`) or true percentage of total (`value / total * 100%`), NEVER arbitrary hacks like `pct * 2.8%` which can exceed 100% on single-plant filters!
5. **Color Harmony (Section 9.1)**:
   - Use semantic colors mapped to meaning: Brand Purple (`#6F3DBA`) for primary EHS series, Brand Blue (`#4D8EEB`) for workforce/controls, Brand Orange (`#F58A3A`) for warnings/exceptions, Emerald for verified/closed/compliant, Crimson for Critical.

---

## 3. Zero-Mock & Plant-Filter Reconciliation Rules

- **Summary Endpoints Over Client Slicing**: Since `fact_workforce_attendance` holds `16,560` rows and table views paginate/fetch slices (`limit <= 1000`), ALL aggregate KPIs and charts MUST read from `/api/v1/analytics/overview`, `/api/v1/events/summary`, `/api/v1/analytics/workforce/summary`, and `/api/v1/analytics/maintenance/summary` filtered by active `plant_id`.
- **Loading / Empty / Error States**: Every `AnalyticsChart` and `KPIStatCard` supports `isLoading` (skeleton shimmer), `error` (explicit retry banner), and empty data (`EmptyState` instead of fake zeroes).

