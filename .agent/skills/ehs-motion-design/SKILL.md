---
name: ehs-motion-design
description: Precision UI Motion and Interaction System for EHS Safety AI, adapted from Emil Kowalski's animation engineering rules and Motion for React best practices.
---

# EHS Motion Design Standard

Adapted from **Emil Kowalski's `skill`** (`animate` & `emil-design-eng`) for **Motion for React (`motion/react`)** in an industrial safety workspace.

---

## 1. Core Principles

1. **Purpose Over Ornament**: Motion in safety software exists solely to clarify spatial hierarchy, maintain context during drawer/modal opens, and acknowledge user clicks. Never add continuous bouncing or slow cinematic entrances that delay operational triage.
2. **Never Delay the Payload**: Data tables, KPI figures, and search results must appear crisply without waiting on heavy staggered queues. Keep stagger under `0.025s` and total entrance under `200ms`.
3. **Accessibility First (`prefers-reduced-motion`)**:
   - Wrap the application root in `<MotionConfig reducedMotion="user">` from `motion/react`.
   - When reduced motion is active, replace positional translations (`y`, `x`) and scale shifts with fast opacity fades (`<= 120ms`).
   - Also honor `@media (prefers-reduced-motion: reduce)` in `src/index.css` for CSS transitions.

---

## 2. Curves, Timing & Spring Rules

| Surface / Interaction | Duration / Physics | Curve / Spring | Rule |
| :--- | :--- | :--- | :--- |
| **Hover / Focus / Button Press** | `120ms–150ms` | `ease-out` (`[0.23, 1, 0.32, 1]`) | Never use `ease-in`; buttons use subtle `active:scale-[0.98]`. |
| **Page View Switch** | `140ms` enter / `100ms` exit | `cubic-bezier(0.23, 1, 0.32, 1)` | Exits faster than entrances; tiny `y: 4px` (disabled under reduced motion). |
| **Modals & Command Palette** | `160ms` enter / `120ms` exit | `cubic-bezier(0.16, 1, 0.3, 1)` | **Ban `scale(0)`**: scale only from `0.97 -> 1.0` + `opacity: 0 -> 1`. |
| **Detail Drawer (Sheet)** | `200ms` enter / `150ms` exit | `cubic-bezier(0.16, 1, 0.3, 1)` | Slides cleanly on GPU (`transform: translateX`). |
| **Active Navigation Indicator** | Spring (`stiffness: 420, damping: 34`) | Controlled bounce (`<= 0.15`) | Uses `layoutId` shared element transition without overshooting. |
| **Keyboard / High-Frequency Inputs** | `0ms` | None | Typing, search filtering, and keyboard table navigation never animate. |

---

## 3. Performance Guardrails

- **Compositor Properties Only**: Animate strictly `transform` (`x`, `y`, `scale`) and `opacity`.
- **Forbidden Animations**: Never animate CSS `width`, `height`, `top`, `left`, `margin`, or `padding` via React state or keyframes when avoidable (use `transform` or short hardware-friendly transitions on discrete state toggles like sidebar collapse).
- **Consistent Easing Tokens**: Define shared animation variants/constants in `src/lib/motion.ts` so every modal, drawer, and view shares identical mechanical feel.

