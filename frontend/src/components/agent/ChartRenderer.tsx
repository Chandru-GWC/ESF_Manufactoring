import React from 'react';
import { ChartCell, ChartSeries, ChartSpec, ChartType } from '../../types/ehs';

/**
 * Pure-SVG renderer for the 12 chart types:
 * line, area, bar, horizontal_bar, stacked_bar, grouped_bar, pie, donut, heatmap, scatter, radial_gauge, speedometer.
 * Compact height design tailored with modern violet theme and animations.
 */

export const CHART_PALETTE = [
  '#7C3AED', // Primary vibrant violet
  '#06B6D4', // Cyan accent
  '#10B981', // Emerald green
  '#F59E0B', // Amber warning
  '#8B5CF6', // Purple
  '#EC4899', // Pink / Rose
  '#3B82F6', // Cobalt blue
  '#6366F1', // Indigo
  '#F43F5E', // Crimson
  '#14B8A6', // Teal
];

const INK = '#1E1B4B';
const MUTED = '#64748B';
const GRID = '#F1F5F9';
const AXIS = '#CBD5E1';

const COLOR = (i: number) => CHART_PALETTE[i % CHART_PALETTE.length];

export const CHART_TYPES: ChartType[] = [
  'line',
  'area',
  'bar',
  'horizontal_bar',
  'stacked_bar',
  'grouped_bar',
  'pie',
  'donut',
  'heatmap',
  'scatter',
  'radial_gauge',
  'speedometer',
];

/* ------------------------------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------------------------- */
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function formatValue(v: number, unit?: string): string {
  const a = Math.abs(v);
  let t: string;
  if (a >= 1e9) t = `${(v / 1e9).toFixed(1)}B`;
  else if (a >= 1e6) t = `${(v / 1e6).toFixed(1)}M`;
  else if (a >= 1e4) t = `${(v / 1e3).toFixed(1)}k`;
  else if (Number.isInteger(v)) t = v.toLocaleString('en-IN');
  else t = a < 10 ? v.toFixed(2) : v.toFixed(1);
  return unit ? `${t} ${unit}` : t;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s);
const pretty = (s: string | number) => String(s).replace(/_/g, ' ');

function niceTicks(min: number, max: number, count = 4): { ticks: number[]; min: number; max: number } {
  let lo = Math.min(min, 0);
  let hi = Math.max(max, 0);
  if (hi === lo) hi = lo + 1;
  const rough = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { ticks, min: lo, max: hi };
}

interface Frame {
  W: number;
  H: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  plotW: number;
  plotH: number;
}
const makeFrame = (W: number, H: number, m: { left: number; right: number; top: number; bottom: number }): Frame => ({
  W,
  H,
  ...m,
  plotW: W - m.left - m.right,
  plotH: H - m.top - m.bottom,
});

/** Unique values in order of first appearance. */
function uniq(values: (string | number)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach(v => {
    const k = String(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  });
  return out;
}

/** Series with numeric y values only. */
function cleanSeries(series: ChartSeries[] | undefined): { name: string; data: { x: string; y: number }[] }[] {
  return (series ?? [])
    .map((s, i) => ({
      name: String(s?.name ?? `Series ${i + 1}`),
      data: (Array.isArray(s?.data) ? s.data : [])
        .map(p => ({ x: String(p?.x ?? ''), y: num(p?.y) }))
        .filter((p): p is { x: string; y: number } => p.y !== null && p.x !== ''),
    }))
    .filter(s => s.data.length > 0);
}

/** Returns a reason when the chart cannot be drawn, otherwise null. */
export function chartProblem(spec: ChartSpec): string | null {
  if (!spec || typeof spec !== 'object') return 'no chart data';
  if (!CHART_TYPES.includes(spec.type)) return `unknown chart type "${String(spec.type)}"`;
  if (spec.type === 'pie' || spec.type === 'donut') {
    const total = (Array.isArray(spec.slices) ? spec.slices : []).reduce((s, x) => s + Math.max(0, num(x?.value) ?? 0), 0);
    return total > 0 ? null : 'no slices with a value';
  }
  if (spec.type === 'radial_gauge') {
    const slices = (Array.isArray(spec.slices) ? spec.slices : []).filter(s => num(s.value) !== null);
    if (slices.length > 0) return null;
    const series = cleanSeries(spec.series);
    if (series.length > 0) return null;
    return 'no radial gauge slices or series';
  }
  if (spec.type === 'speedometer') {
    const slices = (Array.isArray(spec.slices) ? spec.slices : []).filter(s => num(s.value) !== null);
    const series = cleanSeries(spec.series);
    if (slices.length > 0 || series.length > 0) return null;
    return 'no speedometer metric value';
  }
  if (spec.type === 'heatmap') {
    const cells = (Array.isArray(spec.cells) ? spec.cells : []).filter(c => c && num(c.value) !== null && c.x != null && c.y != null);
    return cells.length ? null : 'no heatmap cells';
  }
  return cleanSeries(spec.series).length ? null : 'no series with numeric values';
}

/* ------------------------------------------------------------------------------------------------
 * Axes
 * ---------------------------------------------------------------------------------------------- */
const YAxis: React.FC<{ f: Frame; ticks: number[]; scale: (v: number) => number; label?: string; unit?: string }> = ({
  f,
  ticks,
  scale,
  label,
  unit,
}) => (
  <g>
    {ticks.map(t => (
      <g key={t}>
        <line
          x1={f.left}
          x2={f.left + f.plotW}
          y1={scale(t)}
          y2={scale(t)}
          stroke={t === 0 ? AXIS : GRID}
          strokeWidth={t === 0 ? 1 : 0.8}
          strokeDasharray={t === 0 ? undefined : '2 3'}
        />
        <text x={f.left - 5} y={scale(t) + 3} textAnchor="end" fontSize="8.5" fill={MUTED} fontFamily="monospace">
          {formatValue(t)}
        </text>
      </g>
    ))}
    {(label || unit) && (
      <text
        transform={`translate(9 ${f.top + f.plotH / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill={INK}
        fontFamily="inherit"
      >
        {label ?? unit}
      </text>
    )}
  </g>
);

const XLabel: React.FC<{ f: Frame; label?: string }> = ({ f, label }) =>
  label ? (
    <text x={f.left + f.plotW / 2} y={f.H - 3} textAnchor="middle" fontSize="9" fontWeight="600" fill={INK} fontFamily="inherit">
      {label}
    </text>
  ) : null;

/** True when the category labels do not fit horizontally and have to be rotated. */
const needsRotation = (cats: string[], plotW: number) => {
  const band = plotW / Math.max(1, cats.length);
  return band < Math.max(...cats.map(c => pretty(c).length)) * 5 + 4 && band >= 13;
};

/** Category labels under a band axis; rotated and thinned out when they do not fit. */
const CategoryLabels: React.FC<{ f: Frame; cats: string[]; bandW: number }> = ({ f, cats, bandW }) => {
  const rotate = needsRotation(cats, bandW * cats.length);
  const every = bandW >= 14 ? 1 : Math.ceil(14 / Math.max(bandW, 1));
  const y = f.top + f.plotH + 11;
  return (
    <g>
      {cats.map((c, i) =>
        i % every !== 0 ? null : (
          <text
            key={c}
            x={f.left + bandW * (i + 0.5)}
            y={y}
            textAnchor={rotate ? 'end' : 'middle'}
            transform={rotate ? `rotate(-30 ${f.left + bandW * (i + 0.5)} ${y - 2})` : undefined}
            fontSize="8.5"
            fill={INK}
            fontFamily="inherit"
          >
            {clip(pretty(c), rotate ? 14 : Math.max(4, Math.floor(bandW / 5)))}
          </text>
        )
      )}
    </g>
  );
};

/* ------------------------------------------------------------------------------------------------
 * line / area / scatter (Compact height 160px)
 * ---------------------------------------------------------------------------------------------- */
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const dx: number[] = [],
    m: number[] = [],
    t: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0] || 1e-6);
    m.push((pts[i + 1][1] - pts[i][1]) / dx[i]);
  }
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(
      pts[i + 1][1] -
      t[i + 1] * h
    ).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

const LineAreaChart: React.FC<{ spec: ChartSpec; area: boolean }> = ({ spec, area }) => {
  const series = cleanSeries(spec.series);
  const cats = uniq(series.flatMap(s => s.data.map(p => p.x)));
  const stacked = area && series.length > 2;
  const at = (si: number, c: string) => series[si].data.find(p => p.x === c)?.y ?? 0;
  const cum = (si: number, c: string) => series.slice(0, si + 1).reduce((t, _, k) => t + at(k, c), 0);
  const allY = stacked ? cats.flatMap(c => [0, cum(series.length - 1, c)]) : series.flatMap(s => s.data.map(p => p.y));
  const { ticks, min, max } = niceTicks(Math.min(...allY), Math.max(...allY));
  const rotated = needsRotation(cats, 520 - 46 - 16);
  const f = makeFrame(520, 160, { left: 46, right: 16, top: 12, bottom: rotated ? 44 : 26 });
  const y = (v: number) => f.top + f.plotH - ((v - min) / (max - min)) * f.plotH;
  const band = f.plotW / cats.length;
  const edge = cats.length > 1 ? 12 : 0;
  const x = (i: number) =>
    cats.length > 1 ? f.left + edge + ((f.plotW - 2 * edge) * i) / (cats.length - 1) : f.left + f.plotW / 2;
  const labelValues = series.length === 1 && cats.length <= 10;

  return (
    <svg viewBox={`0 0 ${f.W} ${f.H}`} className="w-full h-auto" role="img" aria-label={spec.title}>
      <defs>
        <filter id={`violet-glow-${spec.title.replace(/\W/g, '')}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#7C3AED" floodOpacity="0.2" />
        </filter>
      </defs>
      <YAxis f={f} ticks={ticks} scale={y} label={spec.y_axis?.label} unit={spec.unit} />
      <CategoryLabels f={f} cats={cats} bandW={band} />
      <XLabel f={f} label={spec.x_axis?.label} />
      {series.map((s, si) => {
        const pts = s.data.map(p => [x(cats.indexOf(p.x)), y(stacked ? cum(si, p.x) : p.y), p] as const).sort((a, b) => a[0] - b[0]);
        const line = smoothPath(pts.map(p => [p[0], p[1]] as const));
        const lower = stacked && si > 0 ? pts.map(p => [p[0], y(cum(si - 1, p[2].x))] as const).reverse() : null;
        const fill = lower
          ? `${line} L${smoothPath(lower).slice(1)} Z`
          : `${line} L${pts[pts.length - 1][0].toFixed(1)},${y(0).toFixed(1)} L${pts[0][0].toFixed(1)},${y(0).toFixed(1)} Z`;
        return (
          <g key={s.name}>
            {area && (
              <>
                <defs>
                  <linearGradient id={`area-grad-${si}-${s.name.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR(si)} stopOpacity={stacked ? 0.6 : series.length > 1 ? 0.25 : 0.45} />
                    <stop offset="100%" stopColor={COLOR(si)} stopOpacity={stacked ? 0.25 : 0.02} />
                  </linearGradient>
                </defs>
                <path d={fill} fill={`url(#area-grad-${si}-${s.name.replace(/\W/g, '')})`} />
              </>
            )}
            <path
              d={line}
              fill="none"
              stroke={COLOR(si)}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={`url(#violet-glow-${spec.title.replace(/\W/g, '')})`}
            />
            {pts.map(([px, py, p]) => (
              <g key={`${p.x}-${p.y}`} className="group cursor-pointer">
                <circle cx={px} cy={py} r={pts.length > 14 ? 2.5 : 3.5} fill="#FFFFFF" stroke={COLOR(si)} strokeWidth="2" />
                <title>{`${s.name} · ${pretty(p.x)}: ${formatValue(p.y, spec.unit)}`}</title>
                {labelValues && (
                  <text
                    x={px}
                    y={py - 6}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="700"
                    fill={COLOR(si)}
                    fontFamily="monospace"
                  >
                    {formatValue(p.y)}
                  </text>
                )}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
};

const ScatterChart: React.FC<{ spec: ChartSpec }> = ({ spec }) => {
  const series = cleanSeries(spec.series);
  const raw = series.flatMap(s => s.data.map(p => ({ s: s.name, xs: p.x, xn: num(p.x), y: p.y })));
  const numericX = raw.every(r => r.xn !== null);
  const cats = numericX ? [] : uniq(raw.map(r => r.xs));
  const xv = (r: (typeof raw)[number]) => (numericX ? (r.xn as number) : cats.indexOf(r.xs));
  const xs = raw.map(xv);
  const xt = niceTicks(Math.min(...xs, 0), Math.max(...xs, numericX ? 0 : cats.length - 1));
  const yt = niceTicks(Math.min(...raw.map(r => r.y)), Math.max(...raw.map(r => r.y)));
  const f = makeFrame(520, 160, { left: 46, right: 16, top: 12, bottom: 28 });
  const X = (v: number) => f.left + ((v - xt.min) / (xt.max - xt.min)) * f.plotW;
  const Y = (v: number) => f.top + f.plotH - ((v - yt.min) / (yt.max - yt.min)) * f.plotH;

  return (
    <svg viewBox={`0 0 ${f.W} ${f.H}`} className="w-full h-auto" role="img" aria-label={spec.title}>
      <YAxis f={f} ticks={yt.ticks} scale={Y} label={spec.y_axis?.label} unit={spec.unit} />
      {xt.ticks.map(t => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={f.top} y2={f.top + f.plotH} stroke={GRID} strokeDasharray="3 4" />
          <text x={X(t)} y={f.top + f.plotH + 11} textAnchor="middle" fontSize="8.5" fill={MUTED} fontFamily="monospace">
            {numericX ? formatValue(t) : clip(pretty(cats[Math.round(t)] ?? ''), 10)}
          </text>
        </g>
      ))}
      <XLabel f={f} label={spec.x_axis?.label} />
      {series.map((s, si) =>
        s.data.map((p, i) => {
          const r = { s: s.name, xs: p.x, xn: num(p.x), y: p.y };
          return (
            <circle
              key={`${s.name}-${i}`}
              cx={X(xv(r))}
              cy={Y(p.y)}
              r={4}
              fill={COLOR(si)}
              fillOpacity={0.8}
              stroke="#fff"
              strokeWidth="1.2"
            >
              <title>{`${s.name} · ${pretty(p.x)}: ${formatValue(p.y, spec.unit)}`}</title>
            </circle>
          );
        })
      )}
    </svg>
  );
};

/* ------------------------------------------------------------------------------------------------
 * bar / grouped_bar / stacked_bar (Compact height 160px)
 * ---------------------------------------------------------------------------------------------- */
const BarChart: React.FC<{ spec: ChartSpec; mode: 'bar' | 'grouped' | 'stacked' }> = ({ spec, mode }) => {
  const series = cleanSeries(spec.series);
  const cats = uniq(series.flatMap(s => s.data.map(p => p.x)));
  const val = (si: number, cat: string) => series[si].data.find(p => p.x === cat)?.y ?? 0;
  const stacked = mode === 'stacked';
  const totals = cats.map(c => series.reduce((sum, _, si) => sum + Math.max(0, val(si, c)), 0));
  const maxY = stacked ? Math.max(...totals) : Math.max(...series.flatMap(s => s.data.map(p => p.y)));
  const minY = stacked ? 0 : Math.min(...series.flatMap(s => s.data.map(p => p.y)));
  const { ticks, min, max } = niceTicks(minY, maxY);
  const rotated = needsRotation(cats, 520 - 46 - 16);
  const f = makeFrame(520, 160, { left: 46, right: 16, top: 12, bottom: rotated ? 44 : 26 });
  const y = (v: number) => f.top + f.plotH - ((v - min) / (max - min)) * f.plotH;
  const band = f.plotW / cats.length;
  const groupW = Math.min(band * 0.72, 54 * series.length);
  const barW = stacked || series.length === 1 ? groupW : groupW / series.length;
  const showValues = band >= 24 && cats.length <= 12;

  return (
    <svg viewBox={`0 0 ${f.W} ${f.H}`} className="w-full h-auto" role="img" aria-label={spec.title}>
      <defs>
        {series.map((_, si) => (
          <linearGradient key={`bar-grad-${si}`} id={`bar-grad-${si}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR(si)} stopOpacity="1" />
            <stop offset="100%" stopColor={COLOR(si)} stopOpacity="0.8" />
          </linearGradient>
        ))}
      </defs>
      <YAxis f={f} ticks={ticks} scale={y} label={spec.y_axis?.label} unit={spec.unit} />
      <CategoryLabels f={f} cats={cats} bandW={band} />
      <XLabel f={f} label={spec.x_axis?.label} />
      {cats.map((c, ci) => {
        const cx = f.left + band * (ci + 0.5);
        let acc = 0;
        return (
          <g key={c}>
            {series.map((s, si) => {
              const v = val(si, c);
              const present = s.data.some(p => p.x === c);
              if (!present) return null;
              const x0 = stacked || series.length === 1 ? cx - groupW / 2 : cx - groupW / 2 + si * barW;
              const top = stacked ? y(acc + Math.max(0, v)) : y(Math.max(v, 0));
              const bottom = stacked ? y(acc) : y(Math.min(v, 0));
              if (stacked) acc += Math.max(0, v);
              const h = Math.max(2, bottom - top);
              return (
                <g key={s.name}>
                  <rect
                    x={x0 + 0.5}
                    y={top}
                    width={Math.max(2, barW - 1)}
                    height={h}
                    rx={3}
                    fill={`url(#bar-grad-${series.length === 1 ? 0 : si})`}
                  >
                    <title>{`${s.name} · ${pretty(c)}: ${formatValue(v, spec.unit)}`}</title>
                  </rect>
                  {showValues && !stacked && (
                    <text
                      x={x0 + barW / 2}
                      y={v >= 0 ? top - 3 : bottom + 9}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="700"
                      fill={INK}
                      fontFamily="monospace"
                    >
                      {formatValue(v)}
                    </text>
                  )}
                </g>
              );
            })}
            {stacked && showValues && (
              <text
                x={cx}
                y={y(totals[ci]) - 3}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="700"
                fill={INK}
                fontFamily="monospace"
              >
                {formatValue(totals[ci])}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

const HorizontalBarChart: React.FC<{ spec: ChartSpec }> = ({ spec }) => {
  const series = cleanSeries(spec.series);
  const cats = uniq(series.flatMap(s => s.data.map(p => p.x))).slice(0, 6);
  const val = (si: number, cat: string) => series[si].data.find(p => p.x === cat)?.y ?? 0;
  const allY = series.flatMap(s => s.data.map(p => p.y));
  const { ticks, min, max } = niceTicks(Math.min(...allY), Math.max(...allY));
  const labelW = Math.min(115, 8 + Math.max(...cats.map(c => pretty(c).length)) * 5);
  const rowH = Math.max(18, 14 + series.length * 8);
  const H = Math.max(145, 18 + cats.length * rowH + 28);
  const f = makeFrame(520, H, { left: 18 + labelW, right: 38, top: 8, bottom: 26 });
  const X = (v: number) => f.left + ((v - min) / (max - min)) * f.plotW;
  const band = f.plotH / cats.length;
  const barH = Math.min(16, (band * 0.72) / series.length);

  return (
    <svg viewBox={`0 0 ${f.W} ${f.H}`} className="w-full h-auto" role="img" aria-label={spec.title}>
      {ticks.map(t => (
        <g key={t}>
          <line
            x1={X(t)}
            x2={X(t)}
            y1={f.top}
            y2={f.top + f.plotH}
            stroke={t === 0 ? AXIS : GRID}
            strokeWidth={t === 0 ? 1 : 0.8}
            strokeDasharray={t === 0 ? undefined : '2 3'}
          />
          <text x={X(t)} y={f.top + f.plotH + 11} textAnchor="middle" fontSize="8.5" fill={MUTED} fontFamily="monospace">
            {formatValue(t)}
          </text>
        </g>
      ))}
      {cats.map((c, ci) => {
        const cy = f.top + band * (ci + 0.5);
        return (
          <g key={c}>
            <text x={f.left - 6} y={cy + 3} textAnchor="end" fontSize="9" fontWeight="600" fill={INK} fontFamily="inherit">
              {clip(pretty(c), Math.floor(labelW / 5))}
            </text>
            {series.map((s, si) => {
              if (!s.data.some(p => p.x === c)) return null;
              const v = val(si, c);
              const y0 = cy - (barH * series.length) / 2 + si * barH;
              const x0 = X(Math.min(0, v));
              const x1 = X(Math.max(0, v));
              return (
                <g key={s.name}>
                  <rect
                    x={x0}
                    y={y0 + 0.5}
                    width={Math.max(2, x1 - x0)}
                    height={Math.max(2.5, barH - 1)}
                    rx={2.5}
                    fill={COLOR(series.length === 1 ? 0 : si)}
                  >
                    <title>{`${s.name} · ${pretty(c)}: ${formatValue(v, spec.unit)}`}</title>
                  </rect>
                  <text
                    x={x1 + 4}
                    y={y0 + barH / 2 + 2.5}
                    fontSize="8.5"
                    fontWeight="700"
                    fill={INK}
                    fontFamily="monospace"
                  >
                    {formatValue(v)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------------------------------------
 * pie / donut (Compact height 155px)
 * ---------------------------------------------------------------------------------------------- */
const PieChart: React.FC<{ spec: ChartSpec; donut: boolean }> = ({ spec, donut }) => {
  let slices = (Array.isArray(spec.slices) ? spec.slices : [])
    .map(s => ({ label: String(s?.label ?? ''), value: Math.max(0, num(s?.value) ?? 0) }))
    .filter(s => s.value > 0);
  if (slices.length > 7) {
    const head = slices.slice(0, 6);
    const rest = slices.slice(6).reduce((a, s) => a + s.value, 0);
    slices = [...head, { label: 'Other', value: rest }];
  }
  const total = slices.reduce((a, s) => a + s.value, 0);
  const W = 520;
  const H = 155;
  const cx = 95;
  const cy = H / 2;
  const R = 66;
  const r = donut ? 42 : 0;
  let angle = -Math.PI / 2;
  const arcs = slices.map((s, i) => {
    const frac = total > 0 ? s.value / total : 0;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
    const d =
      frac >= 0.9999
        ? ''
        : r > 0
        ? `M${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${large} 0 ${p(r, a0)} Z`
        : `M${cx},${cy} L${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} Z`;
    const mid = (a0 + a1) / 2;
    const labelR = r > 0 ? (R + r) / 2 : R * 0.62;
    return { ...s, i, frac, d, lx: cx + labelR * Math.cos(mid), ly: cy + labelR * Math.sin(mid) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={spec.title}>
      {arcs.map(a =>
        a.d === '' ? (
          <g key={a.label}>
            <circle cx={cx} cy={cy} r={R} fill={COLOR(a.i)} />
            {r > 0 && <circle cx={cx} cy={cy} r={r} fill="#fff" />}
          </g>
        ) : (
          <path key={a.label} d={a.d} fill={COLOR(a.i)} stroke="#fff" strokeWidth="2" strokeLinejoin="round">
            <title>{`${pretty(a.label)}: ${formatValue(a.value, spec.unit)} (${(a.frac * 100).toFixed(1)}%)`}</title>
          </path>
        )
      )}
      {arcs.map(a =>
        a.frac >= 0.08 ? (
          <text
            key={`t-${a.label}`}
            x={a.lx}
            y={a.ly + 3}
            textAnchor="middle"
            fontSize="9"
            fontWeight="800"
            fill="#fff"
            fontFamily="inherit"
            pointerEvents="none"
          >
            {Math.round(a.frac * 100)}%
          </text>
        ) : null
      )}
      {donut && (
        <g>
          <text x={cx} y={cy - 1} textAnchor="middle" fontSize="18" fontWeight="800" fill="#4C1D95" fontFamily="inherit">
            {formatValue(total)}
          </text>
          <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fontWeight="600" fill={MUTED} fontFamily="inherit">
            {spec.unit ? spec.unit : 'total'}
          </text>
        </g>
      )}
      {/* legend */}
      {arcs.map((a, row) => {
        const ly = Math.max(16, cy - (arcs.length * 19) / 2) + row * 19;
        return (
          <g key={`l-${a.label}`}>
            <rect x={200} y={ly - 8} width={9} height={9} rx={2.5} fill={COLOR(a.i)} />
            <text x={216} y={ly} fontSize="10" fill={INK} fontFamily="inherit">
              {clip(pretty(a.label), 22)}
            </text>
            <text x={W - 8} y={ly} textAnchor="end" fontSize="10" fontWeight="700" fill={INK} fontFamily="monospace">
              {formatValue(a.value)} · {(a.frac * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------------------------------------
 * heatmap (Compact height 150px)
 * ---------------------------------------------------------------------------------------------- */
const heat = (t: number) => {
  const lo = [245, 243, 255];
  const hi = [91, 33, 182];
  const c = lo.map((l, i) => Math.round(l + (hi[i] - l) * Math.min(1, Math.max(0, t))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

const HeatmapChart: React.FC<{ spec: ChartSpec }> = ({ spec }) => {
  const cells = (Array.isArray(spec.cells) ? spec.cells : [])
    .map((c: ChartCell) => ({ x: String(c.x), y: String(c.y), v: num(c.value) }))
    .filter((c): c is { x: string; y: string; v: number } => c.v !== null);
  const cols = uniq(cells.map(c => c.x));
  const rows = uniq(cells.map(c => c.y)).slice(0, 6);
  const vals = cells.map(c => c.v);
  const lo = Math.min(...vals, 0);
  const hi = Math.max(...vals, 1);
  const labelW = Math.min(100, 10 + Math.max(...rows.map(r => pretty(r).length)) * 4.8);
  const rotated = needsRotation(cols, 520 - (20 + labelW) - 10);
  const cellH = Math.min(18, Math.max(14, 95 / rows.length));
  const f = makeFrame(520, 18 + rows.length * cellH + (rotated ? 48 : 26), {
    left: 20 + labelW,
    right: 10,
    top: 6,
    bottom: rotated ? 44 : 22,
  });
  const cw = f.plotW / cols.length;
  const get = (x: string, y: string) => cells.find(c => c.x === x && c.y === y)?.v;

  return (
    <svg viewBox={`0 0 ${f.W} ${f.H}`} className="w-full h-auto" role="img" aria-label={spec.title}>
      {rows.map((r, ri) => (
        <text
          key={r}
          x={f.left - 5}
          y={f.top + cellH * (ri + 0.5) + 3}
          textAnchor="end"
          fontSize="8.5"
          fontWeight="600"
          fill={INK}
          fontFamily="inherit"
        >
          {clip(pretty(r), Math.floor(labelW / 5))}
        </text>
      ))}
      {cols.map((c, ci) => {
        const x = f.left + cw * (ci + 0.5);
        const y = f.top + cellH * rows.length + 10;
        return (
          <text
            key={c}
            x={x}
            y={y}
            textAnchor={rotated ? 'end' : 'middle'}
            transform={rotated ? `rotate(-30 ${x} ${y - 2})` : undefined}
            fontSize="8.5"
            fill={INK}
            fontFamily="inherit"
          >
            {clip(pretty(c), rotated ? 14 : Math.max(4, Math.floor(cw / 5)))}
          </text>
        );
      })}
      {rows.map((r, ri) =>
        cols.map((c, ci) => {
          const v = get(c, r);
          const t = v === undefined ? 0 : hi === lo ? 0.6 : (v - lo) / (hi - lo);
          return (
            <g key={`${r}-${c}`}>
              <rect
                x={f.left + cw * ci + 0.8}
                y={f.top + cellH * ri + 0.8}
                width={Math.max(2, cw - 1.6)}
                height={cellH - 1.6}
                rx={2.5}
                fill={v === undefined ? '#F5F3FF' : heat(t)}
              >
                <title>{`${pretty(r)} × ${pretty(c)}: ${v === undefined ? 'no data' : formatValue(v, spec.unit)}`}</title>
              </rect>
              {v !== undefined && cw >= 22 && (
                <text
                  x={f.left + cw * (ci + 0.5)}
                  y={f.top + cellH * (ri + 0.5) + 3}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill={t > 0.45 ? '#FFFFFF' : '#5B21B6'}
                  fontFamily="monospace"
                  pointerEvents="none"
                >
                  {formatValue(v)}
                </text>
              )}
            </g>
          );
        })
      )}
    </svg>
  );
};

/* ------------------------------------------------------------------------------------------------
 * radial_gauge (Compact height 150px)
 * ---------------------------------------------------------------------------------------------- */
const RadialGaugeChart: React.FC<{ spec: ChartSpec }> = ({ spec }) => {
  const rings: { label: string; value: number }[] = [];
  if (Array.isArray(spec.slices) && spec.slices.length > 0) {
    spec.slices.forEach(s => {
      const v = num(s.value);
      if (v !== null) rings.push({ label: String(s.label ?? ''), value: v });
    });
  } else if (spec.series && spec.series.length > 0) {
    spec.series.forEach(s => {
      const v = s.data?.[0]?.y;
      if (v !== undefined) rings.push({ label: s.name, value: v });
    });
  }

  const W = 520;
  const H = 150;
  const count = rings.length || 3;
  const radius = 38;
  const strokeWidth = 6.5;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={spec.title}>
      {rings.slice(0, 4).map((ring, idx) => {
        const cx = (W / (count + 1)) * (idx + 1);
        const cy = 60;
        const pct = Math.min(100, Math.max(0, ring.value));
        const offset = circumference - (pct / 100) * circumference;
        const color = COLOR(idx);

        return (
          <g key={ring.label}>
            {/* Background track circle */}
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#EDE9FE" strokeWidth={strokeWidth} />
            {/* Foreground animated value stroke */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              className="transition-all duration-700 ease-out"
            />
            {/* Percentage text */}
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize="17" fontWeight="800" fill="#4C1D95" fontFamily="inherit">
              {Math.round(pct)}%
            </text>
            {/* Subtitle / Ring Label */}
            <text x={cx} y={cy + 52} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK} fontFamily="inherit">
              {pretty(ring.label)}
            </text>
            <text x={cx} y={cy + 66} textAnchor="middle" fontSize="9" fontWeight="600" fill={MUTED} fontFamily="monospace">
              Target: ≥90%
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------------------------------------
 * speedometer (Compact height 150px)
 * ---------------------------------------------------------------------------------------------- */
const SpeedometerChart: React.FC<{ spec: ChartSpec }> = ({ spec }) => {
  let val = 85.0;
  let targetLabel = 'On-Time SLA Resolution';
  if (Array.isArray(spec.slices) && spec.slices.length > 0) {
    const v = num(spec.slices[0]?.value);
    if (v !== null) val = v;
    if (spec.slices[0]?.label) targetLabel = spec.slices[0].label;
  } else if (spec.series && spec.series[0]?.data?.[0]?.y !== undefined) {
    val = spec.series[0].data[0].y;
  }

  const W = 520;
  const H = 150;
  const cx = W / 2;
  const cy = 112;
  const R = 84;
  const r = 62;

  const pct = Math.min(100, Math.max(0, val));
  const norm = pct / 100;
  const needleAngle = -180 + norm * 180;
  const rad = (needleAngle * Math.PI) / 180;
  const needleLen = 66;
  const nx = cx + needleLen * Math.cos(rad);
  const ny = cy + needleLen * Math.sin(rad);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={spec.title}>
      {/* Zone 1: 0% - 60% */}
      <path
        d={`M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R * Math.cos(-Math.PI * 0.4)},${cy + R * Math.sin(-Math.PI * 0.4)} L${
          cx + r * Math.cos(-Math.PI * 0.4)
        },${cy + r * Math.sin(-Math.PI * 0.4)} A${r},${r} 0 0 0 ${cx - r},${cy} Z`}
        fill="#FEE2E2"
      />
      {/* Zone 2: 60% - 80% */}
      <path
        d={`M${cx + R * Math.cos(-Math.PI * 0.4)},${cy + R * Math.sin(-Math.PI * 0.4)} A${R},${R} 0 0 1 ${
          cx + R * Math.cos(-Math.PI * 0.2)
        },${cy + R * Math.sin(-Math.PI * 0.2)} L${cx + r * Math.cos(-Math.PI * 0.2)},${
          cy + r * Math.sin(-Math.PI * 0.2)
        } A${r},${r} 0 0 0 ${cx + r * Math.cos(-Math.PI * 0.4)},${cy + r * Math.sin(-Math.PI * 0.4)} Z`}
        fill="#FEF3C7"
      />
      {/* Zone 3: 80% - 100% Target */}
      <path
        d={`M${cx + R * Math.cos(-Math.PI * 0.2)},${cy + R * Math.sin(-Math.PI * 0.2)} A${R},${R} 0 0 1 ${cx + R},${cy} L${
          cx + r
        },${cy} A${r},${r} 0 0 0 ${cx + r * Math.cos(-Math.PI * 0.2)},${cy + r * Math.sin(-Math.PI * 0.2)} Z`}
        fill="#EDE9FE"
      />

      <text x={cx - R + 6} y={cy + 13} fontSize="9" fontWeight="700" fill="#991B1B" fontFamily="monospace">
        0%
      </text>
      <text x={cx + R - 15} y={cy + 13} fontSize="9" fontWeight="700" fill="#6D28D9" fontFamily="monospace">
        100%
      </text>
      <text x={cx} y={cy - R + 18} textAnchor="middle" fontSize="9" fontWeight="700" fill="#5B21B6" fontFamily="inherit">
        TARGET: ≥85%
      </text>

      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#7C3AED" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={7} fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r={2.5} fill="#FFFFFF" />

      {/* Big readout value */}
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize="20" fontWeight="800" fill="#4C1D95" fontFamily="inherit">
        {val.toFixed(1)}%
      </text>
      {/* Target pill */}
      <rect x={cx - 70} y={cy + 29} width="140" height="17" rx="8.5" fill="#F5F3FF" stroke="#DDD6FE" />
      <text x={cx} y={cy + 41} textAnchor="middle" fontSize="9" fontWeight="700" fill="#6D28D9" fontFamily="inherit">
        {targetLabel}
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Public component
 * ---------------------------------------------------------------------------------------------- */
const TYPE_LABEL: Record<ChartType, string> = {
  line: 'Trend Line',
  area: 'Area Wave',
  bar: 'Bar Chart',
  horizontal_bar: 'Ranked Bar',
  stacked_bar: 'Stacked Bar',
  grouped_bar: 'Grouped Bar',
  pie: 'Pie Chart',
  donut: 'Donut Matrix',
  heatmap: 'Risk Heatmap',
  scatter: 'Scatter Matrix',
  radial_gauge: 'Compliance Rings',
  speedometer: 'SLA Speedometer',
};

export const ChartRenderer: React.FC<{ spec: ChartSpec }> = ({ spec }) => {
  const problem = chartProblem(spec);
  const title = spec?.title || 'Chart';
  const multi =
    !problem &&
    spec.type !== 'pie' &&
    spec.type !== 'donut' &&
    spec.type !== 'heatmap' &&
    spec.type !== 'radial_gauge' &&
    spec.type !== 'speedometer'
      ? cleanSeries(spec.series)
      : [];

  let body: React.ReactNode = null;
  if (!problem) {
    switch (spec.type) {
      case 'line':
        body = <LineAreaChart spec={spec} area={false} />;
        break;
      case 'area':
        body = <LineAreaChart spec={spec} area />;
        break;
      case 'bar':
        body = <BarChart spec={spec} mode={multi.length > 1 ? 'grouped' : 'bar'} />;
        break;
      case 'grouped_bar':
        body = <BarChart spec={spec} mode="grouped" />;
        break;
      case 'stacked_bar':
        body = <BarChart spec={spec} mode="stacked" />;
        break;
      case 'horizontal_bar':
        body = <HorizontalBarChart spec={spec} />;
        break;
      case 'pie':
        body = <PieChart spec={spec} donut={false} />;
        break;
      case 'donut':
        body = <PieChart spec={spec} donut />;
        break;
      case 'heatmap':
        body = <HeatmapChart spec={spec} />;
        break;
      case 'scatter':
        body = <ScatterChart spec={spec} />;
        break;
      case 'radial_gauge':
        body = <RadialGaugeChart spec={spec} />;
        break;
      case 'speedometer':
        body = <SpeedometerChart spec={spec} />;
        break;
    }
  }

  return (
    <figure
      className="rounded-2xl border border-violet-100 bg-white/95 p-3.5 min-w-0 shadow-xs hover:border-violet-200 hover:shadow-md transition-all duration-300 [text-rendering:geometricPrecision]"
      data-chart-type={spec?.type}
    >
      <figcaption className="mb-1.5 flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-xs font-bold text-ink-primary leading-tight truncate" title={title}>
            {title}
          </span>
          {spec?.subtitle && (
            <span className="block text-[10px] text-slate-500 mt-0.5 truncate" title={spec.subtitle}>
              {spec.subtitle}
            </span>
          )}
        </span>
        {CHART_TYPES.includes(spec?.type) && (
          <span className="shrink-0 text-[8.5px] font-mono font-bold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-200/80 rounded-full px-2 py-0.5">
            {TYPE_LABEL[spec.type]}
          </span>
        )}
      </figcaption>

      {problem ? (
        <p role="note" className="text-xs text-slate-400 bg-violet-50/50 border border-violet-100 rounded-xl px-2.5 py-3 text-center">
          This chart could not be drawn ({problem}).
        </p>
      ) : (
        body
      )}

      {multi.length > 1 && (
        <ul className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] font-semibold text-slate-600">
          {multi.map((s, i) => (
            <li key={s.name} className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ background: COLOR(i) }} aria-hidden="true" />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
};
