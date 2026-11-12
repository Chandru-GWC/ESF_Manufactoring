  # EHS Industrial Digital Twin — Technical Architecture

## 1. Purpose & Conceptual Scope

The **EHS Industrial Digital Twin** provides an interactive isometric 3D workspace where safety teams inspect plant-wide and zone-level safety posture across all six verified areas in `ehs_core.fact_ehs_event`:
- `WAREHOUSE`
- `SMT`
- `QUALITY`
- `PACKAGING`
- `TEST`
- `FINAL_ASSEMBLY`

**Important Integrity Disclosure**: Because `fact_ehs_event` stores categorical `area` codes without CAD/BIM floorplan geometry or GPS coordinates, and `fact_maintenance_work_order` does not include an `area` column, the 3D scene is explicitly presented as a **Conceptual 6-Zone Factory Layout**. Zero spatial coordinates or machine-to-zone relationships are invented.

---

## 2. Technology & Bundle Splitting

- **Library**: `three` + `@types/three` (using `OrbitControls` from `three/addons/controls/OrbitControls.js`).
- **Code Splitting**: The Three.js canvas component (`FactoryDigitalTwinCanvas.tsx`) is loaded lazily via `React.lazy` inside `DigitalTwinView.tsx` so the main operational bundle remains lean.
- **Lifecycle Safety**:
  - `ResizeObserver` keeps canvas dimensions synchronized with container bounds (`devicePixelRatio` capped at `Math.min(window.devicePixelRatio, 2)` for laptop GPU efficiency).
  - Unmount executes full `THREE.Geometry`, `THREE.Material`, `OrbitControls`, and `WebGLRenderer` disposal.

---

## 3. Interactive Data Binding

Each conceptual zone displays live filtered metrics computed from `rawEvents` (and reconciled with `overviewSummary`):
- Total filtered events in zone
- Breakdown by `event_type` (`HAZARD_OBSERVATION`, `FIRST_AID`, `NEAR_MISS`, `PERMIT_EXCEPTION`, `AUDIT_FINDING`)
- Risk severity counts (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`)
- Open vs Closed CAPA status (`OPEN`, `IN_PROGRESS`, `CLOSED`)

Controls include:
- Plant scope sync (`ALL`, `IN-KA-01`, `IN-TN-01`)
- Event type & severity filter pills (updating both 3D zone markers and accessible zone table)
- Orbit / Pan / Zoom + Reset Camera + Zone Focus buttons
- Hover tooltip + Click-to-inspect Zone Detail Panel
- Automatic WebGL-unavailable fallback (interactive 2D zone floorplate + accessible tabular register)
