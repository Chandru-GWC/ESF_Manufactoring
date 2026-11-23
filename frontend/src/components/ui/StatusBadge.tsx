import React from 'react';
import { cn } from '../../lib/utils';

export type StatusType =
  | 'Open'
  | 'Under Investigation'
  | 'Mitigation In Progress'
  | 'Controlled'
  | 'Closed'
  | 'Passed'
  | 'Action Required'
  | 'Overdue'
  | 'In Progress'
  | 'Active'
  | 'Under Exception'
  | 'Pending Approval'
  | 'Suspended'
  | 'Compliant'
  | 'Expiring Soon'
  | 'Expired';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const normalized = status.trim().toLowerCase();

  const getStyle = () => {
    if (
      ['passed', 'controlled', 'closed', 'compliant', 'active', 'completed', 'current', 'matched'].includes(
        normalized
      )
    ) {
      return {
        wrapper: 'bg-severity-success-bg text-severity-success-text border-severity-success-border',
        dot: 'bg-severity-success-dot',
      };
    }
    if (['open', 'overdue', 'expired', 'under exception', 'absent', 'gap'].includes(normalized)) {
      return {
        wrapper: 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border',
        dot: 'bg-severity-critical-dot',
      };
    }
    if (
      [
        'mitigation in progress',
        'action required',
        'expiring soon',
        'under investigation',
        'pending approval',
        'in progress',
        'in_progress',
        'late',
      ].includes(normalized)
    ) {
      return {
        wrapper: 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border',
        dot: 'bg-severity-warning-dot',
      };
    }
    return {
      wrapper: 'bg-canvas-subtle text-ink-secondary border-line-default',
      dot: 'bg-ink-muted',
    };
  };

  const styles = getStyle();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap',
        styles.wrapper,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', styles.dot)} aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
};
