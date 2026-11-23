import React from 'react';

/**
 * Animated cartoon scenes for the three source tables.
 * - Events (worker slips) and attendance (worker scans an ID card) live in WorkerScenes.tsx.
 * - The maintenance machine is pure SVG + CSS animation (below). Animations stop for people who prefer reduced motion.
 */
export { SlipIllustration, FingerprintIllustration } from './WorkerScenes';

const NAVY = '#1E2A5A';
const HAT = '#FACC15';
const OUT = { stroke: NAVY, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const COMMON_CSS = `
@media (prefers-reduced-motion: reduce) {
  .ill * { animation: none !important; }
}
.ill g, .ill rect, .ill ellipse, .ill path, .ill circle { transform-box: view-box; }
`;

/* ------------------------------------------------------------------------------------------------
 * Maintenance work orders: a cute machine - gears turning, piston pumping, gauge moving, a lamp
 * that goes amber (needs attention), and a wrench that comes to fix it.
 * ---------------------------------------------------------------------------------------------- */
function gearPath(cx: number, cy: number, teeth: number, rIn: number, rOut: number): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    const p = (r: number, off: number) => `${(cx + r * Math.cos(a + off)).toFixed(1)},${(cy + r * Math.sin(a + off)).toFixed(1)}`;
    pts.push(p(rIn, 0), p(rOut, step * 0.18), p(rOut, step * 0.5 - step * 0.18), p(rIn, step * 0.5));
  }
  return `M${pts.join(' L')} Z`;
}

const MC_CSS = `
.ill .mc-g1 { transform-origin: 120px 156px; animation: mc-spin 6s linear infinite; }
.ill .mc-g2 { transform-origin: 226px 156px; animation: mc-spin-rev 6s linear infinite; }
@keyframes mc-spin { to { transform: rotate(360deg); } }
@keyframes mc-spin-rev { to { transform: rotate(-360deg); } }
.mc-piston { animation: mc-piston 1.6s ease-in-out infinite; }
@keyframes mc-piston { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(22px); } }
.mc-needle { transform-origin: 355px 104px; animation: mc-needle 5s ease-in-out infinite; }
@keyframes mc-needle { 0%, 100% { transform: rotate(-50deg); } 45%, 65% { transform: rotate(48deg); } }
.mc-lamp-ok  { animation: mc-ok 5s step-end infinite; }
.mc-lamp-bad { animation: mc-bad 5s step-end infinite; opacity: 0; }
@keyframes mc-ok  { 0% { opacity: 1; } 40% { opacity: 0; } 85% { opacity: 1; } 100% { opacity: 1; } }
@keyframes mc-bad { 0% { opacity: 0; } 40% { opacity: 1; } 85% { opacity: 0; } 100% { opacity: 0; } }
.mc-wrench { transform-origin: 318px 120px; animation: mc-wrench 5s ease-in-out infinite; opacity: 0; }
@keyframes mc-wrench {
  0%, 44% { opacity: 0; transform: translate(40px, -20px) rotate(0deg); }
  50% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
  58% { transform: rotate(-28deg); }
  66% { transform: rotate(10deg); }
  74% { transform: rotate(-28deg); }
  84% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
  92%, 100% { opacity: 0; transform: translate(40px, -20px); }
}
.mc-belt { animation: mc-belt 1.2s linear infinite; }
@keyframes mc-belt { to { transform: translateX(-24px); } }
.mc-box { animation: mc-box 4.8s linear infinite; }
@keyframes mc-box { 0% { transform: translateX(0); } 100% { transform: translateX(-240px); } }
.mc-smoke { animation: mc-smoke 2.4s ease-out infinite; }
@keyframes mc-smoke { 0% { transform: translateY(0) scale(0.6); opacity: 0.8; } 100% { transform: translateY(-34px) scale(1.5); opacity: 0; } }
.mc-bounce { animation: mc-bounce 0.8s ease-in-out infinite; }
@keyframes mc-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
`;

export const MachineIllustration: React.FC = () => (
  <svg className="ill w-full h-auto" viewBox="0 0 420 300" role="img" aria-label="Cartoon of an industrial machine with turning gears, a moving piston, a pressure gauge and a status lamp">
    <style>{COMMON_CSS + MC_CSS}</style>
    <rect width="420" height="300" rx="16" fill="#EEF2F7" />
    <rect y="40" width="420" height="196" fill="#E2E8F0" />
    <rect y="236" width="420" height="64" fill="#CBD5E1" />
    <ellipse cx="190" cy="246" rx="190" ry="10" fill="#94A3B8" opacity="0.45" />

    <g className="mc-bounce">
      {/* machine body */}
      <rect x="40" y="70" width="270" height="150" rx="18" fill="#5B6B85" {...OUT} />
      <rect x="40" y="70" width="270" height="28" rx="14" fill={HAT} {...OUT} />
      <ellipse cx="90" cy="80" rx="22" ry="4" fill="#fff" opacity="0.7" />
      <rect x="52" y="106" width="246" height="102" rx="12" fill="#1E293B" {...OUT} />
      {/* two big round "eyes" = gear windows */}
      <circle cx="120" cy="156" r="44" fill="#0F172A" stroke={NAVY} strokeWidth="3" />
      <circle cx="226" cy="156" r="44" fill="#0F172A" stroke={NAVY} strokeWidth="3" />
      <g className="mc-g1">
        <path d={gearPath(120, 156, 10, 26, 34)} fill="#FBBF24" stroke={NAVY} strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="120" cy="156" r="9" fill="#78350F" stroke={NAVY} strokeWidth="2" />
      </g>
      <g className="mc-g2">
        <path d={gearPath(226, 156, 10, 26, 34)} fill="#38BDF8" stroke={NAVY} strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="226" cy="156" r="9" fill="#0C4A6E" stroke={NAVY} strokeWidth="2" />
      </g>
      <circle cx="108" cy="142" r="5" fill="#fff" opacity="0.8" />
      <circle cx="214" cy="142" r="5" fill="#fff" opacity="0.8" />
      {/* piston */}
      <rect x="165" y="98" width="14" height="14" fill="#94A3B8" {...OUT} strokeWidth={2} />
      <g className="mc-piston">
        <rect x="167" y="108" width="10" height="28" rx="3" fill="#CBD5E1" {...OUT} strokeWidth={2} />
        <rect x="160" y="136" width="24" height="9" rx="3" fill="#94A3B8" {...OUT} strokeWidth={2} />
      </g>
      {/* control panel: gauge + lamp */}
      <rect x="320" y="70" width="70" height="150" rx="14" fill="#334155" {...OUT} />
      <circle cx="355" cy="104" r="26" fill="#0F172A" stroke="#94A3B8" strokeWidth="3" />
      <path d="M335 114 A24 24 0 0 1 375 114" fill="none" stroke="#64748B" strokeWidth="2" />
      <g className="mc-needle">
        <line x1="355" y1="104" x2="355" y2="84" stroke="#F87171" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="355" cy="104" r="4" fill="#E2E8F0" />
      <circle cx="355" cy="162" r="14" fill="#0F172A" stroke={NAVY} strokeWidth="2" />
      <circle className="mc-lamp-ok" cx="355" cy="162" r="10" fill="#22C55E" />
      <circle className="mc-lamp-bad" cx="355" cy="162" r="10" fill="#F59E0B" />
      <rect x="337" y="186" width="36" height="8" rx="4" fill="#64748B" />
      <rect x="337" y="200" width="24" height="8" rx="4" fill="#64748B" />
      {/* smoke puffs when it needs attention */}
      <g className="mc-lamp-bad">
        <circle className="mc-smoke" cx="262" cy="64" r="8" fill="#94A3B8" />
        <circle className="mc-smoke" style={{ animationDelay: '0.8s' }} cx="276" cy="60" r="6" fill="#94A3B8" />
      </g>
    </g>
    {/* wrench that fixes it */}
    <g className="mc-wrench">
      <rect x="312" y="124" width="10" height="56" rx="5" fill="#94A3B8" {...OUT} strokeWidth={2} transform="rotate(35 317 152)" />
      <circle cx="317" cy="122" r="12" fill="none" stroke="#94A3B8" strokeWidth="7" />
    </g>

    {/* conveyor with moving boxes */}
    <rect x="30" y="226" width="360" height="14" rx="7" fill="#1E293B" {...OUT} />
    <g className="mc-belt" stroke="#475569" strokeWidth="3">
      {Array.from({ length: 18 }, (_, i) => (
        <line key={i} x1={30 + i * 24} y1="228" x2={30 + i * 24} y2="238" />
      ))}
    </g>
    <g className="mc-box">
      <rect x="400" y="200" width="30" height="26" rx="3" fill="#C8924F" {...OUT} strokeWidth={2} />
      <rect x="400" y="209" width="30" height="4" fill="#A16F32" />
      <rect x="520" y="204" width="26" height="22" rx="3" fill="#D6A56A" {...OUT} strokeWidth={2} />
      <rect x="520" y="212" width="26" height="4" fill="#B98547" />
    </g>
  </svg>
);
