import React, { useEffect, useState } from 'react';

/**
 * Two animated scenes with a side-view worker (he faces the way he walks):
 *  - SlipIllustration: walks in, steps on an oil spill, slips and falls.
 *  - FingerprintIllustration: walks to a wall-mounted card scanner and taps his ID card on it.
 *
 * The worker has human proportions (long legs, tapered limbs) and a walk cycle modelled on a real gait:
 * heel strike with the toe up, a small knee bend while the weight comes on, a big knee bend while the leg
 * swings through, heel lift and toe-off, arms swinging opposite to the legs with a bent elbow, and the body
 * bobbing up and down twice per stride. Everything is a function of time, so the scene is drawn from a time value.
 */

const NAVY = '#243049';
const SKIN = '#F2C29B';
const SKIN_FAR = '#E0AD84';
const HAT = '#FACC15';
const SHIRT = '#3E6FD8';
const SHIRT_FAR = '#2F58B3';
const VEST = '#F97316';
const PANTS = '#3B4B6B';
const PANTS_FAR = '#2D3A55';
const SHOE = '#2D3748';
const OUT = { stroke: NAVY, strokeWidth: 1.7, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const FLOOR = 236;
const THIGH = 40;
const SHIN = 38;
const HIP_Y = 152; // hip height when standing (ankle 78 below the hip + 6 to the sole)

/* ----------------------------------------------------------------------------------------------
 * Time + math helpers
 * -------------------------------------------------------------------------------------------- */
function useLoopTime(duration: number, freezeAt: number, fixed?: number): number {
  const [t, setT] = useState(fixed ?? freezeAt);
  useEffect(() => {
    if (fixed !== undefined) {
      setT(fixed);
      return;
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setT(freezeAt);
      return;
    }
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (now - last >= 30) {
        last = now;
        setT(((now - start) / 1000) % duration);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, freezeAt, fixed]);
  return t;
}

const ease = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
const smooth = (a: number, b: number, t: number) => ease(clamp01((t - a) / (b - a)));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Smooth bump centred at mu (period 1). */
const bump = (p: number, mu: number, sigma: number) => {
  const d = Math.abs((((p - mu + 0.5) % 1) + 1) % 1 - 0.5);
  return Math.exp(-(d * d) / (2 * sigma * sigma));
};
/** Piecewise curve through points [p, value] with cosine easing (p in 0..1). */
function curve(p: number, pts: [number, number][]): number {
  const q = ((p % 1) + 1) % 1;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [p0, v0] = pts[i];
    const [p1, v1] = pts[i + 1];
    if (q >= p0 && q <= p1) return lerp(v0, v1, ease((q - p0) / (p1 - p0)));
  }
  return pts[pts.length - 1][1];
}

type Face = 'calm' | 'shock' | 'happy';
interface Pose {
  x: number; // hip position
  y: number;
  rot: number; // whole body rotation around the hip (clockwise = forward lean / falling forward)
  lean: number; // torso lean
  hipN: number; // near leg hip rotation (negative = thigh forward)
  kneeN: number; // knee rotation (positive = shin swings back)
  footN: number; // ankle rotation relative to the shin
  hipF: number;
  kneeF: number;
  footF: number;
  shN: number; // near arm shoulder rotation (negative = arm forward / up)
  elN: number; // elbow rotation (negative = forearm forward)
  shF: number;
  elF: number;
  face: Face;
  opacity: number;
}

const FIELDS: (keyof Pose)[] = ['x', 'y', 'rot', 'lean', 'hipN', 'kneeN', 'footN', 'hipF', 'kneeF', 'footF', 'shN', 'elN', 'shF', 'elF', 'opacity'];
function mix(a: Pose, b: Pose, u: number): Pose {
  const k = ease(clamp01(u));
  const out = { ...b } as Pose;
  for (const f of FIELDS) (out[f] as number) = lerp(a[f] as number, b[f] as number, k);
  return out;
}

/** Leg angles (degrees, in drawing rotation terms) for gait phase p (0 = heel strike of this leg). */
function legAt(p: number) {
  const hipFlex = 10 + 20 * Math.cos(2 * Math.PI * p); // +30 forward at heel strike, -10 back at toe-off
  const kneeFlex = 4 + 14 * bump(p, 0.13, 0.06) + 62 * bump(p, 0.72, 0.085) + 8 * bump(p, 0.58, 0.05);
  const toeUp = curve(p, [
    [0, 14], [0.08, 1], [0.42, 0], [0.52, -9], [0.62, -34], [0.72, -30], [0.82, -8], [0.92, 10], [1, 14],
  ]);
  const hip = -hipFlex;
  const knee = kneeFlex;
  return { hip, knee, foot: -toeUp - (hip + knee) };
}
function armAt(p: number) {
  const swing = 20 * Math.cos(2 * Math.PI * p); // + = arm back
  const sh = swing - 2;
  const el = -(18 + 16 * clamp01(-swing / 20 + 0.2));
  return { sh, el };
}

/** Walking pose at cumulative gait phase `phase` (cycles). */
function gaitPose(phase: number, x: number): Pose {
  const pn = phase;
  const pf = phase + 0.5;
  const n = legAt(pn);
  const f = legAt(pf);
  const an = armAt(pn);
  const af = armAt(pf);
  return {
    x,
    y: HIP_Y + 1.7 * Math.cos(4 * Math.PI * phase),
    rot: 0,
    lean: 3,
    hipN: n.hip, kneeN: n.knee, footN: n.foot,
    hipF: f.hip, kneeF: f.knee, footF: f.foot,
    shN: an.sh, elN: an.el, shF: af.sh, elF: af.el,
    face: 'calm',
    opacity: 1,
  };
}

const STAND: Pose = {
  x: 0, y: HIP_Y, rot: 0, lean: 1,
  hipN: 0, kneeN: 3, footN: -3, hipF: 0, kneeF: 3, footF: -3,
  shN: 3, elN: -16, shF: 3, elF: -16,
  face: 'calm', opacity: 1,
};

/* ----------------------------------------------------------------------------------------------
 * The worker (side view, facing right). Origin = hip joint.
 * -------------------------------------------------------------------------------------------- */
const Leg: React.FC<{ hip: number; knee: number; foot: number; far?: boolean }> = ({ hip, knee, foot, far }) => {
  const pants = far ? PANTS_FAR : PANTS;
  return (
    <g transform={`rotate(${hip.toFixed(2)})`}>
      {/* thigh */}
      <path d={`M-8.5 -4 C-10 10 -8.5 26 -6.2 ${THIGH + 2} L6.2 ${THIGH + 2} C8.6 26 10 8 8.6 -4 Z`} fill={pants} {...OUT} />
      <g transform={`translate(0 ${THIGH}) rotate(${knee.toFixed(2)})`}>
        {/* shin with a calf */}
        <path d={`M-6.4 -2 C-9.6 10 -7.6 26 -4.4 ${SHIN} L4.4 ${SHIN} C6 24 7.2 10 6.4 -2 Z`} fill={pants} {...OUT} />
        <g transform={`translate(0 ${SHIN}) rotate(${foot.toFixed(2)})`}>
          {/* shoe */}
          <path d="M-6 -3 L4.6 -3 C7.6 -1 10.6 2.4 15 4 C18.6 5.2 18.4 9 15 9.4 L-7.4 9.4 C-9.8 9.4 -9.4 3.6 -6 -3 Z" fill={SHOE} {...OUT} />
          <path d="M-8.4 6.8 L16.6 6.8" stroke="#E2E8F0" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
};

const Hand: React.FC<{ far?: boolean }> = ({ far }) => (
  <g>
    <path d="M-3.6 -1 C-5.2 4 -5 9.5 -2.4 12.6 L2.6 12.6 C5.6 10.6 5.4 4 3.6 -1 Z" fill={far ? SKIN_FAR : SKIN} {...OUT} strokeWidth={1.5} />
    <ellipse cx="3.6" cy="5.4" rx="2.3" ry="4.4" transform="rotate(-22 3.6 5.4)" fill={far ? SKIN_FAR : SKIN} {...OUT} strokeWidth={1.4} />
  </g>
);

const Card: React.FC = () => (
  <g>
    {/* lanyard */}
    <path d="M0 -27 C-12 -40 -22 -8 -8 24" fill="none" stroke="#6F83CC" strokeWidth="2.2" strokeLinecap="round" />
    <rect x={-8.5} y={-27} width={17} height={34} rx={3} fill="#3F51B5" {...OUT} strokeWidth={1.6} />
    <rect x={-3} y={-30} width={6} height={5} rx={1.5} fill="#94A3B8" {...OUT} strokeWidth={1.3} />
    <circle cx={0} cy={-17} r={5.2} fill="#fff" />
    <circle cx={0} cy={-18.2} r={1.9} fill="#3F51B5" />
    <path d="M-3.4 -13.4 Q0 -16 3.4 -13.4 Z" fill="#3F51B5" />
    <rect x={-5.5} y={-7} width={11} height={1.8} rx={0.9} fill="#A9B6F0" />
    <rect x={-5.5} y={-2.5} width={11} height={1.8} rx={0.9} fill="#A9B6F0" />
  </g>
);

const UPPER = 30;
const FORE = 26;
const Arm: React.FC<{ sh: number; el: number; far?: boolean; card?: boolean }> = ({ sh, el, far, card }) => {
  const sleeve = far ? SHIRT_FAR : SHIRT;
  return (
    <g transform={`translate(1 -42) rotate(${sh.toFixed(2)})`}>
      <path d={`M-5.8 -4 C-7 8 -6.2 20 -4.6 ${UPPER + 1} L4.6 ${UPPER + 1} C6 20 6.8 8 5.8 -4 Z`} fill={sleeve} {...OUT} />
      <g transform={`translate(0 ${UPPER}) rotate(${el.toFixed(2)})`}>
        <path d={`M-4.8 -2 C-5.8 8 -5 18 -3.4 ${FORE} L3.4 ${FORE} C5 18 5.8 8 4.8 -2 Z`} fill={sleeve} {...OUT} />
        <g transform={`translate(0 ${FORE - 1}) rotate(${(-(sh + el)).toFixed(2)})`}>
          {card && (
            <g transform="translate(1 4)">
              <Card />
            </g>
          )}
          <Hand far={far} />
        </g>
      </g>
    </g>
  );
};

const Head: React.FC<{ face: Face }> = ({ face }) => (
  <g>
    {/* hair at the back of the head */}
    <path d="M-12 -4 C-16 6 -12 15 -4 17 C-9 9 -7 -2 -2 -9 Z" fill="#2B2F4A" />
    {/* head in profile: forehead, nose, lips, chin, jaw */}
    <path
      d="M-12 -4 C-12 -15 -3 -20 5 -19 C12 -18 15 -13 15.4 -8 L16.2 -3.4 C16.6 -1.6 19.6 0.2 19.6 2 C19.6 3.6 17.4 4.2 16.2 4.6 L16.2 6.4 C17.2 7.2 17 8.8 16 9.4 C16.8 10.6 16.2 12.4 14.6 12.8 C14.8 16.2 11.6 19 6.4 19.2 L-1 17.6 C-8 14.6 -12 8 -12 -4 Z"
      fill={SKIN} {...OUT}
    />
    {/* ear */}
    <ellipse cx={-3.4} cy={2.6} rx={3.4} ry={5} fill={SKIN} {...OUT} strokeWidth={1.4} />
    <path d="M-4.4 0.6 Q-2.2 2.6 -4 5.4" stroke="#C98A5E" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    {/* cheek */}
    <ellipse cx={7} cy={8.6} rx={4} ry={2.6} fill="#F7A3A3" opacity="0.55" />
    {face === 'calm' && (
      <g>
        <ellipse cx={9.6} cy={-4.4} rx={1.7} ry={2.6} fill={NAVY} />
        <circle cx={9.2} cy={-5.4} r={0.7} fill="#fff" />
        <path d="M5.6 -9.6 Q9.8 -12 13.6 -9.4" stroke={NAVY} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M9.6 9.8 Q13.2 12.2 16.2 9" stroke={NAVY} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>
    )}
    {face === 'shock' && (
      <g>
        <circle cx={9.8} cy={-4.6} r={3.7} fill="#fff" {...OUT} strokeWidth={1.4} />
        <circle cx={10.8} cy={-4.4} r={1.5} fill={NAVY} />
        <path d="M5 -11.6 L13 -14" stroke={NAVY} strokeWidth="1.9" strokeLinecap="round" />
        <ellipse cx={13.2} cy={10.6} rx={2.8} ry={4} fill="#7F1D1D" {...OUT} strokeWidth={1.3} />
        <path d="M-9 -17 q3 5 0 8 q-3 -3 0 -8z" fill="#38BDF8" />
      </g>
    )}
    {face === 'happy' && (
      <g>
        <path d="M6.6 -3.6 Q9.8 -8.4 13 -3.6" stroke={NAVY} strokeWidth="1.9" fill="none" strokeLinecap="round" />
        <path d="M8 8.6 Q13 15.4 16.4 8.6 Z" fill="#B91C1C" {...OUT} strokeWidth={1.3} />
        <path d="M9.4 9 L15.2 9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    )}
    {/* hard hat with a short peak at the front */}
    <path d="M-16 -9 C-16 -24 -7 -32 4 -31 C15 -30 21 -22 21 -9 Z" fill={HAT} {...OUT} />
    <path d="M3 -31 L3 -9.4" stroke="#EAB308" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M-9 -28 Q-13 -19 -14 -10" stroke="#EAB308" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M12 -27 Q17 -19 18 -10" stroke="#EAB308" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M-18 -9.6 L28 -9.6 Q32 -9.6 32 -6.6 Q32 -4 28 -4 L-18 -4 Q-20.6 -4 -20.6 -6.8 Q-20.6 -9.6 -18 -9.6 Z" fill={HAT} {...OUT} />
    <ellipse cx={-5} cy={-23} rx={5.6} ry={2.8} fill="#fff" opacity="0.8" transform="rotate(-30 -5 -23)" />
  </g>
);

const Worker: React.FC<{ p: Pose; card?: boolean }> = ({ p, card }) => (
  <g transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.rot.toFixed(2)})`} opacity={p.opacity}>
    <Leg hip={p.hipF} knee={p.kneeF} foot={p.footF} far />
    <g transform={`rotate(${p.lean})`}>
      <Arm sh={p.shF} el={p.elF} far />
      {/* neck */}
      <path d="M-1 -52 L8 -52 L7 -40 L-2 -40 Z" fill={SKIN} {...OUT} strokeWidth={1.4} />
      {/* torso: blue shirt, orange vest with reflective stripes */}
      <g transform="scale(1.12 1)">
      <path d="M-9.5 3 C-12 -12 -11.5 -30 -8.6 -42 Q0 -48 9.6 -42.6 C12.4 -30 11.6 -12 9.6 3 Z" fill={SHIRT} {...OUT} />
      <path d="M-9.1 3 C-11.4 -12 -11 -30 -8.2 -41 Q0 -45.6 8.6 -41.6 C10.8 -30 10.8 -12 9.2 3 Z" fill={VEST} />
      <path d="M-11 -29 L11.4 -29 L11.2 -25 L-11 -25 Z" fill="#fff" />
      <path d="M-10.6 -14 L11 -14 L10.8 -10 L-10.6 -10 Z" fill="#fff" />
      <path d="M-9.5 3 C-12 -12 -11.5 -30 -8.6 -42 Q0 -48 9.6 -42.6 C12.4 -30 11.6 -12 9.6 3 Z" fill="none" {...OUT} />
      </g>
      {/* head */}
      <g transform={`translate(3.5 -66) rotate(${p.face === 'shock' ? -6 : 0})`}>
        <Head face={p.face} />
      </g>
    </g>
    <Leg hip={p.hipN} knee={p.kneeN} foot={p.footN} />
    <g transform={`rotate(${p.lean})`}>
      <Arm sh={p.shN} el={p.elN} card={card} />
    </g>
  </g>
);

/* ----------------------------------------------------------------------------------------------
 * Shared scene frame
 * -------------------------------------------------------------------------------------------- */
const SceneFrame: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <svg className="w-full h-auto" viewBox="0 0 420 300" role="img" aria-label={label}>
    <rect width="420" height="300" rx="16" fill="#EEF2F7" />
    <rect y="40" width="420" height="196" fill="#E2E8F0" />
    <rect x="0" y={FLOOR} width="420" height="64" fill="#CBD5E1" />
    <rect x="0" y={FLOOR} width="420" height="4" fill="#94A3B8" />
    {children}
  </svg>
);

/* ----------------------------------------------------------------------------------------------
 * 1. EHS events: walks in, the lead foot lands on the oil and slides, the other leg kicks up, he falls on his back
 * -------------------------------------------------------------------------------------------- */
const SL_T = 8.5;
const SL_START = 0.2;
const SL_WALK_END = 3.8;
const SL_CYCLES = 2.5; // the far foot lands (heel strike) on the oil
const SL_X0 = -70;
const SL_X1 = 150;

const LYING: Pose = {
  x: 236, y: 222, rot: -90, lean: 0,
  hipN: -22, kneeN: 20, footN: 10, hipF: -34, kneeF: 32, footF: 14,
  shN: -128, elN: -22, shF: -104, elF: -26, face: 'shock', opacity: 1,
};

function slipPose(t: number): Pose {
  const u = clamp01((t - SL_START) / (SL_WALK_END - SL_START));
  if (t < SL_WALK_END) {
    return { ...gaitPose(SL_CYCLES * u, lerp(SL_X0, SL_X1, u)), opacity: 1 };
  }
  const start = gaitPose(SL_CYCLES, SL_X1);
  const keys: [number, Pose][] = [
    [SL_WALK_END, start],
    // the lead foot slides forward on the oil, the body drops, the other leg kicks up, arms fly up, shocked face
    [4.15, { x: 168, y: 190, rot: -12, lean: 0, hipN: -78, kneeN: 40, footN: 0, hipF: -56, kneeF: 2, footF: 6, shN: -118, elN: -28, shF: -96, elF: -30, face: 'shock', opacity: 1 }],
    [4.75, { x: 196, y: 200, rot: -50, lean: 0, hipN: -112, kneeN: 24, footN: 10, hipF: -84, kneeF: 8, footF: 12, shN: -158, elN: -22, shF: -140, elF: -26, face: 'shock', opacity: 1 }],
    [5.55, LYING],
    [7.4, { ...LYING, shN: -112, shF: -92 }],
    [7.9, { ...LYING, shN: -112, shF: -92, opacity: 0 }],
  ];
  for (let i = 0; i < keys.length - 1; i += 1) {
    const [t0, a] = keys[i];
    const [t1, b] = keys[i + 1];
    if (t <= t1) return mix(a, b, (t - t0) / (t1 - t0));
  }
  return { ...keys[keys.length - 1][1], opacity: 0 };
}

export const SlipIllustration: React.FC<{ at?: number }> = ({ at }) => {
  const t = useLoopTime(SL_T, 5.0, at);
  const p = slipPose(t);
  const bang = smooth(4.05, 4.35, t) * (1 - smooth(6.7, 7.2, t));
  return (
    <SceneFrame label="Cartoon of a worker walking, slipping on an oil spill with one foot on the oil and the other in the air, shocked face, and falling">
      <rect x="0" y="268" width="420" height="8" fill={HAT} opacity="0.9" />
      {/* shelf */}
      <rect x="300" y="110" width="90" height="8" rx="2" fill="#94A3B8" />
      <rect x="300" y="160" width="90" height="8" rx="2" fill="#94A3B8" />
      <rect x="310" y="82" width="28" height="28" rx="2" fill="#D6A56A" {...OUT} />
      <rect x="344" y="94" width="28" height="16" rx="2" fill="#C8924F" {...OUT} />
      <rect x="316" y="132" width="34" height="28" rx="2" fill="#C8924F" {...OUT} />
      {/* oil spill */}
      <ellipse cx="250" cy="248" rx="78" ry="12" fill="#1F2937" />
      <ellipse cx="232" cy="245" rx="34" ry="4" fill="#64748B" opacity={0.35 + 0.25 * Math.sin(t * 2.6)} />
      <ellipse cx="278" cy="249" rx="16" ry="2.5" fill="#64748B" opacity={0.3 + 0.25 * Math.sin(t * 2.6 + 1)} />
      <text x="250" y="292" textAnchor="middle" fontSize="12" fontWeight="700" fill="#334155" fontFamily="sans-serif">OIL ON FLOOR</text>
      {/* warning sign */}
      <path d="M346 232 L372 186 L398 232 Z" fill={HAT} stroke={NAVY} strokeWidth="3" strokeLinejoin="round" />
      <rect x="370" y="199" width="4" height="16" rx="2" fill={NAVY} />
      <circle cx="372" cy="223" r="2.4" fill={NAVY} />

      <Worker p={p} />

      {/* reaction */}
      <g opacity={bang} transform={`translate(263 47) scale(${0.6 + 0.4 * bang}) translate(-263 -47)`}>
        <rect x="222" y="28" width="82" height="38" rx="13" fill="#fff" stroke="#DC2626" strokeWidth="2.8" />
        <text x="263" y="55" textAnchor="middle" fontSize="20" fontWeight="800" fill="#DC2626" fontFamily="sans-serif">WHOA!</text>
      </g>
      {t >= 4.1 && t < 5.1 && (
        <g stroke="#64748B" strokeWidth="3" strokeLinecap="round" opacity={0.9}>
          <path d="M112 118 l-26 -6" />
          <path d="M108 136 l-30 0" />
          <path d="M112 154 l-26 6" />
        </g>
      )}
    </SceneFrame>
  );
};

/* ----------------------------------------------------------------------------------------------
 * 2. Attendance: walks to the wall-mounted scanner, raises his hand with the ID card and taps it
 * -------------------------------------------------------------------------------------------- */
const FP_T = 11.5;
const FP_START = 0.2;
const FP_WALK_END = 5.2;
const FP_CYCLES = 3.25; // ends with both feet together
const FP_X0 = -40;
const FP_X1 = 273;

function scanPose(t: number): Pose {
  const u = clamp01((t - FP_START) / (FP_WALK_END - FP_START));
  const e = ease(u); // slow start, steady walk, slow stop
  if (t < FP_WALK_END) {
    return gaitPose(FP_CYCLES * e, lerp(FP_X0, FP_X1, e));
  }
  const arrive = gaitPose(FP_CYCLES, FP_X1);
  const rest: Pose = { ...STAND, x: FP_X1 };
  const reach: Pose = { ...rest, lean: 3, shN: -66, elN: -18, shF: 5, elF: -18 };
  const tap: Pose = { ...reach, lean: 5, shN: -70, elN: -16 };
  const keys: [number, Pose][] = [
    [FP_WALK_END, arrive],
    [5.8, rest],
    [6.9, reach],
    [7.4, tap],
    [8.7, tap],
    [9.6, rest],
    [10.2, { ...rest, opacity: 0 }],
  ];
  for (let i = 0; i < keys.length - 1; i += 1) {
    const [t0, a] = keys[i];
    const [t1, b] = keys[i + 1];
    if (t <= t1) {
      const m = mix(a, b, (t - t0) / (t1 - t0));
      return { ...m, face: t >= 8.0 && t < 10.0 ? 'happy' : 'calm' };
    }
  }
  return { ...keys[keys.length - 1][1], opacity: 0 };
}

export const FingerprintIllustration: React.FC<{ at?: number }> = ({ at }) => {
  const t = useLoopTime(FP_T, 8.4, at);
  const p = scanPose(t);
  const touching = t >= 7.4 && t < 8.7;
  const scanned = t >= 8.0 && t < 10.3;
  const glow = touching && !scanned ? 0.5 + 0.5 * Math.sin((t - 7.4) * 14) : 0;
  const tag = smooth(8.0, 8.3, t) * (1 - smooth(10.0, 10.4, t));
  return (
    <SceneFrame label="Cartoon of a worker walking to a card scanner mounted on the wall, raising his hand with an ID card and tapping it on the scanner to mark attendance">
      {/* wall on the right side, the scanner is fixed to it */}
      <polygon points="380,40 420,40 420,236 380,236" fill="#CFD8E3" />
      <line x1="380" y1="40" x2="380" y2="236" stroke="#94A3B8" strokeWidth="2" />

      {/* card scanner seen at an angle (about three quarters): top face, front face and the green panel */}
      <polygon points="332,76 376,84 388,80 344,72" fill="#3A3F44" />
      <polygon points="334,78 376,86 376,168 334,176" fill="#23272B" />
      <polygon points="376,86 388,80 388,162 376,168" fill="#15181B" />
      <polygon
        points="341,96 370,101 370,152 341,157"
        fill={scanned ? '#86EFAC' : '#D5E6A1'}
        stroke={scanned ? '#16A34A' : '#B7CD78'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {glow > 0 && <polygon points="341,96 370,101 370,152 341,157" fill="#FFFFFF" opacity={0.55 * glow} />}
      <path d="M342 85 L366 89.5" stroke={scanned ? '#4ADE80' : '#fff'} strokeWidth="3" strokeLinecap="round" />
      {scanned && (
        <g>
          <circle cx="355.5" cy="127" r="11" fill="#16A34A" stroke="#fff" strokeWidth="2" />
          <path d="M350 127 l4.2 4.2 l7.4 -8.4" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}

      {/* spark lines when the card touches the scanner */}
      {t >= 7.4 && t < 8.5 && (
        <g stroke="#5B6FD6" strokeWidth="3" strokeLinecap="round" opacity={0.95}>
          <path d="M331 86 l-6 -12" />
          <path d="M324 98 l-14 -8" />
          <path d="M322 114 l-15 -1" />
        </g>
      )}

      {/* tag */}
      <g opacity={tag} transform={`translate(0 ${(1 - tag) * 6})`}>
        <rect x="214" y="35" width="156" height="22" rx="11" fill="#fff" stroke="#16A34A" strokeWidth="2" />
        <text x="292" y="50" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#15803D" fontFamily="sans-serif">ATTENDANCE MARKED</text>
      </g>

      {/* shadow follows him */}
      <ellipse cx={p.x + 6} cy={FLOOR + 2} rx="30" ry="5" fill="#94A3B8" opacity={0.5 * p.opacity} />
      <Worker p={p} card />
    </SceneFrame>
  );
};
