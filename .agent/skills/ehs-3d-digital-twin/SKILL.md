---
name: ehs-3d-digital-twin
description: Architecture, spatial integrity rules, Three.js performance, accessibility, and WebGL fallback standards for the EHS Industrial Digital Twin module.
---

# EHS Safety AI — 3D Industrial Digital Twin Standard

This skill governs the **EHS Industrial Digital Twin** (`digital-twin`), powered by **Three.js** (`three` + `three/addons/controls/OrbitControls.js`).

---

## 1. Strict Data & Location Integrity Rules

The Neon PostgreSQL `ehs_core.fact_ehs_event` table records operational zones via the `area` column (`WAREHOUSE`, `SMT`, `QUALITY`, `PACKAGING`, `TEST`, `FINAL_ASSEMBLY`).

1. **Conceptual Spatial Representation Only**:
   - The 3D factory floor is explicitly labeled **"Conceptual Factory Zone Visualization (Area-Level Aggregation)"**.
   - Never claim live IoT telemetry, real-time SCADA links, GPS coordinates, physical machine coordinates, or machine-to-area foreign keys unless supplied in Neon.
   - All 6 operational zones display exact SQL/verified aggregations (`total events`, `HAZARD_OBSERVATION`, `FIRST_AID`, `NEAR_MISS`, `CRITICAL` count, `OPEN` CAPA count) filtered dynamically by active plant (`ALL`, `IN-KA-01`, `IN-TN-01`), event type, and severity.
2. **Maintenance Data Context**:
   - Maintenance work orders (`fact_maintenance_work_order`) do NOT contain an `area` column. Display plant-level maintenance summaries alongside the zone view cleanly without inventing a machine-to-zone mapping.

---

## 2. Visual & Architectural Design (Aligned with NidhiDrishti + Section 9.1)

- **Restrained Enterprise Isometric Aesthetic**:
  - Neutral architectural factory slab, subtle safety walkways, realistic industrial equipment silhouettes per conceptual zone (racks/pallets for `WAREHOUSE`, SMT pick-and-place lines for `SMT`, metrology inspection bays for `QUALITY`, conveyor packaging lines for `PACKAGING`, diagnostic test benches for `TEST`, final assembly robotics for `FINAL_ASSEMBLY`).
  - Avoid neon glows, harsh cyberpunk shaders, or ungrounded particle explosions.
- **Brand & Severity Color Encoding**:
  - Neutral industrial slate/concrete/steel for structural geometry.
  - Brand Purple (`#6F3DBA`) for selected zone outline/highlight and primary EHS markers.
  - Critical (`#DC2626`), High (`#EA580C`), Warning (`#F58A3A`), Compliant/Low (`#16A34A`) for area severity markers and elevation pedestals.

---

## 3. Interaction, Performance & Accessibility Guardrails

1. **Lazy Loading**: Always load the 3D scene via `React.lazy()` + `<Suspense>` so `three` is code-split out of the initial dashboard bundle.
2. **WebGL Fallback & Reduced Motion**:
   - Test WebGL context availability safely before mounting `WebGLRenderer`; when unavailable, render an interactive 2D SVG/Grid Spatial Zone Map + full data table automatically.
   - Respect `prefers-reduced-motion`: disable continuous idle indicator pulses/rotation when reduced motion is enabled.
3. **Full Resource Disposal**: On component unmount or resize, cancel animation frames, remove event listeners/ResizeObserver, dispose all geometries, materials, and `renderer.dispose()`.
4. **Camera Controls & Accessible Alternative**:
   - Smooth `OrbitControls` with damping, bounded polar angle (`0.25` to `Math.PI / 2.25`), zoom limits, "Reset Camera" button, and interactive zone quick-select pills + full accessible table view synced with the exact same filtered dataset.

