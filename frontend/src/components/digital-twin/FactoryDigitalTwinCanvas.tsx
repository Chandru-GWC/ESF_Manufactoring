import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface ZoneMetricSummary {
  area: string;
  label: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  openActions: number;
  hazards: number;
  firstAid: number;
  nearMiss: number;
  permitExceptions: number;
  auditFindings: number;
}

interface FactoryDigitalTwinCanvasProps {
  zones: ZoneMetricSummary[];
  selectedArea: string | null;
  onSelectArea: (area: string) => void;
  theme: 'light' | 'dark';
  resetSignal: number;
  onWebGLUnavailable: () => void;
}

interface ZoneLayoutSpec {
  area: string;
  x: number;
  z: number;
  w: number;
  d: number;
  label: string;
}

const ZONE_LAYOUTS: ZoneLayoutSpec[] = [
  { area: 'WAREHOUSE',      x: -6.4, z: -3.2, w: 5.5, d: 4.8, label: 'WAREHOUSE' },
  { area: 'SMT',            x:  0.0, z: -3.2, w: 5.5, d: 4.8, label: 'SMT' },
  { area: 'QUALITY',        x:  6.4, z: -3.2, w: 5.5, d: 4.8, label: 'QUALITY' },
  { area: 'PACKAGING',      x: -6.4, z:  3.2, w: 5.5, d: 4.8, label: 'PACKAGING' },
  { area: 'TEST',           x:  0.0, z:  3.2, w: 5.5, d: 4.8, label: 'TEST' },
  { area: 'FINAL_ASSEMBLY', x:  6.4, z:  3.2, w: 5.5, d: 4.8, label: 'FINAL ASSEMBLY' },
];

const BASE_CAM_POS = new THREE.Vector3(16.5, 15.2, 18.2);
const DEFAULT_TARGET = new THREE.Vector3(0, 0.25, 0.2);

function getResponsiveCamPos(width: number, height: number): THREE.Vector3 {
  const aspect = width / Math.max(height, 1);
  // Pull back smoothly on narrower screens (tablet / mobile) so all 6 zones remain framed
  const scale = aspect < 1.3 ? Math.min(1.85, 1.42 / Math.max(aspect, 0.6)) : 1.0;
  return BASE_CAM_POS.clone().multiplyScalar(scale);
}

function hasWebGLSupport(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function getZoneStatusHex(zone?: ZoneMetricSummary): number {
  if (!zone || zone.total === 0) return 0x16a34a; // Clear Green
  if (zone.critical > 0) return 0xdc2626;         // Critical Red
  if (zone.high > 0) return 0xea580c;             // High Orange
  if (zone.medium > 0) return 0xf58a3a;           // Medium Amber-Orange
  return 0x16a34a;                                // Lower-risk Green (Low only)
}

export const FactoryDigitalTwinCanvas: React.FC<FactoryDigitalTwinCanvasProps> = ({
  zones,
  selectedArea,
  onSelectArea,
  theme,
  resetSignal,
  onWebGLUnavailable,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredZone, setHoveredZone] = useState<{
    zone: ZoneMetricSummary;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredAreaState, setHoveredAreaState] = useState<string | null>(null);

  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const selectedRef = useRef(selectedArea);
  selectedRef.current = selectedArea;
  const hoveredAreaRef = useRef<string | null>(null);
  hoveredAreaRef.current = hoveredAreaState;
  const onSelectRef = useRef(onSelectArea);
  onSelectRef.current = onSelectArea;
  const camResetRef = useRef(false);

  useEffect(() => {
    camResetRef.current = true;
  }, [resetSignal]);

  const sceneRefs = useRef<{
    masts: Record<string, THREE.Mesh>;
    lanterns: Record<string, THREE.Mesh>;
    lanternCaps: Record<string, THREE.Mesh>;
    towerRings: Record<string, THREE.Mesh>;
    padFrames: Record<string, THREE.LineSegments>;
    zonePads: Record<string, THREE.Mesh>;
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
  }>({ masts: {}, lanterns: {}, lanternCaps: {}, towerRings: {}, padFrames: {}, zonePads: {} });

  // Reactive visual update on data, selection, hover, and theme
  useEffect(() => {
    const { masts, lanterns, lanternCaps, towerRings, padFrames, zonePads, scene } = sceneRefs.current;
    const maxTotal = Math.max(...zones.map(z => z.total), 1);
    const isDark = theme === 'dark';

    ZONE_LAYOUTS.forEach(spec => {
      const summary = zones.find(z => z.area === spec.area);
      const isSelected = selectedArea === spec.area;
      const isHovered = hoveredAreaState === spec.area;
      const hex = getZoneStatusHex(summary);

      const ratio = summary ? summary.total / maxTotal : 0;
      const mastHeight = summary && summary.total === 0 ? 0.45 : Math.max(0.6, 0.55 + ratio * 1.45);
      const baseTopY = 0.24;

      const mast = masts[spec.area];
      if (mast) {
        mast.scale.y = mastHeight;
        mast.position.y = baseTopY + mastHeight * 0.5;
      }

      const lantern = lanterns[spec.area];
      if (lantern) {
        const mat = lantern.material as THREE.MeshStandardMaterial;
        mat.color.setHex(hex);
        mat.emissive.setHex(hex);
        mat.emissiveIntensity = isSelected ? 0.55 : isHovered ? 0.42 : 0.28;
        lantern.position.y = baseTopY + mastHeight + 0.16;
      }

      const lanternCap = lanternCaps[spec.area];
      if (lanternCap) {
        lanternCap.position.y = baseTopY + mastHeight + 0.34;
      }

      const ring = towerRings[spec.area];
      if (ring) {
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.color.setHex(isSelected ? 0x6f3dba : hex);
        mat.opacity = isSelected ? 0.95 : isHovered ? 0.78 : 0.48;
      }

      const pf = padFrames[spec.area];
      if (pf) {
        const mat = pf.material as THREE.LineBasicMaterial;
        mat.color.setHex(
          isSelected ? 0x6f3dba : isHovered ? 0x4d8eeb : isDark ? 0x3b4f73 : 0xc2cbd6
        );
        mat.opacity = isSelected ? 0.95 : isHovered ? 0.85 : 0.45;
      }

      const pad = zonePads[spec.area];
      if (pad) {
        const mat = pad.material as THREE.MeshStandardMaterial;
        if (isSelected) {
          mat.color.setHex(isDark ? 0x2a2050 : 0xf1ecff);
          mat.emissive.setHex(0x6f3dba);
          mat.emissiveIntensity = isDark ? 0.12 : 0.04;
        } else if (isHovered) {
          mat.color.setHex(isDark ? 0x243454 : 0xeff5ff);
          mat.emissive.setHex(0x4d8eeb);
          mat.emissiveIntensity = isDark ? 0.08 : 0.03;
        } else {
          mat.color.setHex(isDark ? 0x1b2944 : 0xf9fafb);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    });

    if (scene) {
      const bgHex = isDark ? 0x0b1220 : 0xf3f2ee;
      scene.background = new THREE.Color(bgHex);
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.setHex(bgHex);
      }
    }
  }, [zones, selectedArea, hoveredAreaState, theme]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!hasWebGLSupport()) {
      onWebGLUnavailable();
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
    } catch {
      onWebGLUnavailable();
      return;
    }

    const D = {
      geometries: [] as THREE.BufferGeometry[],
      materials: [] as THREE.Material[],
      textures: [] as THREE.Texture[],
    };
    const geo = <T extends THREE.BufferGeometry>(g: T) => { D.geometries.push(g); return g; };
    const mat = <T extends THREE.Material>(m: T) => { D.materials.push(m); return m; };
    const tex = <T extends THREE.Texture>(t: T) => { D.textures.push(t); return t; };

    const isDark = theme === 'dark';
    const bgHex = isDark ? 0x0b1220 : 0xf3f2ee;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.Fog(bgHex, 34, 65);

    const W = Math.max(container.clientWidth, 300);
    const H = Math.max(container.clientHeight, 340);
    const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
    camera.position.copy(getResponsiveCamPos(W, H));

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.15 : 1.06;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 11;
    controls.maxDistance = 38;
    controls.minPolarAngle = 0.22;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.target.copy(DEFAULT_TARGET);
    controls.panSpeed = 0.6;
    controls.rotateSpeed = 0.6;

    // Studio industrial lighting balanced for both Light & Dark modes
    scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.95 : 1.0));
    const hemi = new THREE.HemisphereLight(0xeef4ff, isDark ? 0x2a3954 : 0x8a95a5, isDark ? 0.75 : 0.65);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff9f2, isDark ? 1.35 : 1.25);
    key.position.set(14, 22, 13);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 55;
    key.shadow.camera.left = key.shadow.camera.bottom = -16;
    key.shadow.camera.right = key.shadow.camera.top = 16;
    key.shadow.bias = -0.0008;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xdbeafe, isDark ? 0.55 : 0.45);
    fill.position.set(-12, 10, -9);
    scene.add(fill);

    // Compact Architectural Factory Floorplate (20.4 x 13.8)
    const floorMat = mat(new THREE.MeshStandardMaterial({
      color: isDark ? 0x152136 : 0xe4e2db,
      roughness: 0.88,
      metalness: 0.05,
    }));
    const floor = new THREE.Mesh(geo(new THREE.BoxGeometry(20.4, 0.36, 13.8)), floorMat);
    floor.position.set(0, -0.18, 0);
    floor.receiveShadow = true;
    scene.add(floor);

    // Subtle Architectural Tile Grid
    const grid = new THREE.GridHelper(20, 20, isDark ? 0x263756 : 0xd0cdc5, isDark ? 0x1e2d48 : 0xd8d5cd);
    grid.scale.set(1.0, 1, 0.68);
    grid.position.y = 0.006;
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    (grid.material as THREE.LineBasicMaterial).opacity = isDark ? 0.45 : 0.35;
    scene.add(grid);

    // Low Perimeter Curb & Safety Corner Bollards (clean framing without blocking view)
    const curbMat = mat(new THREE.MeshStandardMaterial({
      color: isDark ? 0x2b3c5c : 0xc8c5bc,
      roughness: 0.75,
      metalness: 0.15,
    }));
    [
      [0, -6.82, 20.4, 0.16, 0.16],
      [0, 6.82, 20.4, 0.16, 0.16],
      [-10.12, 0, 0.16, 0.16, 13.8],
      [10.12, 0, 0.16, 0.16, 13.8],
    ].forEach(([cx, cz, w, h, d]) => {
      const curb = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), curbMat);
      curb.position.set(cx, 0.08, cz);
      curb.receiveShadow = true;
      scene.add(curb);
    });

    // Cross-aisle Safety Walkways
    const walkMat = mat(new THREE.MeshStandardMaterial({
      color: 0xf58a3a,
      roughness: 0.65,
      metalness: 0.08,
    }));
    const aisleH = new THREE.Mesh(geo(new THREE.BoxGeometry(19.6, 0.02, 0.24)), walkMat);
    aisleH.position.set(0, 0.01, 0);
    scene.add(aisleH);

    [-3.2, 3.2].forEach(vx => {
      const aisleV = new THREE.Mesh(geo(new THREE.BoxGeometry(0.24, 0.02, 13.0)), walkMat);
      aisleV.position.set(vx, 0.01, 0);
      scene.add(aisleV);
    });

    // Shared Industrial Materials (calibrated for light + dark contrast)
    const steelDark = mat(new THREE.MeshStandardMaterial({
      color: isDark ? 0x4b5f7a : 0x334155,
      roughness: 0.48,
      metalness: 0.45,
    }));
    const steelMid = mat(new THREE.MeshStandardMaterial({
      color: isDark ? 0x647a96 : 0x475569,
      roughness: 0.45,
      metalness: 0.4,
    }));
    const machineMat = mat(new THREE.MeshStandardMaterial({
      color: isDark ? 0x3b5380 : 0x1f2f59,
      roughness: 0.42,
      metalness: 0.35,
    }));
    const palletMat = mat(new THREE.MeshStandardMaterial({
      color: 0xc2925e,
      roughness: 0.8,
      metalness: 0.04,
    }));
    const creamMat = mat(new THREE.MeshStandardMaterial({
      color: isDark ? 0xb8c2d0 : 0xdfd8ca,
      roughness: 0.68,
      metalness: 0.05,
    }));
    const glassMat = mat(new THREE.MeshStandardMaterial({
      color: 0x7fb0f2,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.36,
    }));
    const yellowAccent = mat(new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.5,
      metalness: 0.12,
    }));
    const darkAnodized = mat(new THREE.MeshStandardMaterial({
      color: isDark ? 0x788ba3 : 0x3b495e,
      roughness: 0.38,
      metalness: 0.55,
    }));

    const interactives: THREE.Object3D[] = [];
    const masts: Record<string, THREE.Mesh> = {};
    const lanterns: Record<string, THREE.Mesh> = {};
    const lanternCaps: Record<string, THREE.Mesh> = {};
    const towerRings: Record<string, THREE.Mesh> = {};
    const padFrames: Record<string, THREE.LineSegments> = {};
    const zonePads: Record<string, THREE.Mesh> = {};

    ZONE_LAYOUTS.forEach(spec => {
      const group = new THREE.Group();
      group.position.set(spec.x, 0, spec.z);
      group.userData = { area: spec.area };

      // Zone Pad
      const padMat2 = mat(new THREE.MeshStandardMaterial({
        color: isDark ? 0x1b2944 : 0xf9fafb,
        roughness: 0.85,
        metalness: 0.04,
        emissive: 0x000000,
        emissiveIntensity: 0,
      }));
      const pad = new THREE.Mesh(geo(new THREE.BoxGeometry(spec.w, 0.1, spec.d)), padMat2);
      pad.position.y = 0.05;
      pad.receiveShadow = true;
      pad.userData = { area: spec.area };
      group.add(pad);
      zonePads[spec.area] = pad;
      interactives.push(pad);

      // Perimeter Frame
      const frameGeo = geo(new THREE.EdgesGeometry(new THREE.BoxGeometry(spec.w + 0.06, 0.12, spec.d + 0.06)));
      const frameMat = mat(new THREE.LineBasicMaterial({
        color: isDark ? 0x3b4f73 : 0xc2cbd6,
        transparent: true,
        opacity: 0.45,
      }));
      const frame = new THREE.LineSegments(frameGeo, frameMat);
      frame.position.y = 0.06;
      group.add(frame);
      padFrames[spec.area] = frame;

      // Dedicated Front-Apron Zone Nameplate (unobstructed by equipment!)
      const lc = document.createElement('canvas');
      lc.width = 512;
      lc.height = 104;
      const ctx = lc.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 512, 104);
        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)';
        ctx.strokeStyle = isDark ? '#475f85' : '#94a3b8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(6, 6, 500, 92, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDark ? '#F1F5F9' : '#0F172A';
        ctx.font = '800 42px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(spec.label, 256, 53);

        const lt = tex(new THREE.CanvasTexture(lc));
        lt.colorSpace = THREE.SRGBColorSpace;
        lt.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const lp = new THREE.Mesh(
          geo(new THREE.PlaneGeometry(3.25, 0.66)),
          mat(new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false }))
        );
        lp.rotation.x = -Math.PI / 2;
        lp.position.set(-0.55, 0.118, spec.d * 0.37);
        lp.userData = { area: spec.area };
        group.add(lp);
        interactives.push(lp);
      }

      // Sleek Architectural Safety Status Beacon (Front-Right Corner)
      const bx = spec.w * 0.36;
      const bz = spec.d * 0.34;

      const plinth = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.24, 0.28, 0.14, 16)), darkAnodized);
      plinth.position.set(bx, 0.17, bz);
      plinth.castShadow = true;
      plinth.userData = { area: spec.area };
      group.add(plinth);
      interactives.push(plinth);

      const mast = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 12)), darkAnodized);
      mast.position.set(bx, 0.74, bz);
      mast.castShadow = true;
      mast.userData = { area: spec.area };
      group.add(mast);
      masts[spec.area] = mast;
      interactives.push(mast);

      const lanternMat = mat(new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0xdc2626,
        emissiveIntensity: 0.28,
        roughness: 0.25,
        metalness: 0.15,
      }));
      const lantern = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 18)), lanternMat);
      lantern.position.set(bx, 1.4, bz);
      lantern.castShadow = true;
      lantern.userData = { area: spec.area };
      group.add(lantern);
      lanterns[spec.area] = lantern;
      interactives.push(lantern);

      const cap = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 18)), darkAnodized);
      cap.position.set(bx, 1.58, bz);
      group.add(cap);
      lanternCaps[spec.area] = cap;

      const rGeo = geo(new THREE.RingGeometry(0.32, 0.45, 28));
      rGeo.rotateX(-Math.PI / 2);
      const rMat = mat(new THREE.MeshBasicMaterial({
        color: 0x6f3dba,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }));
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.position.set(bx, 0.115, bz);
      group.add(ring);
      towerRings[spec.area] = ring;

      // Zone-Specific Equipment Silhouettes (positioned cleanly in z in [-1.8, +0.9] away from front nameplate!)
      if (spec.area === 'WAREHOUSE') {
        [-1.35, 0.1, 1.55].forEach((rx, i) => {
          const rackPost = new THREE.Mesh(geo(new THREE.BoxGeometry(0.16, 1.75, 2.3)), steelDark);
          rackPost.position.set(rx, 0.97, -0.65);
          rackPost.castShadow = true;
          rackPost.userData = { area: spec.area };
          group.add(rackPost);
          interactives.push(rackPost);

          [0.45, 0.95, 1.45].forEach(ry => {
            const shelf = new THREE.Mesh(geo(new THREE.BoxGeometry(0.86, 0.05, 2.3)), creamMat);
            shelf.position.set(rx, ry, -0.65);
            shelf.castShadow = true;
            group.add(shelf);
          });

          if (i < 2) {
            const box1 = new THREE.Mesh(geo(new THREE.BoxGeometry(0.52, 0.38, 0.52)), palletMat);
            box1.position.set(rx, 0.67, -1.1);
            box1.castShadow = true;
            group.add(box1);

            const box2 = new THREE.Mesh(geo(new THREE.BoxGeometry(0.48, 0.36, 0.48)), palletMat);
            box2.position.set(rx, 1.16, -0.35);
            box2.castShadow = true;
            group.add(box2);
          }
        });
        // Forklift in staging bay
        const fBody = new THREE.Mesh(geo(new THREE.BoxGeometry(0.55, 0.48, 0.95)), yellowAccent);
        fBody.position.set(-1.9, 0.34, 0.85);
        fBody.castShadow = true;
        group.add(fBody);
        const fMast = new THREE.Mesh(geo(new THREE.BoxGeometry(0.08, 1.15, 0.08)), steelDark);
        fMast.position.set(-1.9, 0.72, 0.42);
        group.add(fMast);
      } else if (spec.area === 'SMT') {
        const smtBase = new THREE.Mesh(geo(new THREE.BoxGeometry(3.7, 0.68, 1.05)), machineMat);
        smtBase.position.set(-0.1, 0.44, -0.8);
        smtBase.castShadow = true;
        smtBase.userData = { area: spec.area };
        group.add(smtBase);
        interactives.push(smtBase);

        const smtDeck = new THREE.Mesh(geo(new THREE.BoxGeometry(3.9, 0.08, 1.2)), steelMid);
        smtDeck.position.set(-0.1, 0.82, -0.8);
        smtDeck.castShadow = true;
        group.add(smtDeck);

        const gantryBeam = new THREE.Mesh(geo(new THREE.BoxGeometry(3.3, 0.14, 0.16)), steelDark);
        gantryBeam.position.set(-0.1, 1.48, -0.8);
        group.add(gantryBeam);

        [-1.5, 1.3].forEach(gx => {
          const post = new THREE.Mesh(geo(new THREE.BoxGeometry(0.12, 0.66, 0.12)), steelDark);
          post.position.set(gx, 1.15, -0.8);
          post.castShadow = true;
          group.add(post);
        });

        // Reflow Oven beside line
        const oven = new THREE.Mesh(geo(new THREE.BoxGeometry(1.7, 0.85, 0.9)), machineMat);
        oven.position.set(-0.6, 0.52, 0.55);
        oven.castShadow = true;
        oven.userData = { area: spec.area };
        group.add(oven);
        interactives.push(oven);

        const ovenWindow = new THREE.Mesh(geo(new THREE.BoxGeometry(1.1, 0.42, 0.06)), glassMat);
        ovenWindow.position.set(-0.6, 0.58, 1.01);
        group.add(ovenWindow);
      } else if (spec.area === 'QUALITY') {
        // CMM Metrology Granite Table
        const cmmBase = new THREE.Mesh(geo(new THREE.BoxGeometry(1.75, 0.72, 1.4)), steelMid);
        cmmBase.position.set(-1.1, 0.46, -0.55);
        cmmBase.castShadow = true;
        cmmBase.userData = { area: spec.area };
        group.add(cmmBase);
        interactives.push(cmmBase);

        const cmmSlab = new THREE.Mesh(geo(new THREE.BoxGeometry(1.85, 0.1, 1.5)), creamMat);
        cmmSlab.position.set(-1.1, 0.86, -0.55);
        group.add(cmmSlab);

        const cmmBridge = new THREE.Mesh(geo(new THREE.BoxGeometry(1.75, 0.1, 0.1)), steelDark);
        cmmBridge.position.set(-1.1, 1.52, -0.55);
        group.add(cmmBridge);

        const cmmProbe = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.035, 0.035, 0.65, 8)), steelDark);
        cmmProbe.position.set(-1.1, 1.18, -0.55);
        group.add(cmmProbe);

        // Cleanroom Metrology Glass Booth
        const booth = new THREE.Mesh(geo(new THREE.BoxGeometry(2.05, 1.45, 1.8)), glassMat);
        booth.position.set(1.05, 0.82, -0.35);
        booth.userData = { area: spec.area };
        group.add(booth);
        interactives.push(booth);

        const boothFrame = new THREE.Mesh(geo(new THREE.BoxGeometry(2.1, 0.08, 1.85)), steelDark);
        boothFrame.position.set(1.05, 1.56, -0.35);
        group.add(boothFrame);
      } else if (spec.area === 'PACKAGING') {
        const convBody = new THREE.Mesh(geo(new THREE.BoxGeometry(3.8, 0.4, 0.75)), machineMat);
        convBody.position.set(-0.2, 0.3, -0.7);
        convBody.castShadow = true;
        convBody.userData = { area: spec.area };
        group.add(convBody);
        interactives.push(convBody);

        [-1.4, -0.2, 1.0].forEach(bx => {
          const box = new THREE.Mesh(geo(new THREE.BoxGeometry(0.55, 0.45, 0.55)), palletMat);
          box.position.set(bx, 0.72, -0.7);
          box.castShadow = true;
          group.add(box);
        });

        const labeler = new THREE.Mesh(geo(new THREE.BoxGeometry(0.45, 1.05, 0.45)), yellowAccent);
        labeler.position.set(1.8, 0.62, -0.7);
        labeler.castShadow = true;
        group.add(labeler);

        const wrapBay = new THREE.Mesh(geo(new THREE.BoxGeometry(1.5, 0.72, 1.0)), steelMid);
        wrapBay.position.set(-0.4, 0.46, 0.55);
        wrapBay.castShadow = true;
        wrapBay.userData = { area: spec.area };
        group.add(wrapBay);
        interactives.push(wrapBay);
      } else if (spec.area === 'TEST') {
        [-1.35, 0.0, 1.35].forEach(tx => {
          const rack = new THREE.Mesh(geo(new THREE.BoxGeometry(0.8, 1.65, 0.95)), machineMat);
          rack.position.set(tx, 0.92, -0.8);
          rack.castShadow = true;
          rack.userData = { area: spec.area };
          group.add(rack);
          interactives.push(rack);

          [0.45, 0.85, 1.25].forEach((ry, idx) => {
            const pCol = idx === 0 ? 0x16a34a : idx === 1 ? 0x4d8eeb : 0xf58a3a;
            const strip = new THREE.Mesh(
              geo(new THREE.BoxGeometry(0.62, 0.08, 0.04)),
              mat(new THREE.MeshStandardMaterial({ color: pCol, emissive: pCol, emissiveIntensity: 0.35 }))
            );
            strip.position.set(tx, ry, -0.31);
            group.add(strip);
          });
        });

        const esdBench = new THREE.Mesh(geo(new THREE.BoxGeometry(2.1, 0.75, 0.8)), steelMid);
        esdBench.position.set(-0.3, 0.47, 0.55);
        esdBench.castShadow = true;
        esdBench.userData = { area: spec.area };
        group.add(esdBench);
        interactives.push(esdBench);

        const esdMat = new THREE.Mesh(geo(new THREE.BoxGeometry(2.15, 0.06, 0.85)), creamMat);
        esdMat.position.set(-0.3, 0.86, 0.55);
        group.add(esdMat);
      } else if (spec.area === 'FINAL_ASSEMBLY') {
        [-0.9, 0.85].forEach(ax => {
          const base = new THREE.Mesh(geo(new THREE.BoxGeometry(1.05, 0.78, 1.4)), steelMid);
          base.position.set(ax, 0.49, -0.55);
          base.castShadow = true;
          base.userData = { area: spec.area };
          group.add(base);
          interactives.push(base);

          const deck = new THREE.Mesh(geo(new THREE.BoxGeometry(1.15, 0.06, 1.5)), creamMat);
          deck.position.set(ax, 0.9, -0.55);
          group.add(deck);

          const armBase = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 12)), machineMat);
          armBase.position.set(ax, 1.18, -0.55);
          armBase.castShadow = true;
          group.add(armBase);

          const armLow = new THREE.Mesh(geo(new THREE.BoxGeometry(0.11, 0.58, 0.11)), steelDark);
          armLow.position.set(ax, 1.62, -0.55);
          armLow.rotation.z = ax > 0 ? -0.45 : 0.45;
          armLow.castShadow = true;
          group.add(armLow);

          const gripper = new THREE.Mesh(geo(new THREE.BoxGeometry(0.22, 0.1, 0.22)), yellowAccent);
          gripper.position.set(ax + (ax > 0 ? -0.2 : 0.2), 1.9, -0.55);
          group.add(gripper);
        });

        const partShelf = new THREE.Mesh(geo(new THREE.BoxGeometry(0.32, 1.35, 1.35)), steelDark);
        partShelf.position.set(-2.05, 0.77, -0.55);
        partShelf.castShadow = true;
        group.add(partShelf);
      }

      scene.add(group);
    });

    sceneRefs.current = { masts, lanterns, lanternCaps, towerRings, padFrames, zonePads, renderer, scene };

    // Initial data sync
    const maxTotal = Math.max(...zonesRef.current.map(z => z.total), 1);
    ZONE_LAYOUTS.forEach(spec => {
      const z = zonesRef.current.find(item => item.area === spec.area);
      const hex = getZoneStatusHex(z);
      const ratio = z ? z.total / maxTotal : 0;
      const h = z && z.total === 0 ? 0.45 : Math.max(0.6, 0.55 + ratio * 1.45);
      if (masts[spec.area]) {
        masts[spec.area].scale.y = h;
        masts[spec.area].position.y = 0.24 + h * 0.5;
      }
      if (lanterns[spec.area]) {
        const lm = lanterns[spec.area].material as THREE.MeshStandardMaterial;
        lm.color.setHex(hex);
        lm.emissive.setHex(hex);
        lanterns[spec.area].position.y = 0.24 + h + 0.16;
      }
      if (lanternCaps[spec.area]) {
        lanternCaps[spec.area].position.y = 0.24 + h + 0.34;
      }
    });

    // Raycasting
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let ptrDown = { x: 0, y: 0 };

    const getHit = (cx: number, cy: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactives, false);
      if (hits.length > 0) {
        const area = hits[0].object.userData?.area as string | undefined;
        if (area) return { area, relX: cx - rect.left, relY: cy - rect.top };
      }
      return null;
    };

    const onMove = (e: PointerEvent) => {
      const hit = getHit(e.clientX, e.clientY);
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
      if (hit) {
        if (hoveredAreaRef.current !== hit.area) {
          setHoveredAreaState(hit.area);
        }
        const matched = zonesRef.current.find(z => z.area === hit.area);
        setHoveredZone(matched ? { zone: matched, x: hit.relX, y: hit.relY } : null);
      } else {
        if (hoveredAreaRef.current !== null) {
          setHoveredAreaState(null);
        }
        setHoveredZone(null);
      }
    };
    const onDown = (e: PointerEvent) => {
      ptrDown = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - ptrDown.x, e.clientY - ptrDown.y) > 6) return;
      const hit = getHit(e.clientX, e.clientY);
      if (hit) onSelectRef.current(hit.area);
    };
    const onLeave = () => {
      setHoveredZone(null);
      setHoveredAreaState(null);
    };

    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    let currentDefaultCam = getResponsiveCamPos(W, H);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = Math.max(e.contentRect.width, 300);
        const h = Math.max(e.contentRect.height, 340);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        currentDefaultCam = getResponsiveCamPos(w, h);
      }
    });
    ro.observe(container);

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (camResetRef.current) {
        camera.position.lerp(currentDefaultCam, 0.12);
        controls.target.lerp(DEFAULT_TARGET, 0.12);
        if (camera.position.distanceTo(currentDefaultCam) < 0.08) {
          camera.position.copy(currentDefaultCam);
          controls.target.copy(DEFAULT_TARGET);
          camResetRef.current = false;
        }
      }

      if (!prefersReduced) {
        const sel = selectedRef.current;
        if (sel && towerRings[sel]) {
          const pulse = 1 + Math.sin(t * 3.0) * 0.08;
          towerRings[sel].scale.set(pulse, 1, pulse);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      controls.dispose();
      D.geometries.forEach(g => g.dispose());
      D.materials.forEach(m => m.dispose());
      D.textures.forEach(t => t.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [theme, onWebGLUnavailable]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[360px] sm:h-[460px] lg:h-[520px] select-none overflow-hidden rounded-t-2xl"
    >
      {hoveredZone && (
        <div
          style={{
            left: Math.min(hoveredZone.x + 16, 420),
            top: Math.max(hoveredZone.y - 20, 10),
          }}
          className="absolute z-20 pointer-events-none px-3.5 py-2.5 rounded-2xl bg-canvas-surface/95 backdrop-blur-md border border-line-default shadow-elevated text-xs min-w-[200px]"
        >
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="font-bold text-ink-primary text-[13px]">{hoveredZone.zone.label}</span>
            <span className="font-mono text-[11px] font-bold text-brand-purple tabular-nums">
              {hoveredZone.zone.total} events
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] font-mono text-ink-secondary">
            <span>Critical: <strong className="text-severity-critical-text">{hoveredZone.zone.critical}</strong></span>
            <span>High: <strong className="text-severity-high-text">{hoveredZone.zone.high}</strong></span>
            <span>Open Actions: <strong className="text-ink-primary">{hoveredZone.zone.openActions}</strong></span>
            <span>Hazards: <strong className="text-ink-primary">{hoveredZone.zone.hazards}</strong></span>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-line-subtle text-[10px] text-ink-muted">
            Click to inspect zone records →
          </div>
        </div>
      )}
    </div>
  );
};

export default FactoryDigitalTwinCanvas;
