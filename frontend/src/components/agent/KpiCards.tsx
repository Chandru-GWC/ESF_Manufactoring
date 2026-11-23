import React from 'react';
import { AgentKpi } from '../../types/ehs';

const TONES: Record<NonNullable<AgentKpi['tone']>, { card: string; value: string; dot: string }> = {
  neutral: { card: 'border-line-subtle bg-canvas-surface', value: 'text-ink-primary', dot: 'bg-slate-400' },
  good: { card: 'border-severity-success-border bg-severity-success-bg/50', value: 'text-severity-success-text', dot: 'bg-severity-success-dot' },
  warning: { card: 'border-severity-warning-border bg-severity-warning-bg/50', value: 'text-severity-warning-text', dot: 'bg-severity-warning-dot' },
  critical: { card: 'border-severity-critical-border bg-severity-critical-bg/50', value: 'text-severity-critical-text', dot: 'bg-severity-critical-dot' },
};

const show = (v: string | number) => (typeof v === 'number' ? v.toLocaleString('en-IN') : v);

/** Row of KPI cards chosen by the agent (label, big value + unit, caption, tone colour). */
export const KpiCards: React.FC<{ kpis: AgentKpi[]; /** 'row': all cards in one straight line (dashboards) */ layout?: 'wrap' | 'row' }> = ({ kpis, layout = 'wrap' }) => {
  const items = (Array.isArray(kpis) ? kpis : []).filter(k => k && k.label != null && k.value != null);
  if (items.length === 0) return null;
  return (
    <div
      className={`grid gap-2.5 ${layout === 'row' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`}
      aria-label="Key figures"
    >
      {items.map((k, i) => {
        const tone = TONES[k.tone ?? 'neutral'] ?? TONES.neutral;
        return (
          <div key={`${k.label}-${i}`} className={`rounded-xl border px-3.5 py-3 min-w-0 ${tone.card}`}>
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-ink-secondary">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} aria-hidden="true" />
              <span className="truncate" title={k.label}>{k.label}</span>
            </div>
            <div className={`mt-1 flex items-baseline gap-1 ${tone.value}`}>
              <span className="text-2xl font-extrabold tracking-tight tabular-nums truncate" title={String(k.value)}>{show(k.value)}</span>
              {k.unit && <span className="text-xs font-semibold opacity-80 shrink-0">{k.unit}</span>}
            </div>
            {k.caption && <p className="mt-0.5 text-[11px] text-ink-secondary leading-snug">{k.caption}</p>}
          </div>
        );
      })}
    </div>
  );
};
