import React, { useMemo, useState } from 'react';
import { Activity, Flame, Sparkles, TrendingUp } from 'lucide-react';
import type { EhsEventRecord } from '../../types/ehs';

export interface AreaRow {
  /** Plant area (shown on the chart). */
  label: string;
  /** All events in the area. */
  total: number;
  /** Events whose corrective action is still open. */
  open: number;
}

interface AreaLineChartProps {
  title?: string;
  subtitle?: string;
  source?: string;
  rows: AreaRow[];
  rawEvents?: EhsEventRecord[];
  loading?: boolean;
}

type ChartViewMode = 'area-wave' | 'heatmap';

const BLUE_PRIMARY = '#2563EB';
const BLUE_LIGHT = '#60A5FA';
const ORANGE_PRIMARY = '#EA580C';
const ORANGE_LIGHT = '#FB923C';

export const AreaLineChart: React.FC<AreaLineChartProps> = ({
  title = 'Plant & Area Safety Analytics',
  subtitle = 'Interactive live distribution from fact_ehs_event',
  source = 'ehs_core.fact_ehs_event',
  rows,
  rawEvents = [],
  loading = false,
}) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>('area-wave');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string; count: number } | null>(null);

  // Computed totals
  const grandTotal = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);
  const grandOpen = useMemo(() => rows.reduce((s, r) => s + r.open, 0), [rows]);

  /* =========================================================================
     1. AREA WAVE CHART GEOMETRY (HORIZONTAL X-AXIS WITH SMOOTH WAVE)
     ========================================================================= */
  const chartW = 440;
  const chartH = 210;
  const pad = { left: 34, right: 24, top: 28, bottom: 36 };

  const waveData = useMemo(() => {
    if (!rows.length) return null;
    const plotW = chartW - pad.left - pad.right;
    const plotH = chartH - pad.top - pad.bottom;
    const maxVal = Math.max(...rows.map(r => r.total), 10);

    const stepX = rows.length > 1 ? plotW / (rows.length - 1) : plotW / 2;
    const scaleY = (v: number) => pad.top + plotH - (v / maxVal) * plotH;

    const totalPts: [number, number][] = rows.map((r, i) => [pad.left + i * stepX, scaleY(r.total)]);
    const openPts: [number, number][] = rows.map((r, i) => [pad.left + i * stepX, scaleY(r.open)]);

    // Catmull-Rom to Cubic Bézier spline path generator
    const buildSpline = (pts: [number, number][]) => {
      if (pts.length < 2) return '';
      let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];

        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      return d;
    };

    const totalLinePath = buildSpline(totalPts);
    const openLinePath = buildSpline(openPts);

    const baseBottom = pad.top + plotH;
    const totalAreaPath = totalPts.length
      ? `${totalLinePath} L ${totalPts[totalPts.length - 1][0].toFixed(1)} ${baseBottom} L ${totalPts[0][0].toFixed(1)} ${baseBottom} Z`
      : '';
    const openAreaPath = openPts.length
      ? `${openLinePath} L ${openPts[openPts.length - 1][0].toFixed(1)} ${baseBottom} L ${openPts[0][0].toFixed(1)} ${baseBottom} Z`
      : '';

    return {
      maxVal,
      plotW,
      plotH,
      totalPts,
      openPts,
      totalLinePath,
      openLinePath,
      totalAreaPath,
      openAreaPath,
    };
  }, [rows, chartW, chartH, pad.left, pad.right, pad.top, pad.bottom]);

  /* =========================================================================
     2. PLANT AREA × SEVERITY RISK HEATMAP MATRIX
     ========================================================================= */
  const heatmap = useMemo(() => {
    // Unique functional areas (up to top 6)
    const areas = rows.slice(0, 6).map(r => r.label);
    const severities: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    // Frequency map: area -> severity -> count
    const matrix: Record<string, Record<string, number>> = {};
    areas.forEach(a => {
      matrix[a] = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    });

    rawEvents.forEach(e => {
      const area = e.area || 'Other';
      const sev = (e.risk_severity || 'LOW').toUpperCase();
      if (matrix[area] && sev in matrix[area]) {
        matrix[area][sev] += 1;
      }
    });

    let maxCell = 1;
    areas.forEach(a => {
      severities.forEach(s => {
        if (matrix[a][s] > maxCell) maxCell = matrix[a][s];
      });
    });

    return { areas, severities, matrix, maxCell };
  }, [rows, rawEvents]);

  // Heat color interpolator
  const getCellBg = (count: number, max: number, sev: string) => {
    if (count === 0) return 'bg-slate-100 text-slate-400';
    const ratio = count / Math.max(max, 1);

    if (sev === 'CRITICAL') {
      if (ratio > 0.6) return 'bg-red-500 text-white font-bold shadow-xs';
      if (ratio > 0.3) return 'bg-red-300 text-red-950 font-bold';
      return 'bg-red-100 text-red-900 font-semibold';
    }
    if (sev === 'HIGH') {
      if (ratio > 0.6) return 'bg-amber-500 text-white font-bold shadow-xs';
      if (ratio > 0.3) return 'bg-amber-300 text-amber-950 font-bold';
      return 'bg-amber-100 text-amber-900 font-semibold';
    }
    if (sev === 'MEDIUM') {
      if (ratio > 0.5) return 'bg-sky-400 text-slate-900 font-bold';
      return 'bg-sky-100 text-sky-900 font-semibold';
    }
    // LOW
    return 'bg-emerald-100 text-emerald-900 font-semibold';
  };

  return (
    <section className="rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle p-3.5 sm:p-4 flex flex-col min-h-0 h-full">
      {/* Header: Title + Mode Toggle Pills + Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-2.5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-ink-primary">
            <TrendingUp className="w-4 h-4 text-brand-primary shrink-0" aria-hidden="true" />
            <span className="truncate">{title}</span>
          </h3>
          <p className="text-[10px] sm:text-[11px] text-ink-muted truncate mt-0.5">{subtitle}</p>
        </div>

        {/* View Switcher Toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-canvas-subtle p-1 border border-line-subtle">
          <button
            type="button"
            onClick={() => setViewMode('area-wave')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
              viewMode === 'area-wave'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>Area Wave</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('heatmap')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
              viewMode === 'heatmap'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>Risk Heatmap</span>
          </button>
        </div>
      </div>

      {/* Main Visual Display */}
      <div className="flex-1 min-h-0 mt-2 flex flex-col justify-center">
        {loading || rows.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center gap-2 text-xs text-ink-muted">
            <span className="w-5 h-5 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
            <span>Loading live safety data...</span>
          </div>
        ) : viewMode === 'area-wave' && waveData ? (
          /* =================================================================
             MODE 1: ANIMATED AREA WAVE CHART
             ================================================================= */
          <div className="relative w-full h-full flex flex-col justify-between">
            {/* Legend */}
            <div className="flex items-center justify-between text-[10.5px] px-1 mb-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 font-bold text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 animate-pulse" />
                  All Events ({grandTotal.toLocaleString('en-IN')})
                </span>
                <span className="flex items-center gap-1.5 font-bold text-orange-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-600" />
                  Open Actions ({grandOpen.toLocaleString('en-IN')})
                </span>
              </div>
              <span className="text-[10px] text-ink-muted font-mono">
                {rows.length} Plant Functional Areas
              </span>
            </div>

            {/* SVG Wave */}
            <div className="flex-1 w-full min-h-[175px]">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-full overflow-visible"
                role="img"
                aria-label="Interactive animated area chart of plant areas"
              >
                <defs>
                  {/* Glowing Blue Gradient for Total Events Wave */}
                  <linearGradient id="area-blue-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE_LIGHT} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={BLUE_PRIMARY} stopOpacity="0.02" />
                  </linearGradient>

                  {/* Glowing Orange Gradient for Open Actions Wave */}
                  <linearGradient id="area-orange-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ORANGE_LIGHT} stopOpacity="0.55" />
                    <stop offset="100%" stopColor={ORANGE_PRIMARY} stopOpacity="0.04" />
                  </linearGradient>

                  {/* Subtle Drop Shadow */}
                  <filter id="wave-glow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2563EB" floodOpacity="0.25" />
                  </filter>
                </defs>

                {/* Y-axis gridlines */}
                {[0, 0.5, 1].map((ratio, idx) => {
                  const yPos = pad.top + waveData.plotH * (1 - ratio);
                  const labelVal = Math.round(waveData.maxVal * ratio);
                  return (
                    <g key={idx}>
                      <line
                        x1={pad.left}
                        x2={chartW - pad.right}
                        y1={yPos}
                        y2={yPos}
                        stroke="#E2E8F0"
                        strokeDasharray={idx === 0 ? undefined : '3 3'}
                        strokeWidth="1"
                      />
                      <text
                        x={pad.left - 6}
                        y={yPos + 3}
                        fontSize="8.5"
                        textAnchor="end"
                        fill="#94A3B8"
                        fontFamily="monospace"
                        fontWeight="600"
                      >
                        {labelVal}
                      </text>
                    </g>
                  );
                })}

                {/* Area Gradient Paths */}
                <path d={waveData.totalAreaPath} fill="url(#area-blue-grad)" className="transition-all duration-300" />
                <path d={waveData.openAreaPath} fill="url(#area-orange-grad)" className="transition-all duration-300" />

                {/* Spline Strokes */}
                <path
                  d={waveData.totalLinePath}
                  fill="none"
                  stroke={BLUE_PRIMARY}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="url(#wave-glow)"
                />
                <path
                  d={waveData.openLinePath}
                  fill="none"
                  stroke={ORANGE_PRIMARY}
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Vertical Cursor on Hover */}
                {hoveredIdx !== null && waveData.totalPts[hoveredIdx] && (
                  <line
                    x1={waveData.totalPts[hoveredIdx][0]}
                    x2={waveData.totalPts[hoveredIdx][0]}
                    y1={pad.top}
                    y2={pad.top + waveData.plotH}
                    stroke="#64748B"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Data Points and Hit Targets */}
                {rows.map((r, i) => {
                  const [tx, ty] = waveData.totalPts[i] || [0, 0];
                  const [, oy] = waveData.openPts[i] || [0, 0];
                  const isHovered = hoveredIdx === i;

                  return (
                    <g
                      key={r.label}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    >
                      {/* Transparent wide hit region */}
                      <rect
                        x={tx - waveData.plotW / rows.length / 2}
                        y={pad.top}
                        width={waveData.plotW / rows.length}
                        height={waveData.plotH + 20}
                        fill="transparent"
                      />

                      {/* Blue total point */}
                      <circle
                        cx={tx}
                        cy={ty}
                        r={isHovered ? 5.5 : 3.5}
                        fill="#fff"
                        stroke={BLUE_PRIMARY}
                        strokeWidth={isHovered ? 2.5 : 2}
                        className="transition-all duration-150"
                      />

                      {/* Orange open point */}
                      <circle
                        cx={tx}
                        cy={oy}
                        r={isHovered ? 5 : 3}
                        fill="#fff"
                        stroke={ORANGE_PRIMARY}
                        strokeWidth={isHovered ? 2.5 : 2}
                        className="transition-all duration-150"
                      />

                      {/* X-axis label */}
                      <text
                        x={tx}
                        y={pad.top + waveData.plotH + 14}
                        fontSize={isHovered ? '9.5' : '8.5'}
                        fontWeight={isHovered ? '800' : '600'}
                        fill={isHovered ? '#0F172A' : '#64748B'}
                        textAnchor="middle"
                        className="transition-all duration-150 select-none"
                      >
                        {r.label.length > 8 ? `${r.label.slice(0, 7)}.` : r.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Interactive Tooltip Card */}
            {hoveredIdx !== null && rows[hoveredIdx] && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/90 p-2 text-xs flex items-center justify-between shadow-sm animate-fade-in">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                  <span className="font-extrabold text-blue-950 uppercase">{rows[hoveredIdx].label}</span>
                </div>
                <div className="flex items-center gap-3 font-mono font-bold text-[11px]">
                  <span className="text-blue-700">Total: {rows[hoveredIdx].total}</span>
                  <span className="text-orange-700">Open Actions: {rows[hoveredIdx].open}</span>
                  <span className="text-emerald-700">
                    Closed: {Math.max(0, rows[hoveredIdx].total - rows[hoveredIdx].open)}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* =================================================================
             MODE 2: PLANT AREA × SEVERITY RISK HEATMAP
             ================================================================= */
          <div className="w-full h-full flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-ink-primary flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Area × Risk Severity Matrix
              </span>
              <div className="flex items-center gap-2 text-[9.5px] font-mono text-ink-muted">
                <span>Safe</span>
                <span className="w-16 h-2 rounded bg-gradient-to-r from-emerald-200 via-amber-300 to-red-500" />
                <span>Critical</span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto rounded-xl border border-line-subtle bg-canvas-subtle p-2">
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] font-bold text-ink-secondary py-1 pl-1">Plant Area</th>
                    {heatmap.severities.map(sev => (
                      <th key={sev} className="text-[10px] font-mono font-bold text-ink-secondary py-1 px-1">
                        {sev}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60">
                  {heatmap.areas.map(area => (
                    <tr key={area} className="hover:bg-slate-50 transition-colors">
                      <td className="text-left font-bold text-[11px] text-slate-800 py-1.5 pl-1 truncate max-w-[100px]">
                        {area.replace(/_/g, ' ')}
                      </td>
                      {heatmap.severities.map(sev => {
                        const count = heatmap.matrix[area]?.[sev] || 0;
                        const bgClass = getCellBg(count, heatmap.maxCell, sev);
                        const isHovered = hoveredCell?.row === area && hoveredCell?.col === sev;

                        return (
                          <td key={sev} className="p-0.5">
                            <button
                              type="button"
                              onMouseEnter={() => setHoveredCell({ row: area, col: sev, count })}
                              onMouseLeave={() => setHoveredCell(null)}
                              className={`w-full h-7 rounded-md flex items-center justify-center font-mono text-[11px] transition-all transform ${bgClass} ${
                                isHovered ? 'scale-110 ring-2 ring-slate-900 shadow-md z-10' : 'hover:scale-105'
                              }`}
                            >
                              {count}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Heatmap Tooltip */}
            {hoveredCell && (
              <div className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[11px] flex items-center justify-between font-mono animate-fade-in">
                <span>
                  <strong>{hoveredCell.row}</strong>: {hoveredCell.col} Risk
                </span>
                <span className="text-amber-300 font-bold">{hoveredCell.count} logged incidents</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Grounding */}
      <div className="pt-2 border-t border-line-subtle flex items-center justify-between text-[10px] text-ink-muted">
        <span className="font-mono truncate">Source: {source}</span>
        <span className="flex items-center gap-1 font-semibold text-emerald-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live PostgreSQL
        </span>
      </div>
    </section>
  );
};
