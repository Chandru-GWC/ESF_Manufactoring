---
name: ehs-engineering-workflow
description: Project-specific engineering, planning, verification, and scope discipline for the EHS Safety AI repository. Complements Gravitas invariants with project-specific FastAPI + Vite + Neon PostgreSQL checks.
---

# EHS Engineering Workflow Standard

This workflow complements the installed **Gravitas** reliability skill (`Read before write -> Plan -> Scoped Implement -> Verify with executed checks -> Report only observed evidence`). It never replaces or weakens Gravitas invariants.

---

## 1. Grounding Before Mutation

Before modifying any file:
1. Read the target file, its consumers, and shared types (`src/types/ehs.ts`, `src/services/api.ts`, `src/context/EhsContext.tsx`).
2. Check FastAPI endpoints and schemas (`backend/app/api/routes/`, `backend/app/schemas/`) before consuming new fields in the frontend.
3. Verify `.env` / secrets remain untouched and never exposed in client bundles or logs.

---

## 2. Change Budget & Architecture Guardrails

- **No Unapproved Dependencies**: Preserve React 18, Vite 6, Tailwind CSS 3.4, DaisyUI 4.12, Motion for React, Lucide React, FastAPI, SQLAlchemy, and Neon PostgreSQL. Do not install competing UI/chart packages when clean TypeScript + Tailwind + SVG components satisfy the requirement.
- **No API / Schema Drift**: Preserve existing FastAPI endpoints, Pydantic models, and `ehs_core` PostgreSQL schemas unless explicitly requested.
- **Zero-Mock Policy Enforcement**: Strip hardcoded database metric fallbacks (`?? 84`, `|| 16560`, random IDs) rather than introducing them.

---

## 3. Required Verification Gates (Post-Final-Edit)

Every repository-changing task must run and record actual outputs **after the last edit**:

1. **Frontend Type Check**:
   ```bash
   npx tsc --noEmit
   ```
   Expected: Exit code `0`, zero TypeScript errors.
2. **Frontend Production Build**:
   ```bash
   npm run build
   ```
   Expected: Exit code `0`, clean Vite bundle output.
3. **Backend API Test Suite**:
   ```powershell
   $env:PYTHONPATH="<repo>\backend"; backend\.venv\Scripts\python.exe -m pytest backend\tests -v
   ```
   Expected: All tests pass, zero failures.
4. **Live Runtime & Browser Verification**:
   - Inspect live FastAPI API responses (`http://localhost:8000/api/v1/...`) and production preview (`http://localhost:4173/`).
   - Verify all 13 navigation routes, plant filter updates (`ALL`, `IN-KA-01`, `IN-TN-01`), search/filter controls, drawers/modals, light & dark modes, and browser console cleanliness (0 uncaught errors).
5. **Responsive Screenshot Audit**:
   - Capture and visually inspect `1440x900` (Light & Dark), `768x1024`, and `375x812`.

---

## 4. Reporting Standard

Report only observed paths, symbol names, command outputs, and screenshot findings. Mark anything unchecked as `UNVERIFIED`.

