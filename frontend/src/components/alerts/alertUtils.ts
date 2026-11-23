import type { AlertSeverity, AlertStatus } from '../../types/ehs';

/** Severity colour tokens: red only for CRITICAL, orange HIGH, amber MEDIUM, neutral LOW. */
export const SEVERITY_STYLE: Record<AlertSeverity, { badge: string; bar: string; dot: string; label: string }> = {
  CRITICAL: {
    badge: 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border',
    bar: 'bg-severity-critical-dot',
    dot: 'bg-severity-critical-dot',
    label: 'Critical',
  },
  HIGH: {
    badge: 'bg-severity-high-bg text-severity-high-text border-severity-high-border',
    bar: 'bg-severity-high-dot',
    dot: 'bg-severity-high-dot',
    label: 'High',
  },
  MEDIUM: {
    badge: 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border',
    bar: 'bg-severity-warning-dot',
    dot: 'bg-severity-warning-dot',
    label: 'Medium',
  },
  LOW: {
    badge: 'bg-canvas-subtle text-ink-secondary border-line-default',
    bar: 'bg-ink-muted',
    dot: 'bg-ink-muted',
    label: 'Low',
  },
};

export const STATUS_LABEL: Record<AlertStatus, string> = {
  NEW: 'New',
  ACKNOWLEDGED: 'Acknowledged',
  UNDER_INVESTIGATION: 'Under investigation',
  ACTION_REQUIRED: 'Action required',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

export const ACTION_LABEL: Record<Exclude<AlertStatus, 'NEW'>, string> = {
  ACKNOWLEDGED: 'Acknowledge',
  UNDER_INVESTIGATION: 'Start investigation',
  ACTION_REQUIRED: 'Mark action required',
  RESOLVED: 'Resolve',
  DISMISSED: 'Dismiss',
};

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  // Server timestamps are naive UTC.
  const t = new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime();
  if (Number.isNaN(t)) return '—';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return `${Math.floor(sec / 86400)} d ago`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function notificationKindLabel(kind: string, level: number): string {
  if (kind === 'ESCALATION') return `Escalation L${level}`;
  if (kind === 'REMINDER') return `Reminder L${level || 1}`;
  if (kind === 'CAPA_OVERDUE') return 'CAPA overdue';
  return 'Alert';
}
