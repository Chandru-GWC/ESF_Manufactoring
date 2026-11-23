import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Clock, Info, Users } from 'lucide-react';
import { DetailDrawer } from '../ui/DetailDrawer';
import { CleanVideo } from '../ui/CleanVideo';
import { LoadingSkeleton } from '../ui/LoadingState';
import { ehsApi, mediaUrl } from '../../services/api';
import { useAlerts } from '../../context/AlertContext';
import type { AlertStatus, SafetyAlertDetail } from '../../types/ehs';
import { AlertSeverityBadge } from './AlertSeverityBadge';
import { AlertStatusBadge } from './AlertStatusBadge';
import { ACTION_LABEL, STATUS_LABEL, formatTime, notificationKindLabel } from './alertUtils';

type Action = Exclude<AlertStatus, 'NEW'>;

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="space-y-2">
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-secondary">{title}</h3>
      {hint && <span className="text-[10px] text-ink-muted">{hint}</span>}
    </div>
    {children}
  </section>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-line-subtle last:border-b-0 text-xs">
    <span className="text-ink-muted shrink-0">{label}</span>
    <span className="text-ink-primary text-right min-w-0 break-words">{children}</span>
  </div>
);

const GuidanceItem: React.FC<{ label: string; text: string | null }> = ({ label, text }) =>
  text ? (
    <div className="space-y-0.5">
      <div className="text-[11px] font-semibold text-ink-primary">{label}</div>
      <p className="text-xs text-ink-secondary leading-relaxed">{text}</p>
    </div>
  ) : null;

export const AlertDetailPanel: React.FC = () => {
  const { openAlertId, closeAlert, refresh } = useAlerts();
  const [alert, setAlert] = useState<SafetyAlertDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      setAlert(await ehsApi.getAlert(id));
    } catch (e: any) {
      setAlert(null);
      setLoadError(e?.message || 'Unable to load this alert.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPending(null);
    setNote('');
    setActionError(null);
    if (openAlertId) load(openAlertId);
    else setAlert(null);
  }, [openAlertId, load]);

  const noteRule = (s: Action): { required: boolean; min: number } =>
    s === 'DISMISSED' ? { required: true, min: 5 } : s === 'RESOLVED' ? { required: true, min: 3 } : { required: false, min: 0 };

  const submit = async () => {
    if (!alert || !pending) return;
    const rule = noteRule(pending);
    if (rule.required && note.trim().length < rule.min) {
      setActionError(
        pending === 'DISMISSED'
          ? 'Enter a reason of at least 5 characters to dismiss this alert.'
          : 'Enter a short resolution note to resolve this alert.'
      );
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const updated = await ehsApi.transitionAlert(alert.alert_id, pending, note.trim() || undefined);
      setAlert(updated);
      setPending(null);
      setNote('');
      await refresh();
    } catch (e: any) {
      setActionError(e?.message || 'The status change was not saved.');
    } finally {
      setBusy(false);
    }
  };

  const latestEscalation = alert?.notifications
    .filter(n => n.kind === 'ESCALATION' || n.kind === 'REMINDER')
    .sort((a, b) => b.level - a.level)[0];

  const ev = alert?.evidence ?? {};
  const hasImage = Boolean(ev.image_url);
  const hasVideo = Boolean(ev.video_url);

  return (
    <DetailDrawer
      isOpen={Boolean(openAlertId)}
      onClose={closeAlert}
      width="xl"
      title={alert?.alert_id ?? openAlertId ?? 'Alert'}
      subtitle={alert ? undefined : undefined}
      badge={
        alert ? (
          <>
            <AlertSeverityBadge severity={alert.severity} />
            <AlertStatusBadge status={alert.status} />
          </>
        ) : undefined
      }
    >
      {loading && !alert ? (
        <LoadingSkeleton count={5} className="h-16" />
      ) : loadError ? (
        <div role="alert" className="p-3 rounded-lg border border-severity-critical-border bg-severity-critical-bg text-xs text-severity-critical-text">
          {loadError}
        </div>
      ) : alert ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-ink-primary leading-snug">{alert.title}</h2>
            {(alert.overdue || alert.escalation_level > 0) && alert.is_active && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {alert.overdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-severity-high-bg text-severity-high-text border border-severity-high-border text-[11px] font-semibold">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {alert.response_overdue ? 'Not acknowledged in time' : 'Past its resolution target'}
                  </span>
                )}
                {alert.escalation_level > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-canvas-subtle text-ink-primary border border-line-default text-[11px] font-semibold">
                    <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                    Escalation level {alert.escalation_level}
                    {latestEscalation?.recipient ? ` · ${latestEscalation.recipient}` : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          <Section title="What happened" hint="Detected facts">
            <ul className="space-y-1.5">
              {(alert.facts.length ? alert.facts : [alert.description]).map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-ink-primary leading-relaxed">
                  <CheckCircle2 className="w-3.5 h-3.5 text-ink-muted shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Where and when">
            <div className="rounded-lg border border-line-subtle bg-canvas-subtle px-3 py-1">
              <Row label="Plant">{alert.plant_id === 'ALL' ? 'Not specified' : alert.plant_id}</Row>
              <Row label="Location">{alert.location || '—'}</Row>
              <Row label="Detected">{formatTime(alert.detected_at)}</Row>
              <Row label="Category">{alert.category}</Row>
            </div>
          </Section>

          <Section title="Evidence">
            {hasImage || hasVideo ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {hasVideo && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Annotated video</span>
                    <CleanVideo src={mediaUrl(ev.video_url as string)} label={`Annotated evidence for ${alert.alert_id}`} fit="contain" />
                  </div>
                )}
                {hasImage && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Evidence frame</span>
                    <div className="rounded-lg border border-line-subtle overflow-hidden aspect-video bg-slate-950">
                      <img src={mediaUrl(ev.image_url as string)} alt={`Evidence frame for ${alert.alert_id}`} className="wm-crop w-full h-full object-cover" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="flex items-start gap-2 text-xs text-ink-secondary">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
                {ev.note || 'No image or video is attached to this alert.'}
              </p>
            )}
            {ev.source_video && (
              <p className="text-[11px] font-mono text-ink-muted">
                Source clip: {ev.source_video}
                {typeof ev.timestamp_sec === 'number' ? ` · ${ev.timestamp_sec.toFixed(2)}s` : ''}
              </p>
            )}
          </Section>

          <Section title="Why it was flagged">
            <div className="rounded-lg border border-line-subtle bg-canvas-subtle px-3 py-1">
              <Row label="Detected by">{alert.detection_source}</Row>
              <Row label="Confidence">
                {alert.confidence !== null ? `${(alert.confidence * 100).toFixed(1)}%` : alert.confidence_note || 'Not reported'}
              </Row>
              <Row label="Source">{alert.source_type.replace(/_/g, ' ')} · {alert.source_ref}</Row>
            </div>
          </Section>

          <Section title="Guidance for the safety officer" hint={alert.guidance.label}>
            <div className="rounded-lg border border-severity-high-border/60 bg-brand-peach-soft/40 p-3.5 space-y-3">
              <GuidanceItem label="Why this is dangerous" text={alert.guidance.why_dangerous} />
              <GuidanceItem label="What could happen if it is not addressed" text={alert.guidance.consequences} />
              <GuidanceItem label="What to do now" text={alert.guidance.immediate_action} />
              <GuidanceItem label="Recommended corrective action" text={alert.guidance.corrective_action} />
            </div>
          </Section>

          <Section title="Responsibility and deadlines">
            <div className="rounded-lg border border-line-subtle bg-canvas-subtle px-3 py-1">
              <Row label="Responsible team">
                <span className="inline-flex items-center gap-1"><Users className="w-3 h-3 text-ink-muted" aria-hidden="true" />{alert.responsible_team || 'Not configured'}</span>
              </Row>
              {alert.responsible_person && <Row label="Action owner">{alert.responsible_person}</Row>}
              <Row label="Acknowledge by">
                {formatTime(alert.response_due_at)}
                {alert.response_overdue && <span className="ml-1.5 text-severity-high-text font-semibold">Overdue</span>}
              </Row>
              <Row label="Resolve by">
                {formatTime(alert.resolution_due_at)}
                {alert.resolution_overdue && <span className="ml-1.5 text-severity-high-text font-semibold">Overdue</span>}
              </Row>
              <Row label="Escalation">
                {alert.escalation_level > 0
                  ? `Level ${alert.escalation_level}${latestEscalation?.recipient ? ` · ${latestEscalation.recipient}` : ''}`
                  : 'Not escalated'}
              </Row>
            </div>
          </Section>

          <Section title="Workflow">
            {!alert.is_active ? (
              <div className="rounded-lg border border-line-subtle bg-canvas-subtle p-3 text-xs space-y-1">
                <div className="font-semibold text-ink-primary">
                  {STATUS_LABEL[alert.status]} {alert.resolved_at ? formatTime(alert.resolved_at) : formatTime(alert.dismissed_at)}
                </div>
                {alert.dismissal_reason && <p className="text-ink-secondary">Reason: {alert.dismissal_reason}</p>}
                {alert.status === 'RESOLVED' && (
                  <p className="text-ink-secondary">
                    {alert.activity.filter(a => a.to_status === 'RESOLVED').slice(-1)[0]?.note || ''}
                  </p>
                )}
                <p className="text-ink-muted">This alert is closed and can no longer be changed.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {alert.next_statuses.map(s => {
                    const a = s as Action;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setPending(a);
                          setActionError(null);
                        }}
                        aria-pressed={pending === a}
                        className={`px-3 h-9 rounded-lg border text-xs font-semibold transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed ${
                          pending === a
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-canvas-surface text-ink-primary border-line-default hover:bg-canvas-subtle'
                        }`}
                      >
                        {ACTION_LABEL[a]}
                      </button>
                    );
                  })}
                </div>
                {pending && (
                  <div className="space-y-2 rounded-lg border border-line-subtle p-3">
                    <label htmlFor="alert-note" className="text-xs font-semibold text-ink-primary">
                      {pending === 'DISMISSED'
                        ? 'Reason for dismissing (required)'
                        : pending === 'RESOLVED'
                        ? 'Resolution note (required)'
                        : 'Note (optional)'}
                    </label>
                    <textarea
                      id="alert-note"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-line-default bg-canvas-surface text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      placeholder={pending === 'DISMISSED' ? 'e.g. False positive: reflection on a wet floor' : 'Add context for the safety team'}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={submit}
                        disabled={busy}
                        className="px-3 h-9 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold disabled:opacity-60 focus-ring"
                      >
                        {busy ? 'Saving…' : `Confirm: ${ACTION_LABEL[pending]}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPending(null);
                          setNote('');
                          setActionError(null);
                        }}
                        className="px-3 h-9 rounded-lg border border-line-default bg-canvas-surface text-xs font-semibold text-ink-primary hover:bg-canvas-subtle focus-ring"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {actionError && (
                  <div role="alert" className="p-2.5 rounded-lg border border-severity-critical-border bg-severity-critical-bg text-xs text-severity-critical-text">
                    {actionError}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title="Activity history">
            <ol className="space-y-3 border-l border-line-default pl-4 ml-1">
              {alert.activity.map((a, i) => (
                <li key={i} className="relative text-xs">
                  <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-canvas-surface border-2 border-line-strong" aria-hidden="true" />
                  <div className="font-semibold text-ink-primary">
                    {a.action === 'STATUS_CHANGED' && a.to_status
                      ? `${a.from_status ? STATUS_LABEL[a.from_status] + ' → ' : ''}${STATUS_LABEL[a.to_status]}`
                      : a.action.charAt(0) + a.action.slice(1).toLowerCase().replace(/_/g, ' ')}
                  </div>
                  {a.note && <p className="text-ink-secondary leading-relaxed">{a.note}</p>}
                  <div className="text-[10px] font-mono text-ink-muted">
                    {a.actor} · {formatTime(a.ts)}
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Notification history">
            {alert.notifications.length === 0 ? (
              <p className="text-xs text-ink-muted">No notifications sent yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {alert.notifications.map(n => (
                  <li key={n.notification_id} className="flex items-start gap-2 text-xs">
                    <Bell className="w-3.5 h-3.5 text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <span className="font-semibold text-ink-primary">{notificationKindLabel(n.kind, n.level)}</span>
                      {n.recipient ? <span className="text-ink-secondary"> · to {n.recipient}</span> : null}
                      <div className="text-[10px] font-mono text-ink-muted">
                        {formatTime(n.created_at)} · {n.channel.replace('_', '-')}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-ink-muted">{alert.delivery_note}</p>
          </Section>
        </div>
      ) : null}
    </DetailDrawer>
  );
};
