import React, { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';

export interface AreaRow {
  /** Plant area (shown on the Y axis). */
  label: string;
  /** All events in the area. */
  total: number;
  /** Events whose corrective action is still open. */
  open: number;
}

interface AreaLineChartProps {
  title: string;
  subtitle: string;
  source: string;
  rows: AreaRow[];
  loading?: boolean;
}

const W = 420;
const H = 290;
const M = { left: 100, right: 28, top: 30, bottom: 10 };
const BLUE = '#2563EB';
const ORANGE = '#EA580C';

/** Smooth curve through the points (Catmull-Rom converted to cubic Béziers). */
function smoothPath(pts: [number, number][], minX: number): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = Math.max(minX, p1[0] + (p2[0] - p0[0]) / 6);
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = Math.max(minX, p2[0] - (p3[0] - p1[0]) / 6);
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const niceMax = (v: number) => {
  if (v <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};

/**
 * Area line chart with the plant areas on the Y axis and the number of events on the X axis.
 * Two series: all events (blue area) and events with an open corrective action (orange area).
 */
export const AreaLineChart: React.FC<AreaLineChartProps> = ({ title, subtitle, source, rows, loading }) => {
  const [hover, setHover] = useState<number | null>(null);
  const geometry = useMemo(() => {
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const max = niceMax(Math.max(1, ...rows.map(r => r.total)));
    const x = (v: number) => M.left + (v / max) * plotW;
    const y = (i: number) => M.top + ((i + 0.5) * plotH) / Math.max(1, rows.length);
    const total = rows.map((r, i) => [x(r.total), y(i)] as [number, number]);
    const open = rows.map((r, i) => [x(r.open), y(i)] as [number, number]);
    const area = (pts: [number, number][]) =>
      pts.length ? `${smoothPath(pts, M.left)} L${M.left},${pts[pts.length - 1][1].toFixed(1)} L${M.left},${pts[0][1].toFixed(1)} Z` : '';
    return { max, x, y, total, open, totalArea: area(total), openArea: area(open), plotH };
  }, [rows]);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandOpen = rows.reduce((s, r) => s + r.open, 0);

  return (
    <section className="rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle p-4 flex flex-col min-h-0 h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink-primary">
            <Activity className="w-4 h-4 text-brand-orange shrink-0" aria-hidden="true" />
            <span className="truncate">{title}</span>
          </h3>
          <p className="text-[11px] text-ink-secondary mt-0.5">{subtitle}</p>
        </div>
        <ul className="shrink-0 flex flex-col gap-0.5 text-[10px] font-semibold text-ink-secondary">
          <li className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: BLUE }} aria-hidden="true" />
            All events ({grandTotal.toLocaleString('en-IN')})
          </li>
          <li className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ORANGE }} aria-hidden="true" />
            Open actions ({grandOpen.toLocaleString('en-IN')})
          </li>
        </ul>
      </div>

      <div className="flex-1 min-h-0 mt-1">
        {rows.length === 0 ? (
          <p className="h-full flex items-center justify-center text-xs text-ink-muted">{loading ? 'Loading events…' : 'No events loaded.'}</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" role="img" aria-label="Area line chart of events by plant area">
            <defs>
              <linearGradient id="al-blue" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor={BLUE} stopOpacity="0.22" />
                <stop offset="1" stopColor={BLUE} stopOpacity="0.06" />
              </linearGradient>
              <linearGradient id="al-orange" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor={ORANGE} stopOpacity="0.28" />
                <stop offset="1" stopColor={ORANGE} stopOpacity="0.08" />
              </linearGradient>
            </defs>

            {/* X axis: number of events */}
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const gx = geometry.x(geometry.max * f);
              return (
                <g key={f}>
                  <line x1={gx} x2={gx} y1={M.top - 4} y2={H - M.bottom} stroke="#CBD5E1" strokeDasharray={f === 0 ? undefined : '3 4'} strokeWidth="1" />
                  <text x={gx} y={M.top - 10} textAnchor="middle" fontSize="9" fill="#64748B" fontFamily="monospace">
                    {Math.round(geometry.max * f)}
                  </text>
                </g>
              );
            })}

            {/* hovered row */}
            {hover !== null && (
              <rect x={4} y={geometry.y(hover) - geometry.plotH / rows.length / 2} width={W - 8} height={geometry.plotH / rows.length} fill="#F1F5F9" />
            )}

            {/* areas */}
            <path d={geometry.totalArea} fill="url(#al-blue)" />
            <path d={geometry.openArea} fill="url(#al-orange)" />
            <path d={smoothPath(geometry.total, M.left)} fill="none" stroke={BLUE} strokeWidth="2.2" strokeLinecap="round" />
            <path d={smoothPath(geometry.open, M.left)} fill="none" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" />

            {/* Y axis: plant areas */}
            {rows.map((r, i) => (
              <g key={r.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={0} y={geometry.y(i) - geometry.plotH / rows.length / 2} width={W} height={geometry.plotH / rows.length} fill="transparent" />
                <text x={M.left - 8} y={geometry.y(i) + 3} textAnchor="end" fontSize="9.5" fontWeight="700" fill="#334155" fontFamily="sans-serif">
                  {r.label.replace(/_/g, ' ')}
                </text>
                <circle cx={geometry.total[i][0]} cy={geometry.y(i)} r={3.6} fill="#fff" stroke={BLUE} strokeWidth="2" />
                <circle cx={geometry.open[i][0]} cy={geometry.y(i)} r={3.6} fill="#fff" stroke={ORANGE} strokeWidth="2" />
                <text x={geometry.total[i][0] + 7} y={geometry.y(i) - 4} fontSize="9.5" fontWeight="700" fill={BLUE} fontFamily="monospace">
                  {r.total}
                </text>
                <text x={Math.max(geometry.open[i][0] + 7, M.left + 6)} y={geometry.y(i) + 12} fontSize="9.5" fontWeight="700" fill={ORANGE} fontFamily="monospace">
                  {r.open}
                </text>
                <title>{`${r.label.replace(/_/g, ' ')}: ${r.total} events, ${r.open} with an open corrective action`}</title>
              </g>
            ))}
          </svg>
        )}
      </div>
      <p className="text-[10px] font-mono text-ink-muted mt-1">Source: {source}</p>
    </section>
  );
};
