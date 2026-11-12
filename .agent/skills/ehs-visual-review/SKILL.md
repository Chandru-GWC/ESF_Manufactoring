---
name: ehs-visual-review
description: Visual QA, Plan-Design Review, and Live Defect-Fix Protocol for EHS Safety AI, adapted from gstack's plan-design-review and design-review workflows and Gravitas verification standards.
---

# EHS Visual Review & Design QA Protocol

Adapted from **gstack** (`plan-design-review` & `design-review`) and enforced alongside **Gravitas** verification invariants.

---

## 1. Pre-Implementation Design Critique (`plan-design-review`)

Before writing UI code for a page or component, audit the plan on 6 dimensions (scored 0–10; target >= 8/10):
1. **Information Hierarchy**: What are the 1st, 2nd, and 3rd focal points? Is there a single clear entry scan path (Header -> Critical Telemetry -> Visual Analytics -> Operational Table)?
2. **Domain Differentiation**: Does each module reflect its unique operational job rather than repeating an identical 4-card + table clone?
3. **Token & Dark-Mode Parity**: Are any light-only classes (`bg-white`, `text-slate-900`, `border-slate-200`) present in the component tree? Replace all with semantic tokens (`canvas-*`, `ink-*`, `line-*`).
4. **Anti-AI-Slop Check**: Reject oversized marketing heroes, gratuitous purple gradients, ungrounded sparklines, emoji icons, and card-in-card nesting without functional purpose.
5. **Edge-Case Readiness**: How does the view look when loading (`LoadingState`), disconnected (`ErrorState`), or zero-filtered (`EmptyState`)?
6. **Responsive Behavior**: How do header controls, filter bars, charts, and tables collapse at `768px` and `375px`?

---

## 2. Live Visual Audit Loop (`design-review`)

After every UI build, inspect the live running application (`http://localhost:4173` backed by `http://localhost:8000`) rather than relying on code inspection alone:

### Required Capture Matrix
Capture screenshots and inspect pixel-by-pixel at:
- **Desktop Light**: `1440 x 900`
- **Desktop Dark**: `1440 x 900` (`--color-scheme dark` / dark theme toggled)
- **Tablet**: `768 x 1024`
- **Mobile**: `375 x 812`

Also verify multi-page visual parity across representative views:
- Command Overview (charts + KPI strip + lineage + live event stream)
- Analytical Modules (Workforce & Shifts, Maintenance & Safety, Risk Register)
- Governance & Intelligence (Corrective Actions, AI Safety Assistant, Settings)

### Concrete Defect Categories to Check
1. **Text Truncation & Wrapping**:
   - Are any sidebar navigation items clipped with `...` at `1440px`?
   - Do telemetry pills (`17,360 Rows`, `Neon Live`) wrap awkwardly onto multiple lines?
2. **Dark Mode Contrast Bugs**:
   - Inspect breadcrumbs, table headers, table rows, badges, tooltips, modals, and drawers in dark mode. Zero invisible dark text on dark surfaces and zero harsh white blocks.
3. **Viewport Overflow & Clipping**:
   - Check `document.documentElement.scrollWidth <= window.innerWidth` at `1440px`, `768px`, and `375px`.
   - Ensure TopNavigation actions never clip off the right edge on tablet (`768px`).
4. **Console & Network Cleanliness**:
   - Zero uncaught runtime errors, React key warnings, or failing API calls in Chromium console.
5. **Metric Reconciliation**:
   - Confirm totals across Overview, Sidebar badges, Charts, and Tables reconcile 100% with live FastAPI responses for both `ALL` and single-plant filters (`IN-KA-01`, `IN-TN-01`).

---

## 3. Recording Results

Every visual review pass must log concrete defects and verified fixes in `docs/EHS_VISUAL_QA.md` with exact file references, screenshot paths, and pass/fail verdicts (`VERDICT: PASS` only when zero open P0/P1 visual defects remain after final build).

