import React, { useEffect, useState } from 'react';
import { ArrowRight, BellRing, Clock, MapPin, ShieldCheck } from 'lucide-react';
import { ehsApi } from '../../services/api';
import { useAlerts } from '../../context/AlertContext';
import type { AlertActivityFeedItem, AlertSeverity, SafetyAlertItem } from '../../types/ehs';
import { AlertRow } from './AlertCenterDrawer';
import { SEVERITY_STYLE, STATUS_LABEL, relativeTime } from './alertUtils';

const ORDER: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

interface ActiveAlertsCardProps {
  /** Existing critical-hazards shortcut (navigates to the hazard register with filters). */
  criticalHazardCount?: number;
  onFilterCriticalHazards?: () => void;
}

export const ActiveAlertsCard: React.FC<ActiveAlertsCardProps> = ({ criticalHazardCount, onFilterCriticalHazards }) => {
  const { summary, version, openAlert, openAlertCenter } = useAlerts();
  const [top, setTop] = useState<SafetyAlertItem[] | null>(null);
  const [activity, setActivity] = useState<AlertActivityFeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([ehsApi.getAlerts({ active_only: true, limit: 4 }), ehsApi.getAlertActivity(5)])
      .then(([list, feed]) => {
        if (cancelled) return;
        setTop(list.items);
        setActivity(feed);
        setError(null);
      })
      .catch(e => {
        if (!cancelled) setError(e?.message || 'Unable to load alerts.');
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const loading = top === null && !error;
  const active = summary?.active ?? 0;
  const areas = (summary?.high_risk_areas ?? []).slice(0, 3);

  return (
    <section aria-label="Active safety alerts" className="rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle overflow-hidden">
      <div className="px-5 py-4 border-b border-line-subtle flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BellRing className="w-4 h-4 text-brand-orange" aria-hidden="true" />
          <h3 className="text-sm font-bold text-ink-primary">Active safety alerts</h3>
          <span className="font-mono text-[11px] text-ink-muted">{summary ? `${active} open` : ''}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ORDER.map(s => {
            const n = summary?.active_by_severity?.[s] ?? 0;
            return (
              <span
                key={s}
                title={`${SEVERITY_STYLE[s].label} alerts`}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-mono font-bold ${
                  n > 0 ? SEVERITY_STYLE[s].badge : 'bg-canvas-subtle text-ink-muted border-line-subtle'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_STYLE[s].dot}`} aria-hidden="true" />
                {SEVERITY_STYLE[s].label} {n}
              </span>
            );
          })}
        </div>
      </div>

      {summary && (summary.overdue > 0 || summary.unacknowledged_critical > 0) ? (
        <div className="px-5 py-2.5 border-b border-line-subtle bg-severity-high-bg/40 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {summary.unacknowledged_critical > 0 && (
            <span className="font-semibold text-severity-critical-text">{summary.unacknowledged_critical} critical not yet acknowledged</span>
          )}
          {summary.overdue > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-severity-high-text">
              <Clock className="w-3 h-3" aria-hidden="true" /> {summary.overdue} overdue
            </span>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-5">
        <div className="lg:col-span-3 lg:border-r border-line-subtle">
          {loading ? (
            <div className="p-5 space-y-3" aria-busy="true">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-14 rounded-lg bg-canvas-subtle animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div role="alert" className="m-5 p-3 rounded-lg border border-severity-critical-border bg-severity-critical-bg text-xs text-severity-critical-text">
              {error}
            </div>
          ) : top && top.length > 0 ? (
            <ul className="divide-y divide-line-subtle">
              {top.map(a => (
                <AlertRow key={a.alert_id} alert={a} onOpen={() => openAlert(a.alert_id)} />
              ))}
            </ul>
          ) : (
            <div className="py-10 px-5 flex items-center gap-3 text-xs text-ink-secondary">
              <ShieldCheck className="w-5 h-5 text-severity-success-dot shrink-0" aria-hidden="true" />
              <span>No active alerts. New alerts appear here when a detection or a critical event is raised.</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 p-5 space-y-4">
          {areas.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-secondary mb-2">Highest-risk areas</h4>
              <ul className="space-y-1.5">
                {areas.map(a => (
                  <li key={a.location} className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 min-w-0 text-ink-primary">
                      <MapPin className="w-3 h-3 text-ink-muted shrink-0" aria-hidden="true" />
                      <span className="truncate">{a.location}</span>
                    </span>
                    <span className="font-mono text-[11px] text-ink-secondary shrink-0">
                      {a.count}
                      {a.critical > 0 ? ` · ${a.critical} critical` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {activity.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-secondary mb-2">Recent alert activity</h4>
              <ul className="space-y-2">
                {activity.map((a, i) => (
                  <li key={i} className="text-xs">
                    <button type="button" onClick={() => openAlert(a.alert_id)} className="text-left w-full hover:underline focus-ring rounded">
                      <span className="font-semibold text-ink-primary">
                        {a.to_status ? STATUS_LABEL[a.to_status] : a.action.charAt(0) + a.action.slice(1).toLowerCase()}
                      </span>
                      <span className="text-ink-secondary"> · {a.alert_title}</span>
                      <span className="block text-[10px] font-mono text-ink-muted">{relativeTime(a.ts)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-line-subtle bg-canvas-subtle/60 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={openAlertCenter}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold transition-colors focus-ring"
        >
          View all alerts <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        {onFilterCriticalHazards && (criticalHazardCount ?? 0) > 0 && (
          <button
            type="button"
            onClick={onFilterCriticalHazards}
            className="text-xs font-semibold text-ink-secondary hover:text-ink-primary hover:underline focus-ring rounded"
          >
            {criticalHazardCount} critical hazards still open · Filter Critical Open
          </button>
        )}
      </div>
    </section>
  );
};
