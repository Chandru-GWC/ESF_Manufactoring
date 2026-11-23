# EHS Safety AI — Redesign Plan & Gravitas Execution Contract

## 1. Gravitas Policy & Task Contract

```json
{
  "policy_record": {
    "planning": "deep",
    "context_depth": "dependency",
    "verification_depth": "suite",
    "delegation": "none",
    "reason_codes": [
      "architecture",
      "multiple-files",
      "shared-module",
      "broad-blast-radius"
    ]
  },
  "mode": "implement",
  "objective": "Redesign complete EHS Safety AI frontend with Gravitas workflow, 5 design references, master skill system, theme-safe reusable components, Tremor-inspired real-data analytics, and distinct page architectures across all 13 modules.",
  "non_goals": [
    "Do not modify Neon PostgreSQL schemas or tables",
    "Do not alter FastAPI API contracts or database credentials",
    "Do not install unrequested third-party libraries",
    "Do not introduce mock or hardcoded fallback database metrics"
  ],
  "allowed_write_scope": [
    ".agent/skills/ehs-*",
    "docs/EHS_*.md",
    "docs/screenshots/*",
    "src/index.css",
    "src/lib/*",
    "src/types/ehs.ts",
    "src/services/api.ts",
    "src/context/EhsContext.tsx",
    "src/components/**/*",
    "src/views/**/*",
    "src/App.tsx"
  ],
  "acceptance_criteria": [
    "AC-1: Five EHS master skills and three docs (DESIGN_SYSTEM, REDESIGN_PLAN, VISUAL_QA) created",
    "AC-2: Zero hardcoded database fallback metrics in EhsContext, AppSidebar, or views; plant filter dynamically updates all summaries and badges via backend summary APIs",
    "AC-3: All UI primitives (DataTable, DetailDrawer, KPIStatCard, EmptyState, LoadingState, ErrorState, ConfirmationDialog, Pagination, StatusBadge, RiskIndicator, CommandPaletteModal, QuickLogModal, NotificationPanel) support both Light and Dark themes using semantic tokens",
    "AC-4: Sidebar displays all 13 module names without ellipsis truncation on 1440px and works cleanly as a drawer on mobile/tablet",
    "AC-5: TopNavigation fits cleanly at 1440px, 768px, and 375px with no clipped buttons or wrapped telemetry counts",
    "AC-6: All 13 views have tailored information architecture and Tremor-inspired analytics grounded in real Neon data",
    "AC-7: npx tsc --noEmit, npm run build, and backend pytest suite pass after final edits",
    "AC-8: Live browser & screenshot review across 1440x900 (light & dark), 768x1024, and 375x812 confirms zero console errors and zero layout regressions"
  ]
}
```

---

## 2. Baseline Findings & Defects Diagnosed

1. **Dark Mode Component Breakage**: `DataTable`, `DetailDrawer`, `EmptyState`, `LoadingSkeleton`, `ConfirmationModal`, `Pagination`, `Breadcrumb`, `FilterDropdown`, `SearchInput`, `FormField`, `AlertPanel`, `ActivityTimeline`, `CommandPaletteModal`, and `QuickLogModal` still use hardcoded `bg-white`, `border-slate-200`, `text-slate-900`. In Dark mode, `PageHeader` breadcrumb becomes unreadable dark text on a dark canvas (`ehs_redesign_dark_1440.png`).
2. **Duplicate Breadcrumb**: `OverviewView.tsx` renders an extra breadcrumb above `PageHeader`, which already renders a breadcrumb.
3. **Sidebar Label Truncation (`1440px`)**: `w-64` (`256px`) minus `w-14` (`56px`) leaves only `200px` for inner nav labels + badges, truncating 6 labels (`Hazard Monitori...`, `Incident Manage...`, etc.) and wrapping `LINEAGE SYNC` / `Zero-Mock Verified`.
4. **TopNavigation Tablet Clipping (`768px`)**: Right-edge "Data Lineage" button clips at `768px` width and `17,360 Rows` wraps onto two lines.
5. **Hardcoded Metric Fallbacks & Static Plant Totals**: `EhsContext.tsx` only fetches `overview`, `events`, `workforce (limit 500)`, and `maintenance`, missing `/api/v1/events/summary`, `/api/v1/analytics/workforce/summary`, and `/api/v1/analytics/maintenance/summary`. As a result, plant switching (`IN-KA-01` / `IN-TN-01`) leaves hardcoded numbers (`16,560`, `46,644 m`, `?? 84`) in views and sidebar badges.
6. **Uniform Page Layouts**: Most of the 13 pages repeat an identical 4-card + table template with no domain-specific Tremor visualizations.

---

## 3. Page-by-Page Information Architecture Redesign

| Page | Layout & Visualization Signature | Grounded Neon Source |
| :--- | :--- | :--- |
| 1. Command Overview | 6-KPI Telemetry Strip + Interactive Weekly Event Trend Area Chart + Area Density Bar Chart + Risk Severity Breakdown + DataLineagePanel + Live Stream | `overview`, `events/summary`, `rawEvents` |
| 2. Hazard Monitoring | Hazard Category Horizontal Bar Chart + Action Status Progress Funnel + Filterable Table + Inspection Drawer | `events/summary`, `rawEvents (HAZARD_OBSERVATION)` |
| 3. Incident Management | Weekly Near-Miss vs First-Aid Area Chart + Shift Breakdown + 0-LTI Compliance Banner + RCA Detail Drawer | `events/summary`, `rawEvents (FIRST_AID, NEAR_MISS)` |
| 4. Workforce & Shifts | Shift A/B/C Exposure & Headcount Comparison Chart + Attendance/Skill-Match Trackers + Paginated Roster Table | `workforce/summary`, `rawAttendance` |
| 5. Maintenance & Safety | Work Order Priority Stacked Bar + Failure Mode Ranked Bar Chart + Downtime Avoided KPI + MWO Inspector Drawer | `maintenance/summary`, `rawMaintenance` |
| 6. Corrective Actions | CAPA Status Stacked Bar (`OPEN`/`IN_PROGRESS`/`CLOSED`) + Owner Workload Concentration + Progress Table | `events/summary`, `rawEvents` |
| 7. Permit & LOTO | Permit Posture Split (Active / Under Exception / Closed) + Exception Focus Queue + PTW Checklist Drawer | `events/summary`, `rawEvents` |
| 8. Inspections & Audits | Audit Finding Severity vs Closure Chart + Area Audit Concentration + Audit Finding Table & Drawer | `rawEvents (AUDIT_FINDING)` |
| 9. Risk Register | Interactive 4-Tier Risk Severity Selector Matrix + Area-by-Risk Breakdown + Filterable Risk Ledger | `events/summary`, `rawEvents` |
| 10. Training Matrix | Certification Compliance Tracker (`CURRENT` vs `EXPIRED`) + Skill-Match Telemetry + Refresher Action Queue | `workforce/summary`, `rawAttendance` |
| 11. AI Safety Assistant | Split Workbench: Grounded Live Metrics Sidebar + Conversational Safety Analyst with Clickable DB Citations | `overviewSummary`, `workforceSummary`, `maintenanceSummary`, `eventSummary` |
| 12. Reports & Export | Statutory Compliance Export Cards with Live Row Counts + Dataset Schema Preview Table | `rawEvents`, `rawAttendance`, `rawMaintenance`, `datasetStatuses` |
| 13. System Settings | Regulatory Framework Inspector (`ISO_45001`, `OSHA_US`, `EU_DIRECTIVES`, `FACTORIES_ACT_IN` — labeled display-only), Theme Control, Neon SSL Verification | `framework`, `theme`, `overviewSummary` |
| 14. Industrial Digital Twin | Lazy-loaded Three.js 3D Isometric Conceptual Factory (6 verified `area` zones), Event Type & Severity Filters, Camera Orbit/Reset, Zone Detail Inspector & Accessible Table/WebGL Fallback | `rawEvents`, `overviewSummary`, `maintenanceSummary` |

---

## 4. Incremental Execution Phases

1. Design Tokens (`src/index.css`) & Motion Library (`src/lib/motion.ts`)
2. Types, API Client & Summary-Backed `EhsContext.tsx` (zero hardcoded DB fallbacks)
3. Reusable UI Components (`src/components/ui/*` & `src/components/common/*` — full dark-mode + accessibility upgrade + new `AnalyticsChart`, `LoadingState`, `ErrorState`, `DataLineagePanel`, `RiskIndicator`)
4. Layout Shell (`ApplicationShell`, `AppSidebar`, `SidebarNavigationItem`, `TopNavigation`)
5. Command Overview + All 12 Remaining Pages
6. Verification Suite (`tsc`, `vite build`, `pytest`, Playwright browser interaction + console check + responsive screenshots)

