import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, Search, X } from 'lucide-react';
import { ehsApi } from '../../services/api';
import { useAlerts } from '../../context/AlertContext';
import { useEhs } from '../../context/EhsContext';
import type { AlertSeverity, SafetyAlertItem } from '../../types/ehs';
import { AlertSeverityBadge } from './AlertSeverityBadge';
import { AlertStatusBadge } from './AlertStatusBadge';
import { SEVERITY_STYLE, formatTime } from './alertUtils';

const PAGE = 25;
const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: 'ACTIVE', label: 'Active' },
  { id: 'ALL', label: 'All' },
  { id: 'RESOLVED', label: 'Resolved' },
  { id: 'DISMISSED', label: 'Dismissed' },
];
const SEVERITIES: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export const AlertRow: React.FC<{ alert: SafetyAlertItem; onOpen: () => void }> = ({ alert, onOpen }) => (
  <li>
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-stretch gap-3 px-4 py-3 hover:bg-canvas-subtle transition-colors focus-ring"
    >
      <span className={`w-1 rounded-full shrink-0 ${SEVERITY_STYLE[alert.severity].bar}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <AlertSeverityBadge severity={alert.severity} />
          <AlertStatusBadge status={alert.status} />
          {alert.overdue && alert.is_active && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-severity-high-text">
              <Clock className="w-3 h-3" aria-hidden="true" /> Overdue
            </span>
          )}
          {alert.escalation_level > 0 && alert.is_active && (
            <span className="text-[10px] font-mono font-semibold text-ink-secondary">L{alert.escalation_level}</span>
          )}
        </span>
        <span className="block text-sm font-semibold text-ink-primary leading-snug">{alert.title}</span>
        <span className="block text-[11px] text-ink-secondary truncate">
          {alert.location || alert.plant_id}
          {alert.plant_id !== 'ALL' && alert.location && !alert.location.includes(alert.plant_id) ? ` · ${alert.plant_id}` : ''}
        </span>
        <span className="block text-[10px] font-mono text-ink-muted">
          {alert.alert_id} · {formatTime(alert.detected_at)}
        </span>
      </span>
    </button>
  </li>
);

export const AlertCenterDrawer: React.FC = () => {
  const { alertCenterOpen, closeAlertCenter, openAlert, openAlertId, version } = useAlerts();
  const { facilityId } = useEhs();
  const [status, setStatus] = useState('ACTIVE');
  const [severity, setSeverity] = useState<'ALL' | AlertSeverity>('ALL');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [items, setItems] = useState<SafetyAlertItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => setLimit(PAGE), [status, severity, debouncedQ, facilityId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ehsApi.getAlerts({
        active_only: status === 'ACTIVE' ? true : undefined,
        status: status === 'RESOLVED' || status === 'DISMISSED' ? status : undefined,
        severity: severity === 'ALL' ? undefined : severity,
        plant_id: facilityId,
        q: debouncedQ || undefined,
        limit,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e: any) {
      setError(e?.message || 'Unable to load alerts.');
    } finally {
      setLoading(false);
    }
  }, [status, severity, facilityId, debouncedQ, limit]);

  useEffect(() => {
    if (alertCenterOpen) load();
  }, [alertCenterOpen, load, version]);

  // Escape closes this drawer only when the detail panel is not on top of it.
  useEffect(() => {
    if (!alertCenterOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !openAlertId) closeAlertCenter();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [alertCenterOpen, openAlertId, closeAlertCenter]);

  const chip = (active: boolean) =>
    `px-2.5 h-8 rounded-md border text-xs font-semibold transition-colors focus-ring ${
      active ? 'bg-brand-primary text-white border-brand-primary' : 'bg-canvas-subtle text-ink-secondary border-line-subtle hover:text-ink-primary'
    }`;

  return (
    <AnimatePresence>
      {alertCenterOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="absolute inset-0 bg-black/55"
            onClick={closeAlertCenter}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 flex max-w-full">
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-screen max-w-xl bg-canvas-surface border-l border-line-subtle shadow-modal flex flex-col text-ink-primary"
              role="dialog"
              aria-modal="true"
              aria-label="Safety alerts"
            >
              <div className="px-5 py-4 border-b border-line-subtle bg-canvas-subtle flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">Safety alerts</h2>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {loading && !items.length ? 'Loading…' : `${total} ${total === 1 ? 'alert' : 'alerts'}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAlertCenter}
                  className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-canvas-muted focus-ring"
                  aria-label="Close alerts"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-3 border-b border-line-subtle space-y-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="search"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Search by title, location or alert ID"
                    aria-label="Search alerts"
                    className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-line-default bg-canvas-subtle placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-canvas-surface"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status filter">
                  {STATUS_FILTERS.map(f => (
                    <button key={f.id} type="button" onClick={() => setStatus(f.id)} aria-pressed={status === f.id} className={chip(status === f.id)}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Severity filter">
                  <button type="button" onClick={() => setSeverity('ALL')} aria-pressed={severity === 'ALL'} className={chip(severity === 'ALL')}>
                    Any severity
                  </button>
                  {SEVERITIES.map(s => (
                    <button key={s} type="button" onClick={() => setSeverity(s)} aria-pressed={severity === s} className={chip(severity === s)}>
                      {SEVERITY_STYLE[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {error ? (
                  <div role="alert" className="m-5 p-3 rounded-lg border border-severity-critical-border bg-severity-critical-bg text-xs text-severity-critical-text">
                    {error}
                  </div>
                ) : items.length === 0 && !loading ? (
                  <div className="py-16 text-center text-xs text-ink-muted">No alerts match these filters.</div>
                ) : (
                  <ul className="divide-y divide-line-subtle">
                    {items.map(a => (
                      <AlertRow key={a.alert_id} alert={a} onOpen={() => openAlert(a.alert_id)} />
                    ))}
                  </ul>
                )}
                {items.length < total && (
                  <div className="p-4 text-center">
                    <button
                      type="button"
                      onClick={() => setLimit(l => l + PAGE)}
                      className="px-4 h-9 rounded-lg border border-line-default bg-canvas-surface text-xs font-semibold hover:bg-canvas-subtle focus-ring"
                    >
                      Show more ({total - items.length} remaining)
                    </button>
                  </div>
                )}
              </div>
            </motion.aside>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
