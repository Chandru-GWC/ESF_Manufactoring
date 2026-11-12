---
name: ehs-enterprise-design
description: Enterprise EHS & Safety AI Agent product design system, brand identity tokens (Light/Dark mode), typography, motion, accessibility, and strict zero-mock data policies.
---

# EHS & Safety Enterprise Design System

This skill defines the visual language, design system tokens, typography rules, component blueprints, motion guidelines, and data governance policies for the **EHS & Safety AI Agent** application.

---

## 1. Core Design Principles

1. **Safety & Operational Honesty**: Never fabricate safety statistics, false real-time sensor metrics, or fake incident records. EHS managers make life-or-death compliance decisions; UI transparency is paramount.
2. **Industrial Utility over Ornamentation**: Contrast, readability, and immediate information hierarchy supersede decorative flourishes. Color carries strict semantic meaning (Severity/State), never arbitrary decoration.
3. **Calibrated Density**: Dense, scannable data layouts (like Linear, Stripe, and Datadog) optimized for operational shifts, inspections, and audit reviews.
4. **Resilient Data State Model**: Graceful handling of connected vs. disconnected states, missing columns, unverified join keys, and empty datasets with actionable instructions for the data engineering team.

---

## 2. Brand Color Palette (Section 9.1 Exact Specification)

### Light Theme (`:root`)
- **Brand Purple**: `#6F3DBA` (`--brand-purple`)
- **Brand Blue**: `#4D8EEB` (`--brand-blue`)
- **Brand Orange**: `#F58A3A` (`--brand-orange`)
- **Brand Navy**: `#1F2F59` (`--brand-navy`)
- **Brand White**: `#FFFFFF` (`--brand-white`)
- **Brand Background**: `#FCFCFE` (`--brand-bg`)
- **Blue Soft**: `#EAF4FF` (`--blue-soft`)
- **Purple Soft**: `#F3EEFF` (`--purple-soft`)
- **Peach Soft**: `#FFF2EB` (`--peach-soft`)
- **Sky**: `#7FB0F2` (`--sky`)
- **Cyan**: `#31B7C3` (`--cyan`)

**Surfaces & Borders (Light)**:
- Page Background: `#F5F7FA`
- Surface: `#FFFFFF`
- Secondary Surface: `#F8FAFD`
- Muted Fill: `#EEF1F6`
- Border Subtle: `#E2E8F0`
- Border Default: `#CBD5E1`

### Dark Theme (`:root[data-theme="dark"]`)
- **Brand Purple**: `#A684EE`
- **Brand Blue**: `#78ACF5`
- **Brand Orange**: `#FFAB63`
- **Brand Navy**: `#E7EDFA`
- **Brand White**: `#E9EEFA`
- **Brand Background**: `#0B1220`
- **Blue Soft**: `#142339`
- **Purple Soft**: `#1E1836`
- **Peach Soft**: `#2B1D17`
- **Sky**: `#9CC4F8`
- **Cyan**: `#4FD3DE`

**Surfaces & Borders (Dark)**:
- Page Background: `#090E1A`
- Surface: `#26334D`
- Secondary Surface: `#111A2B`
- Muted Fill: `#151E30`
- Border Subtle: `#1E293B`
- Border Default: `#334155`

---

## 3. Typography Rules

- **Primary Font**: `Montserrat`, sans-serif (Headings, buttons, navigation, UI labels, body text).
- **Secondary Monospace Font**: `JetBrains Mono` or `IBM Plex Mono`, monospace.
  - Used for: Incident IDs (`INC-2026-081`), Work Order IDs (`WO-9844`), Permit Numbers, coordinates, timestamps (`ISO 8601`), and data table numerical figures (`tabular-nums`).
- **Hierarchy Scale**:
  - H1 / Display: 24px (1.5rem) - SemiBold (600)
  - H2 / Section: 18px (1.125rem) - SemiBold (600)
  - H3 / Card Title: 14px (0.875rem) - Medium (500)
  - Body Text: 13px (0.8125rem) - Regular (400)
  - Micro / Labels: 11px (0.6875rem) - Medium/SemiBold (500/600)

---

## 4. Strict Zero-Mock Data Policy

1. **No Fake Records**: Do NOT create mock employees, incidents, hazards, permits, work orders, or compliance percentages to make empty pages look populated.
2. **Approved Data Sources Only**:
   - `fact_ehs_event.csv` (Hazards, Incidents, Near Misses, Permits, Actions)
   - `fact_workforce_attendance.csv` (Workforce attendance, Shift context)
   - `fact_maintenance_work_order.csv` (Maintenance work orders, Safety-related maintenance)
3. **Disconnected & Missing-Data States**:
   - When a dataset is not yet ingested, display a dedicated **Data Source Awaiting Ingestion** notice.
   - Outline the specific schema requirements and contact point for the data engineering team.
   - When a calculation lacks required fields (e.g. TRIFR without total employee work hours), state: *"Metric definition requires total operational hours from workforce dataset."*

---

## 5. Motion and Animation Rules

- Import from `motion/react`:
  ```tsx
  import { motion, AnimatePresence } from "motion/react";
  ```
- Use spring animations with moderate stiffness and high damping:
  ```tsx
  transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
  ```
- Respect `prefers-reduced-motion` at all times.

---

## 6. Accessibility & DaisyUI Rules

- DaisyUI is installed and scoped with `--daisyui` tokens mapped to the brand palette.
- Do not let default DaisyUI themes override brand tokens.
- All interactive controls must support visible keyboard focus rings (`focus-ring`).
- Maintain a minimum 4.5:1 contrast ratio for all text elements.

