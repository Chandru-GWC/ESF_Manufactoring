# EHS Safety AI Platform — Enterprise Design Specification

**Authority**: Senior Product Designer, UI/UX Architect, Design Systems Engineer  
**Framework**: React 18 + Vite 6 + Tailwind CSS 3.4 + DaisyUI 4.12 + Motion for React (`motion/react`)  
**Design Reference**: MotionSites AI Web Builder Craft Standard + Section 9.1 Enterprise Brand Palette  
**Data Grounding**: 17,360 Physical Records in Neon PostgreSQL (`ehs_core`)  

---

## 1. Design Vision & Product Purpose

The **EHS Safety AI Platform** is an industrial safety operations command center. It serves plant environmental health and safety managers overseeing multi-facility manufacturing plants (`IN-KA-01` and `IN-TN-01`).

### The 3 Core Design Pillars:
1. **Operational Honesty**: Every displayed figure, chart, badge, and metric reconciles with Neon PostgreSQL tables. No synthetic numbers or fake sensor readings.
2. **Industrial Utility & High-Density Scannability**: Fast visual triage of critical hazards, overdue corrective actions, machine work orders, and shift compliance.
3. **Restrained Cinematic Polish (MotionSites Technique)**: Muted surfaces, high-contrast typography, hairline borders, and purposeful micro-motion.

---

## 2. MotionSites Technique Adaptations

From our inspection of the MotionSites repository (`Motionsites-AI/claude-skill`), three key craft patterns were adapted:

### Technique A: "Depth Through Subsurface Layering"
Instead of heavy dropshadows or generic glassmorphism, depth is created by 4 disciplined layers:
1. Viewport Canvas (`--bg-app`)
2. Structured Card Surface (`--bg-surface` with `1px solid var(--border-subtle)`)
3. Contrast Pill Accents (`--brand-purple-soft`, `--blue-soft`, `--peach-soft`)
4. Data Figures in tabular monospace (`font-mono font-bold`)

### Technique B: "Choreographed Staggered Entrances"
Elements do not pop abruptly or animate excessively. Dashboard grids enter with a calibrated stagger sequence:
- Navigation bar: 0ms
- Page title & facility selector: 40ms
- Operational KPI Cards: 80ms - 200ms (40ms per card)
- Data Grid / Distribution panels: 240ms

### Technique C: "Look-and-Fix Review Loop"
Every view is audited against:
- Zero horizontal overflow at 375px (Mobile), 768px (Tablet), and 1440px (Desktop).
- No unhandled nulls or empty fallback boxes.
- Smooth transition between Light (`:root`) and Dark (`:root[data-theme="dark"]`).

---

## 3. Brand Identity & Visual Tokens (Section 9.1 Spec)

| Token Name | Light Theme Hex | Dark Theme Hex | Usage Role |
|---|---|---|---|
| **Brand Purple** | `#6F3DBA` | `#A684EE` | Primary action buttons, AI chips, active rail highlights |
| **Brand Blue** | `#4D8EEB` | `#78ACF5` | Info badges, verified record links, focus rings |
| **Brand Orange** | `#F58A3A` | `#FFAB63` | Warnings, near misses, medium priority items |
| **Brand Navy** | `#1F2F59` | `#E7EDFA` | Industrial navigation rail, prominent headings |
| **Brand White** | `#FFFFFF` | `#E9EEFA` | Cards, elevated popovers, text contrast |
| **Brand Background** | `#FCFCFE` | `#0B1220` | Base canvas layer |
| **Blue Soft** | `#EAF4FF` | `#142339` | Informational pill fills |
| **Purple Soft** | `#F3EEFF` | `#1E1836` | Active navigation pill, AI suggestion chips |
| **Peach Soft** | `#FFF2EB` | `#2B1D17` | Warning notices, cautionary banner backgrounds |
| **Sky** | `#7FB0F2` | `#9CC4F8` | Timeline nodes, secondary chart markers |
| **Cyan** | `#31B7C3` | `#4FD3DE` | Environmental monitoring & verified CAPA |

---

## 4. Operational Dataset Lineage

All dashboard modules pull directly from the verified Neon backend:
1. `ehs_core.fact_ehs_event` (400 rows) $\rightarrow$ Command Overview, Hazard Monitoring, Incident Management, CAPA Actions, Permits.
2. `ehs_core.fact_workforce_attendance` (16,560 rows) $\rightarrow$ Workforce & Shifts, Training Matrix, Plant Exposure Hours.
3. `ehs_core.fact_maintenance_work_order` (400 rows) $\rightarrow$ Maintenance & Safety Intersections, Machinery Risk Profiling.

Modules awaiting dedicated external pipelines (`Inspections & Audits`, `Risk Register`) display verified **Data Awaiting Pipeline** states with exact required schema definitions.

