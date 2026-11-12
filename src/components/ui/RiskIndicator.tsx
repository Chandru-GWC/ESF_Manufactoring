import React from 'react';
import { OctagonAlert, TriangleAlert, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { SeverityLevel } from '../../types/ehs';
import { cn } from '../../lib/utils';

interface RiskIndicatorProps {
  level?: SeverityLevel | string;
  showIcon?: boolean;
  className?: string;
}

export const RiskIndicator: React.FC<RiskIndicatorProps> = ({
  level = 'info',
  showIcon = true,
  className,
}) => {
  const normalized = String(level).toLowerCase();

  const config = (() => {
    if (normalized === 'critical') {
      return {
        label: 'CRITICAL',
        icon: OctagonAlert,
        classes: 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border',
      };
    }
    if (normalized === 'high') {
      return {
        label: 'HIGH',
        icon: TriangleAlert,
        classes: 'bg-severity-high-bg text-severity-high-text border-severity-high-border',
      };
    }
    if (normalized === 'warning' || normalized === 'medium') {
      return {
        label: 'MEDIUM',
        icon: AlertCircle,
        classes: 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border',
      };
    }
    if (normalized === 'success' || normalized === 'low') {
      return {
        label: 'LOW',
        icon: CheckCircle2,
        classes: 'bg-severity-success-bg text-severity-success-text border-severity-success-border',
      };
    }
    return {
      label: String(level).toUpperCase(),
      icon: Info,
      classes: 'bg-severity-info-bg text-severity-info-text border-severity-info-border',
    };
  })();

  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold border tracking-wider uppercase tabular-nums whitespace-nowrap',
        config.classes,
        className
      )}
      role="status"
      aria-label={`Severity: ${config.label}`}
    >
      {showIcon && <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
};

