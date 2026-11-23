import React from 'react';
import type { AlertSeverity } from '../../types/ehs';
import { SEVERITY_STYLE } from './alertUtils';

export const AlertSeverityBadge: React.FC<{ severity: AlertSeverity; className?: string }> = ({ severity, className = '' }) => {
  const s = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.LOW;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wide ${s.badge} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
};
