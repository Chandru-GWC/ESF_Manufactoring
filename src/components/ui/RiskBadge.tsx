import React from 'react';
import { cn } from '../../lib/utils';
import { SeverityLevel } from '../../types/ehs';

interface RiskBadgeProps {
  score?: number;
  severity?: SeverityLevel | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ score, severity, className }) => {
  const getRiskTier = () => {
    if (score !== undefined) {
      if (score >= 16) {
        return {
          label: `SCORE ${score} (CRIT)`,
          classes: 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border font-semibold',
        };
      }
      if (score >= 12) {
        return {
          label: `SCORE ${score} (HIGH)`,
          classes: 'bg-severity-high-bg text-severity-high-text border-severity-high-border font-semibold',
        };
      }
      if (score >= 8) {
        return {
          label: `SCORE ${score} (MED)`,
          classes: 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border font-medium',
        };
      }
      return {
        label: `SCORE ${score} (LOW)`,
        classes: 'bg-severity-success-bg text-severity-success-text border-severity-success-border font-medium',
      };
    }

    const s = (severity || 'LOW').toString().toUpperCase();
    switch (s) {
      case 'CRITICAL':
        return {
          label: 'CRITICAL',
          classes: 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border font-semibold',
        };
      case 'HIGH':
        return {
          label: 'HIGH',
          classes: 'bg-severity-high-bg text-severity-high-text border-severity-high-border font-semibold',
        };
      case 'MEDIUM':
      case 'WARNING':
        return {
          label: 'MEDIUM',
          classes: 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border font-medium',
        };
      case 'LOW':
      case 'SUCCESS':
      default:
        return {
          label: 'LOW',
          classes: 'bg-severity-success-bg text-severity-success-text border-severity-success-border font-medium',
        };
    }
  };

  const tier = getRiskTier();

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono tabular-nums border uppercase tracking-wider whitespace-nowrap',
        tier.classes,
        className
      )}
    >
      {tier.label}
    </span>
  );
};
