import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { ehsApi } from '../../services/api';
import { useAlerts } from '../../context/AlertContext';
import type { CapaOverdueResponse } from '../../types/ehs';
import { ESCALATION_BADGE } from './AlertBadges';

/** Loads overdue CAPAs (with escalation level) for the active plant scope. Refetches when alerts refresh. */
export function useCapaOverdue(plantId: string) {
  const { version } = useAlerts();
  const [state, setState] = useState<{ data: CapaOverdueResponse | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  useEffect(() => {
    let cancelled = false;
    ehsApi
      .getCapaOverdue(plantId, 500)
      .then(data => !cancelled && setState({ data, loading: false, error: null }))
      .catch(err => !cancelled && setState({ data: null, loading: false, error: err?.message || 'Unable to load overdue CAPA data.' }));
    return () => {
      cancelled = true;
    };
  }, [plantId, version]);
  return state;
}

const DEFAULT_ROLES = ['Responsible team lead', 'Plant EHS manager', 'Safety director'];

export const CapaEscalationPanel: React.FC<{
  state: ReturnType<typeof useCapaOverdue>;
  onSelectEvent: (eventId: string) => void;
}> = ({ state, onSelectEvent }) => {
  const { data, loading, error } = state;
  if (loading) return <div className="h-32 rounded-xl border border-line-subtle bg-canvas-surface animate-pulse" aria-busy="true" />;
  if (error || !data) {
    return (
      <div className="p-4 rounded-xl border border-line-subtle bg-canvas-surface text-xs text-ink-muted">
        Overdue &amp; escalation data unavailable{error ? `: ${error}` : '.'}
      </div>
    );
  }
  const roleFor = (level: number) =>
    data.items.find(i => i.escalation_level === level)?.escalated_to || DEFAULT_ROLES[level - 1];
  const top = data.items.slice(0, 5);

  return (
    <section aria-label="Overdue and escalation" className="p-5 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-orange" aria-hidden="true" /> Overdue &amp; escalation
          </h2>
          <p className="text-[11px] text-ink-muted mt-0.5">
            Escalation is by days past due. Reminders are sent in-app only; email, SMS and push are not configured.
          </p>
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <div className="text-xl font-bold font-mono tabular-nums text-ink-primary">{data.total_overdue}</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">Overdue</div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono tabular-nums text-ink-primary">{data.critical_or_high}</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">Critical / high</div>
          </div>
        </div>
      </div>

      {data.total_overdue === 0 ? (
        <p className="text-xs text-ink-secondary">No corrective actions are past their due date.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 grid grid-cols-3 gap-2">
            {[1, 2, 3].map(level => (
              <div key={level} className={`p-3 rounded-lg border ${ESCALATION_BADGE(level)}`}>
                <div className="text-lg font-bold font-mono tabular-nums">{data.by_escalation_level[String(level)] ?? 0}</div>
                <div className="text-[10px] font-semibold leading-tight">Level {level}</div>
                <div className="text-[10px] opacity-80 leading-tight mt-0.5">{roleFor(level)}</div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-7">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-secondary mb-1.5">Highest-priority overdue</div>
            <ul className="divide-y divide-line-subtle">
              {top.map(i => (
                <li key={i.event_id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(i.event_id)}
                    className="w-full flex items-center justify-between gap-3 py-1.5 text-left hover:bg-canvas-subtle rounded px-1 focus-ring"
                  >
                    <span className="font-mono text-xs font-semibold text-brand-purple">{i.event_id}</span>
                    <span className="font-mono text-[11px] text-ink-secondary">{i.owner}</span>
                    <span className="font-mono text-[11px] text-ink-primary tabular-nums">{i.days_overdue}d</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border truncate max-w-[150px] ${ESCALATION_BADGE(i.escalation_level)}`}>
                      {i.escalated_to ? `L${i.escalation_level} · ${i.escalated_to}` : 'Not escalated'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
