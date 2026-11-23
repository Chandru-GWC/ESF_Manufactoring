import React from 'react';
import type { AlertSeverity, AlertStatus } from '../../types/ehs';

const SEV_CLASS: Record<AlertSeverity, string> = {
  CRITICAL: 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border',
  HIGH: 'bg-severity-high-bg text-severity-high-text border-severity-high-border',
  MEDIUM: 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border',
  LOW: 'bg-canvas-subtle text-ink-secondary border-line-default',
};

export const AlertSeverityPill: React.FC<{ severity: AlertSeverity }> = ({ severity }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${SEV_CLASS[severity] ?? SEV_CLASS.LOW}`}>
    {severity}
  </span>
);

export const alertStatusLabel = (s: AlertStatus): string =>
  s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());

export const ESCALATION_BADGE = (level: number): string =>
  level >= 3 ? 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border'
  : level === 2 ? 'bg-severity-high-bg text-severity-high-text border-severity-high-border'
  : level === 1 ? 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border'
  : 'bg-canvas-subtle text-ink-secondary border-line-default';
