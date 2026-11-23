# EHS AI AGENT — ENTERPRISE DESIGN SYSTEM (DESIGN.md)

## 1. Product Identity & Design Vision
**EHS Safety AI** is a mission-critical, enterprise-grade Environmental Health, Safety & Industrial Risk intelligence platform. It is engineered for industrial operations managers, plant safety directors, and field EHS engineers in high-hazard manufacturing, energy, chemical, and heavy industrial environments.

The design language rejects generic "AI SaaS" templates (no purple neon glows, no pervasive nested floating cards, no decorative marketing hero sections, no emoji icons, and no fabricated vanity numbers). Instead, it synthesizes the restrained data discipline of **Linear**, the typography and spatial clarity of **Vercel**, the tabular density of **Stripe Dashboard**, and the operational urgency of **SafetyCulture** and **Datadog**.

---

## 2. Color Palette & Semantic Design Tokens

All colors are mapped to CSS custom variables on `:root` and follow strict semantic purpose: **color is reserved exclusively for operational meaning, never for arbitrary decoration**.

```css
:root {
  /* Surface & Canvas (Warm Off-White & Industrial Light) */
  --bg-app: #F8F9FA;              /* Warm off-white canvas */
  --bg-surface: #FFFFFF;          /* Pure white card and panel background */
  --bg-subtle: #F1F3F5;           /* Subtle row hover and inactive fills */
  --bg-muted: #E9ECEF;            /* Muted container fills, track backgrounds */

  /* Deep Industrial Sidebar (Dark Navy / Deep Slate) */
  --sidebar-bg: #0F172A;          /* Deep industrial navy */
  --sidebar-surface: #1E293B;     /* Elevated sidebar card / popover */
  --sidebar-border: #334155;      /* Hairline border in dark chrome */
  --sidebar-text: #F8FAFC;        /* Crisp primary text in sidebar */
  --sidebar-text-muted: #94A3B8;  /* Muted metadata labels in sidebar */
  --sidebar-active: #1E293B;      /* Active navigation pill background */

  /* Text & Content Hierarchy */
  --text-primary: #0F172A;        /* Deep charcoal (high contrast ≥ 11:1) */
  --text-secondary: #475569;      /* Slate secondary text (≥ 6.5:1) */
  --text-muted: #64748B;          /* Muted metadata and table headers (≥ 4.6:1) */
  --text-disabled: #94A3B8;       /* Inactive controls and empty hints */

  /* Hairline Borders & Rules */
  --border-subtle: #E2E8F0;       /* Standard 1px structural hairpins */
  --border-default: #CBD5E1;      /* Interactive inputs and control borders */
  --border-strong: #94A3B8;       /* Focused elements and selected rows */

  /* Operational Accent */
  --accent-primary: #1D4ED8;      /* Deep industrial cobalt (interactive actions) */
  --accent-hover: #1E40AF;        /* Darkened cobalt for active states */
  --accent-subtle: #EFF6FF;       /* Hairline selection highlight */

  /* Strict Semantic Severity (Badges, Markers & Indicators Only) */
  /* CRITICAL (Immediate Life/Process Danger) */
  --severity-critical-text: #991B1B;
  --severity-critical-bg: #FEF2F2;
  --severity-critical-border: #FCA5A5;
  --severity-critical-dot: #DC2626;

  /* HIGH (Significant Hazard / Regulatory Breach Risk) */
  --severity-high-text: #9A3412;
  --severity-high-bg: #FFF7ED;
  --severity-high-border: #FDBA74;
  --severity-high-dot: #EA580C;

  /* MEDIUM / WARNING (Near Miss / Caution / Deviation) */
  --severity-warning-text: #854D0E;
  --severity-warning-bg: #FEFCE8;
  --severity-warning-border: #FDE047;
  --severity-warning-dot: #CA8A04;

  /* LOW / RESOLVED / SAFE (Controlled / Verified / Normal) */
  --severity-success-text: #166534;
  --severity-success-bg: #F0FDF4;
  --severity-success-border: #86EFAC;
  --severity-success-dot: #16A34A;

  /* NEUTRAL / INFORMATIONAL / DRAFT */
  --severity-info-text: #1E40AF;
  --severity-info-bg: #EFF6FF;
  --severity-info-border: #93C5FD;
  --severity-info-dot: #3B82F6;
}
```

---

## 3. Typography Scale & Hierarchy

Strict typographic scale inspired by **Linear** and **The Elements of Typographic Style**.
- Primary Interface Typeface: `Inter`, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto.
- Monospace Data Typeface: `JetBrains Mono`, `IBM Plex Mono`, `ui-monospace`, monospace (strictly reserved for incident IDs, timestamps, sensor telemetry, GPS, and machine codes).
- Maximum 3 text sizes per card or widget.
- Monospaced figures (`tabular-nums`) for all numbers and telemetry metrics.

| Level | Size | Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|---|
| **Display / Metric** | 32px (2rem) | 700 Bold | 1.1 | -0.025em | Main operational KPI values, primary counters |
| **Section Heading** | 20px (1.25rem) | 600 SemiBold | 1.25 | -0.015em | Page headers, major module titles |
| **Subheading / Panel Title** | 15px (0.9375rem) | 600 SemiBold | 1.3 | -0.01em | Card and section header titles |
| **Body / Primary** | 14px (0.875rem) | 400 Regular / 500 Medium | 1.45 | 0 | Standard table cells, description prose, form values |
| **Secondary / Caption** | 12px (0.75rem) | 400 Regular | 1.4 | 0 | Secondary detail, timestamps, helper text |
| **Micro / Overline** | 11px (0.6875rem) | 600 SemiBold | 1.2 | +0.05em | Uppercase badge labels, table column headers |

---

## 4. Spacing, Elevation & Structural Layout

- **Strict 4/8px Spatial Scale**: `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`.
- **Containers & Borders**:
  - Border Radius: `rounded-md` (6px) for standard cards and buttons; `rounded-sm` (4px) for badges; `rounded-lg` (8px) for modals and drawers.
  - Border Style: Hairline `1px solid var(--border-subtle)`.
  - Elevation / Shadows: Extremely subtle and flat. No floating blur clouds.
    `shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)`.
    Modals use `shadow-lg: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)`.
- **Anti-Slop Layout Rules**:
  - No nested card-in-card boxes. Use 1px hairline dividers (`border-t border-slate-200`) and spatial rhythm.
  - Tables flush against card borders (`rounded-none` internally) with sticky headers (`top-0 z-10 bg-white`).
  - Right-aligned tabular data (`tabular-nums`) for all numbers, counts, and dates.

---

## 5. Motion & Interaction Design (Motion for React)

Following the **Snap & Silk** mechanical personality from `ui-motion` and `enterprise-taste`:
- **Speed & Pacing**: High-speed, mechanical response (**120ms to 200ms**). No sluggish 400ms animations.
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (Linear / Raycast snappy feel).
- **Interactive Affordances**:
  - Buttons & Links: `whileTap={{ scale: 0.98 }}` for tactile mechanical feedback.
  - Drawer & Modal: Silk entrance with slide from right (`x: "100%" -> 0`) or scale entrance (`scale: 0.98 -> 1.0, opacity: 0 -> 1`).
  - Sidebar Collapse: Smooth animated width transition (64px collapsed, 260px expanded).
- **Accessibility & Reduced Motion**:
  - Fully respects `prefers-reduced-motion: reduce`. When active, all durations collapse to 0ms.
- **Never Delay the Payload**: Metrics, search queries, and table rows render immediately without artificial stagger delays.

---

## 6. Component Architecture & System Registry

The design system implements a unified component library:
1. `AppSidebar`: Dark navy industrial navigation with collapsibility, facility badge, section grouping, and user profile.
2. `TopNavigation`: Sticky utility bar with plant switcher, system status indicator, global quick-search, alert notification trigger, and AI assistant shortcut.
3. `PageHeader`: Clean title, contextual breadcrumbs, primary actionable buttons, and refresh/export controls.
4. `KPIStatCard`: Standardized metric card with primary tabular figure, delta comparison badge, sparkline/trend summary, and traceable footnote.
5. `DataTable`: Data-dense enterprise table with sticky header, sorting, pagination, search, filter chips, and row-click inspector drawer trigger.
6. `StatusBadge` & `SeverityIndicator`: Accessible, shape-augmented status indicators (Circle, Triangle, Octagon, Check).
7. `DetailDrawer`: Slide-over inspector panel with rich tabbed breakdown, timeline, audit logs, and action buttons.
8. `AIChatPanel`: Integrated EHS Safety Copilot with grounded query execution, citation tags, and recommended mitigations.
9. `ConfirmationModal`: Accessible focus-trapped dialog for destructive actions.
10. `LoadingSkeleton`: Clean subtle shimmer states without layout shift.

