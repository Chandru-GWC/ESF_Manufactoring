import React from 'react';
import type { AlertStatus } from '../../types/ehs';
import { STATUS_LABEL } from './alertUtils';

const TONE: Record<AlertStatus, string> = {
  NEW: 'bg-severity-info-bg text-severity-info-text border-severity-info-border',
  ACKNOWLEDGED: 'bg-canvas-subtle text-ink-primary border-line-default',
  UNDER_INVESTIGATION: 'bg-canvas-subtle text-ink-primary border-line-default',
  ACTION_REQUIRED: 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border',
  RESOLVED: 'bg-severity-success-bg text-severity-success-text border-severity-success-border',
  DISMISSED: 'bg-canvas-subtle text-ink-muted border-line-default',
};

export const AlertStatusBadge: React.FC<{ status: AlertStatus; className?: string }> = ({ status, className = '' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold ${TONE[status]} ${className}`}>
    {STATUS_LABEL[status] ?? status}
  </span>
);
