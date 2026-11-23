import React from 'react';
import { AgentKpi } from '../../types/ehs';

const TONES: Record<
  NonNullable<AgentKpi['tone']>,
  { card: string; value: string; dot: string; bar: string; topBorder: string }
> = {
  neutral: {
    card: 'border-violet-100 bg-white/95 hover:border-violet-300',
    value: 'text-slate-900',
    dot: 'bg-violet-600 ring-violet-200',
    bar: 'bg-violet-500',
    topBorder: 'bg-gradient-to-r from-violet-500 to-indigo-500',
  },
  good: {
    card: 'border-emerald-200/80 bg-emerald-50/20 hover:border-emerald-300',
    value: 'text-emerald-900',
    dot: 'bg-emerald-500 ring-emerald-200',
    bar: 'bg-emerald-500',
    topBorder: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  },
  warning: {
    card: 'border-amber-200/80 bg-amber-50/20 hover:border-amber-300',
    value: 'text-amber-900',
    dot: 'bg-amber-500 ring-amber-200',
    bar: 'bg-amber-500',
    topBorder: 'bg-gradient-to-r from-amber-500 to-orange-500',
  },
  critical: {
    card: 'border-rose-200/80 bg-rose-50/20 hover:border-rose-300',
    value: 'text-rose-900',
    dot: 'bg-rose-500 ring-rose-200',
    bar: 'bg-rose-500',
    topBorder: 'bg-gradient-to-r from-rose-500 to-red-500',
  },
};

const show = (v: string | number) => (typeof v === 'number' ? v.toLocaleString('en-IN') : v);

/**
 * Row of KPI cards with violet color grading, glassmorphic elevation,
 * glowing pulse indicators, and mini animated progress tracks.
 */
export const KpiCards: React.FC<{
  kpis: AgentKpi[];
  /** 'row': all cards in one straight line (dashboards) */
  layout?: 'wrap' | 'row';
}> = ({ kpis, layout = 'wrap' }) => {
  const items = (Array.isArray(kpis) ? kpis : []).filter(k => k && k.label != null && k.value != null);
  if (items.length === 0) return null;

  return (
    <div
      className={`grid gap-3 ${
        layout === 'row' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'
      }`}
      aria-label="Key figures"
    >
      {items.map((k, i) => {
        const tone = TONES[k.tone ?? 'neutral'] ?? TONES.neutral;
        // Compute pseudo progress bar width for visual aesthetic
        const numVal = typeof k.value === 'number' ? k.value : parseFloat(String(k.value)) || 50;
        const barPct = k.unit === '%' ? Math.min(100, Math.max(15, numVal)) : Math.min(100, Math.max(25, (numVal % 100) || 60));

        return (
          <div
            key={`${k.label}-${i}`}
            className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 min-w-0 shadow-xs hover:shadow-md transition-all duration-300 group ${tone.card}`}
          >
            {/* Top gradient highlight strip */}
            <div className={`absolute top-0 inset-x-0 h-[2.5px] ${tone.topBorder}`} aria-hidden="true" />

            <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              <span className="truncate" title={k.label}>
                {k.label}
              </span>
              <span className={`w-2 h-2 rounded-full shrink-0 ring-4 ${tone.dot}`} aria-hidden="true" />
            </div>

            <div className={`mt-1.5 flex items-baseline gap-1.5 ${tone.value}`}>
              <span className="text-2xl font-black tracking-tight tabular-nums truncate" title={String(k.value)}>
                {show(k.value)}
              </span>
              {k.unit && <span className="text-xs font-bold opacity-75 shrink-0">{k.unit}</span>}
            </div>

            {k.caption && (
              <p className="mt-1 text-[11px] font-medium text-slate-500 leading-snug line-clamp-1" title={k.caption}>
                {k.caption}
              </p>
            )}

            {/* Base micro progress bar */}
            <div className="mt-2.5 h-1 w-full bg-slate-100 rounded-full overflow-hidden" aria-hidden="true">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${tone.bar}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
