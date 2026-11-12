---
name: ehs-enterprise-design
description: Enterprise EHS & Safety AI Agent product design system, adapted from MotionSites Web Builder craft techniques, Section 9.1 Brand Palette (Light/Dark mode), calibrated density, subtle motion, accessibility, and strict zero-mock data governance.
---

# EHS & Safety Enterprise Design System (MotionSites Adapted)

This skill defines the visual language, design system tokens, typography rules, component blueprints, motion guidelines, and data governance policies for the **EHS & Safety AI Platform**. It incorporates the craftsmanship, structural discipline, and review-loop principles from the **MotionSites Web Builder** standard.

---

## 1. Core Principles (MotionSites Craft Adapted for Industrial SaaS)

1. **Safety & Operational Honesty (Rule #1)**:
   - Never fabricate safety statistics, false real-time sensor metrics, or fake incident records. EHS managers make life-or-death compliance decisions; UI transparency is paramount.
   - Ground all metrics in the 17,360 actual records residing in Neon PostgreSQL (`ehs_core`).
2. **Intentional Focal Points (MotionSites Rule #1)**:
   - Each view has one clear hierarchy: Header $\rightarrow$ Critical Alert Band (if any) $\rightarrow$ Operational KPI Cards $\rightarrow$ Data Table / Analytical Distribution.
   - Avoid equal-weight clutter. Important numbers (e.g. Critical Hazards, Open CAPA) are prominent; secondary metadata stays quiet in monospace.
3. **Calibrated Industrial Density & Negative Space**:
   - Spacing scale follows 4/8px rhythm: card paddings (20px/24px), row heights (44px), table gutters (16px).
   - Generous breathing room without floating, purposeless empty areas.
4. **Restraint over Decoration (MotionSites Craft)**:
   - No generic AI gradients, no floating geometric shapes, no heavy drop shadows.
   - Depth is achieved via **subtle hairline borders** (`1px solid var(--border-subtle)`), **tinted surface elevations**, and **soft scrims**.

---

## 2. Brand Color Palette (Section 9.1 Mandatory Specification)

### Light Theme (`:root`)
- **Brand Purple**: `#6F3DBA` (`--brand-purple`) — Primary interactive buttons, AI assistant badges, signature active indicator.
- **Brand Blue**: `#4D8EEB` (`--brand-blue`) — Informational indicators, verified links, focus rings.
- **Brand Orange**: `#F58A3A` (`--brand-orange`) — Warning state, near misses, medium priority.
- **Brand Navy**: `#1F2F59` (`--brand-navy`) — Left navigation rail, dark structural headers.
- **Brand White**: `#FFFFFF` (`--brand-white`) — Card surfaces, modal surfaces.
- **Brand Background**: `#FCFCFE` (`--brand-bg`) — Underlying viewport canvas.
- **Blue Soft**: `#EAF4FF` (`--blue-soft`) — Informational pill backgrounds.
- **Purple Soft**: `#F3EEFF` (`--purple-soft`) — Active rail highlights, AI suggestion chips.
- **Peach Soft**: `#FFF2EB` (`--peach-soft`) — Warning notice fills, caution highlights.
- **Sky**: `#7FB0F2` (`--sky`) — Timeline nodes, secondary chart markers.
- **Cyan**: `#31B7C3` (`--cyan`) — Environmental tracking, verified CAPA badges.

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

## 3. Typography & Micro-Hierarchy

- **Primary Font**: `Montserrat`, sans-serif (Display, Headings, Navigation, UI Actions).
- **Secondary Monospace Font**: `JetBrains Mono`, monospace.
  - Used for: Event IDs (`EHS-00042`), Attendance IDs (`ATT-00001187`), Work Order IDs (`MWO-00120`), Timestamps, and table numbers (`tabular-nums`).
- **Scale Contrast**:
  - H1 Page Title: 24px (1.5rem) - SemiBold (600), letter-spacing: -0.02em.
  - H2 Section Header: 16px (1rem) - SemiBold (600).
  - KPI Stat Figures: 28px - Bold (700) with JetBrains Mono numbers.
  - Body Text: 13px (0.8125rem) - Regular (400), line-height: 1.5.
  - Micro Metadata & Eyebrows: 10px-11px - Medium (500), uppercase, letter-spacing: +0.05em.

---

## 4. Motion & Choreography (MotionSites Adapted)

- **Library**: `motion/react` strictly.
- **Page Transitions**: Mode `wait` with subtle opacity and slight 4px Y-translation:
  ```tsx
  <motion.div
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
  >
  ```
- **Staggered Card Entrances**: Dashboard KPI cards animate in sequence with 0.04s stagger.
- **Active Navigation Pill**: LayoutId-based sliding pill on sidebar selection (`layoutId="active-nav-pill"`).
- **Reduced Motion**: Automatically respect `prefers-reduced-motion: reduce` by bypassing translations.

---

## 5. Review & Look-and-Fix Loop (MotionSites Protocol)

After any frontend change, apply the **6-point review check**:
1. **Console Check**: 0 console errors, 0 failed network requests.
2. **Overflow Check**: Zero horizontal scroll on mobile (375px) and desktop (1440px).
3. **Contrast & Readability**: All text meets WCAG AA (min 4.5:1 ratio).
4. **Data Honesty**: Zero hardcoded mock numbers. If data is missing from Neon, display honest `—` or empty state.
5. **Theme Integrity**: Check both Light and Dark mode appearances.
6. **Focus Rings**: All interactive controls feature visible keyboard focus rings (`focus-ring`).

