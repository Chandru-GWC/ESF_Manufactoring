# EHS Safety AI — Enterprise Design System Documentation

**Platform**: EHS & Safety AI Agent  
**Stack**: React 18, TypeScript 5.6, Vite 6, Tailwind CSS 3.4, DaisyUI 4.12, Motion for React (`motion/react`), Lucide React  
**Backend Grounding**: FastAPI + SQLAlchemy + Neon PostgreSQL (`ehs_core`, 17,360 verified rows)  
**Design Foundations**: SaaSUI & Mobbin, shadcn Dashboard, Tremor Analytics, Emil Kowalski Motion, gstack Visual QA, Section 9.1 Brand Palette

---

## 1. Visual Identity & Color System (Section 9.1)

All surfaces, ink, borders, and statuses resolve through CSS custom properties defined in `src/index.css` and mapped in `tailwind.config.js`. Hardcoded light-only classes (`bg-white`, `text-slate-900`, `border-slate-200`) are forbidden in reusable UI components and views.

### Core Brand Tokens

| Semantic Token | Light Theme (`:root`) | Dark Theme (`[data-theme="dark"]`) | Role |
| :--- | :--- | :--- | :--- |
| `--brand-purple` | `#6F3DBA` | `#A684EE` | Primary CTAs, active nav pill, AI assistant highlights |
| `--brand-blue` | `#4D8EEB` | `#78ACF5` | Workforce telemetry, informational status, links |
| `--brand-orange` | `#F58A3A` | `#FFAB63` | Warnings, permit exceptions, hazard focus accents |
| `--brand-navy` | `#1F2F59` | `#E7EDFA` | Inner sidebar chrome (light), strong brand headings |
| `--brand-white` | `#FFFFFF` | `#E9EEFA` | Card surfaces (light), primary dark-mode ink |
| `--brand-bg` | `#FCFCFE` | `#0B1220` | Root viewport canvas |
| `--bg-app` | `#F5F7FA` | `#090E1A` | Application workspace backdrop |
| `--bg-surface` | `#FFFFFF` | `#162033` | Elevated cards, drawers, tables, modals |
| `--bg-subtle` | `#F8FAFD` | `#111A2B` | Table headers, secondary panels, inputs |
| `--bg-muted` | `#EEF1F6` | `#1C273D` | Hover tracks, inactive pill fills |
| `--border-subtle` | `#E2E8F0` | `#1E293B` | Hairline 1px borders and table dividers |
| `--border-default` | `#CBD5E1` | `#334155` | Interactive controls, inputs, chart frames |

---

## 2. Typography & Numerical Alignment

**Primary Interface Font**: `Manrope` (weights 400, 500, 600, 700, 800; fallback `Inter`, system-ui).
- **Technical Monospace Font**: `JetBrains Mono` (`tabular-nums`) for every KPI count, identifier (`EHS-*`, `ATT-*`, `MWO-*`, `PTW-*`), percentage, timestamp, and table number.
- **Scale**:
  - Page H1: `20px–24px` (`font-bold tracking-tight`)
  - Section H2: `14px` (`font-semibold`)
  - KPI Stat Figure: `24px–28px` (`font-bold font-mono tabular-nums`)
  - Standard Body & Table Cell: `12px–13px`
  - Overlines & Table Headers: `10px–11px` (`uppercase tracking-wider font-semibold`)

---

## 3. Composable Component Architecture (`src/components/`)

### Layout Shell (`src/components/layout/`)
- **`ApplicationShell`**: Orchestrates responsive sidebar offset, sticky header, keyboard shortcuts (`⌘K`/`Ctrl+K`), global modals, and `<MotionConfig reducedMotion="user">`.
- **`AppSidebar` & `SidebarNavigationItem`**: Two-tier industrial navigation (`48px` burgundy rail + `236px` navy panel = `284px` expanded; `64px` collapsed; slide-over drawer `< 1024px`). Displays all 13 labels without ellipsis truncation and dynamically binds verified SQL counts per module.
- **`TopNavigation`**: Sticky `56px` utility bar with mobile menu toggle, command palette trigger, plant switcher (`ALL`, `IN-KA-01`, `IN-TN-01`), regulatory badge, live Neon telemetry indicator, reload trigger, theme toggle, and notifications.

### Core UI Primitives (`src/components/ui/`)
- **`PageHeader`**: Unified breadcrumb + title + description + plant verification badge + optional action slot.
- **`KPIStatCard`**: Theme-aware metric card with top accent bar, optional trend/context delta, unit label, and Neon table lineage footnote.
- **`AnalyticsChart`**: Tremor-inspired theme-aware visualization suite supporting:
  - `area`: SVG time-series trend chart with hover tooltips & gridlines
  - `bar-horizontal`: Ranked category comparison bars with direct count + share labels
  - `bar-vertical`: Multi-shift / grouped comparison columns
  - `stacked-bar`: Proportional status/severity composition bar with interactive legend
  - `tracker`: High-density compliance / health strip
- **`DataTable` + `Pagination`**: Sticky theme-aware headers, sortable columns, accessible focus states, clickable detail row selection, integrated pagination, `LoadingState`, and `EmptyState`.
- **`FilterToolbar`**: Unified search, multi-select facets, active record telemetry, and reset action.
- **`StatusBadge` & `RiskIndicator`**: Tokenized status/severity pills pairing color dots/icons with explicit uppercase text.
- **`DetailDrawer` & `ConfirmationDialog`**: Keyboard-accessible (`Escape`, focusable close) slide-over drawer and alert dialog using semantic dark/light tokens.
- **`LoadingState`, `EmptyState`, `ErrorState`, `DataLineagePanel`**: Explicit data-state handling for zero-mock compliance.

---

## 4. Motion Choreography (`src/lib/motion.ts`)

Following Emil Kowalski's animation guidelines:
- Root `<MotionConfig reducedMotion="user">` respects OS accessibility preferences globally.
- Custom `ease-out` curve `[0.23, 1, 0.32, 1]` for quick, natural deceleration (`140ms–200ms`).
- Modals scale from `0.97 -> 1.0` (never `scale(0)`).
- Only `transform` and `opacity` animate during routine transitions.

