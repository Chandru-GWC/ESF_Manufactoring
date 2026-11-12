---
name: ehs-frontend-design
description: Master Enterprise Frontend Design System & Craft Standard for the EHS Safety AI Platform. Synthesizes SaaSUI + Mobbin enterprise patterns, shadcn Dashboard composable architecture, Tremor analytics discipline, Emil Kowalski motion craft, gstack visual review gates, and Section 9.1 Brand Palette with strict Neon PostgreSQL zero-mock data governance.
---

# EHS Safety AI — Master Frontend Design System

This skill is the authoritative UI/UX and architecture standard for every view, shell, component, modal, drawer, and token in **EHS Safety AI**.

---

## 1. Product Identity & Architectural Philosophy

**EHS Safety AI** is an industrial safety intelligence and operations platform serving safety managers across multi-plant manufacturing operations (`IN-KA-01` Bangalore and `IN-TN-01` Chennai).

### Visual Benchmark: NidhiDrishti AI Refinement + Section 9.1 Identity
Synthesizing the sculptural clarity of **NidhiDrishti AI** with **Linear**, **Stripe**, **Vercel**, **Datadog**, and **Tremor**:
- **Surfaces & Elevation**: Soft, warm-neutral canvas (`#F5F4F2` / `#FCFCFE` light, `#090E1A` dark) paired with pure crisp elevated surfaces (`#FFFFFF` light, `#151F32` dark), generous `rounded-2xl` (`16px`) cards, hairline `1px` borders, subtle shadow elevation, and zero excessive nesting.
- **Navigation Rail + Structured Sidebar**: Narrow vertical icon rail paired with crisp white/navy-contrast structured navigation (`280px` expanded / `64px` collapsed desktop, drawer on mobile/tablet) with zero truncated labels.
- **14th Signature Module**: Dedicated lazy-loaded **Three.js Industrial Digital Twin** (`digital-twin`) mapping the 6 conceptual plant zones (`WAREHOUSE`, `SMT`, `QUALITY`, `PACKAGING`, `TEST`, `FINAL_ASSEMBLY`) directly from verified `fact_ehs_event.area` counts with strict location integrity.

### Core Design Pillars (Adapted from SaaSUI, Mobbin & shadcn Dashboard)
1. **Zero-Mock Operational Honesty**:
   - Every KPI, chart datum, navigation badge, and table row must originate strictly from verified FastAPI endpoints backed by Neon PostgreSQL (`ehs_core.fact_ehs_event`, `ehs_core.fact_workforce_attendance`, `ehs_core.fact_maintenance_work_order`).
   - Never inject hardcoded database counts (e.g., `?? 84`, `|| 16560`) or `Math.random()` IDs.
   - When an API response is loading, render `LoadingState` skeletons. When unavailable or errored, render `ErrorState` with explicit retry controls. When filtered results equal 0, render `EmptyState` with filter-reset actions.
2. **Composable Shell Architecture (shadcn Dashboard Pattern)**:
   - Persistent `ApplicationShell` composing `AppSidebar` (total `280px` expanded / `64px` collapsed on desktop, full slide-over drawer `< 1024px`), sticky `TopNavigation` (56px), and centered fluid workspace (`max-w-[1440px]`).
3. **Distinct Information Architecture per Module**:
   - Reject identical "4 KPI cards + table" templates across all 14 pages. Tailor each view's layout to its operational workflow:
     - **Command Overview**: Executive telemetry strip, capsule/bar & trend visualizations, risk severity matrix, compact Digital Twin launch card, ingestion lineage panel, and live event stream.
     - **Industrial Digital Twin**: Interactive isometric Three.js 6-zone factory floorplate + event/severity filters + zone detail inspector + WebGL fallback + accessible list view.
     - **Hazard Monitoring**: Hazard category breakdown bar chart + filterable triage table + right-side inspection drawer.
     - **Incident Management**: Near-miss vs. First-Aid trend + shift exposure split + RCA detail drawer + 0 LTI verification banner.
     - **Workforce & Shifts**: Shift A/B/C headcount & actual hours comparison + attendance status distribution + overtime/skill-gap telemetry + paginated roster table.
     - **Maintenance & Safety**: Priority (P1/P2/P3) vs. Failure Mode breakdown + work order execution tracker + downtime avoided ledger.
     - **Corrective Actions (CAPA)**: Resolution funnel (Open / In Progress / Closed) + owner workload concentration + due-date timeline table.
     - **Permit & LOTO**: Active / Exception / Closed permit posture + exception focus queue + LOTO verification checklist drawer.
     - **Inspections & Audits**: Audit non-conformity matrix by area & severity + statutory closure tracker.
     - **Risk Register**: Interactive 4-tier severity triage matrix (Critical / High / Medium / Low) + category cross-filter + risk event log.
     - **Training Matrix**: Fleet certification compliance tracker (Current vs. Expired) + skill-match rate + expired refresher queue.
     - **AI Safety Assistant**: Two-column workbench — grounded KPI context rail + conversational analyst with clickable dataset citations.
     - **Reports & Export**: Statutory dataset export cards (`fact_ehs_event`, `fact_workforce_attendance`, `fact_maintenance_work_order`) with live preview and verified schema columns.
     - **System Settings**: Regulatory standard governance (`ISO_45001`, `OSHA_US`, `EU_DIRECTIVES`, `FACTORIES_ACT_IN`), theme switcher, and Neon SSL posture.

---

## 2. Section 9.1 Brand Palette & Semantic Tokens

**All UI components MUST use semantic CSS-variable Tailwind classes (`bg-canvas-surface`, `text-ink-primary`, `border-line-subtle`) — never hardcoded `bg-white`, `text-slate-900`, or `border-slate-200` that break Dark Mode.**

| Token Role | Light (`:root`) | Dark (`[data-theme="dark"]`) | Tailwind Semantic Class |
| :--- | :--- | :--- | :--- |
| Brand Purple | `#6F3DBA` | `#A684EE` | `brand-purple` |
| Brand Blue | `#4D8EEB` | `#78ACF5` | `brand-blue` |
| Brand Orange | `#F58A3A` | `#FFAB63` | `brand-orange` |
| Brand Navy | `#1F2F59` | `#E7EDFA` | `brand-navy` |
| App Canvas | `#FCFCFE` / `#F5F7FA` | `#090E1A` / `#0B1220` | `bg-canvas-app` |
| Card Surface | `#FFFFFF` | `#162033` | `bg-canvas-surface` |
| Subtle Fill | `#F8FAFD` | `#111A2B` | `bg-canvas-subtle` |
| Primary Text | `#1F2F59` | `#E9EEFA` | `text-ink-primary` |
| Secondary Text | `#475569` | `#CBD5E1` | `text-ink-secondary` |
| Muted Text | `#64748B` | `#94A3B8` | `text-ink-muted` |
| Subtle Border | `#E2E8F0` | `#1E293B` | `border-line-subtle` |
| Default Border | `#CBD5E1` | `#334155` | `border-line-default` |

### Color Discipline
- Never saturate whole screens in purple or stack multi-hue gradients. Reserve `#6F3DBA` for primary actions, active navigation pills, and key AI identifiers; `#4D8EEB` for informational/workforce telemetry; `#F58A3A` for warnings and maintenance/permit exceptions.

---

## 3. Typography & Hierarchy

- **Sans (`font-sans`)**: `'Montserrat'`, system-ui, sans-serif for headings, navigation, labels, and prose.
- **Mono (`font-mono tabular-nums`)**: `'JetBrains Mono'`, monospace for all numeric KPIs, event IDs (`EHS-00001`), permit IDs (`PTW-0042`), machine tags, timestamps, and percentages.
- **Type Scale Rules**:
  - H1 Page Title: `20px–24px`, Bold (`font-bold`), tight tracking (`tracking-tight`).
  - H2 Card / Chart Title: `14px`, SemiBold (`font-semibold`).
  - KPI Metric Figure: `24px–28px`, Bold (`font-bold font-mono tabular-nums`).
  - Body / Table Cell: `12px–13px` (`text-xs` / `text-[13px]`), `leading-relaxed`.
  - Micro Eyebrow / Table Header: `10px–11px`, uppercase, `tracking-wider`, `font-semibold`.

---

## 4. Navigation, Header & Layout Contracts

1. **No Truncated Desktop Navigation Labels**: Expand desktop sidebar width (`276px–288px` expanded: `48px` rail + `228px–240px` nav panel) with `whitespace-nowrap` on labels so all 13 module names render completely intact without `...` ellipsis.
2. **Accurate Non-Duplicated Badges**: Every navigation badge reflects the true SQL-backed count for the currently selected plant scope (`ALL`, `IN-KA-01`, or `IN-TN-01`). Never share one count across unrelated tabs.
3. **Single Breadcrumb Per Page**: Render breadcrumbs exclusively inside `PageHeader` using semantic `text-ink-muted` / `text-ink-primary` contrast tokens (so breadcrumbs remain legible in dark mode). Never duplicate a second breadcrumb above `PageHeader`.
4. **Responsive TopNavigation (`h-14`)**:
   - No clipped buttons at `768px` or `375px` (`min-w-0`, responsive hiding of secondary metadata pills below `xl`/`lg`, no wrapping of `17,360 Rows` across lines).
   - Mobile hamburger button triggers the slide-over `AppSidebar` drawer (`lg:hidden`).

---

## 5. Components, Accessibility & Responsive Breakpoints

- **Mandatory Reusable Primitives**: `ApplicationShell`, `AppSidebar`, `SidebarNavigationItem`, `TopNavigation`, `PageHeader`, `KPIStatCard`, `AnalyticsChart`, `DataTable`, `FilterToolbar`, `StatusBadge`, `RiskIndicator`, `DetailDrawer`, `ConfirmationDialog`, `EmptyState`, `LoadingState`, `ErrorState`, `DataLineagePanel`.
- **Keyboard & A11y**: Every interactive control must be a native `<button>`, `<a>`, `<select>`, or `<input>` with visible `.focus-ring`, ARIA labels on icon buttons, `Escape` closing for modals/drawers/command palette, and WCAG AA `>= 4.5:1` contrast in both themes.
- **Breakpoints**: Audited cleanly with zero horizontal overflow at `1440x900` (Desktop), `768x1024` (Tablet), and `375x812` (Mobile).
