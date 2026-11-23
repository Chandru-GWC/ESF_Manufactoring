import React from 'react';
import { AlertOctagon, ArrowRight, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AlertPanelProps {
  title: string;
  count: number;
  message: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  title,
  count,
  message,
  actionText = 'View Active Mitigations',
  onAction,
  className,
}) => {
  if (count === 0) {
    return (
      <div
        className={cn(
          'p-3.5 rounded-xl border border-severity-success-border bg-severity-success-bg/60 flex items-center justify-between',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-full bg-severity-success-bg text-severity-success-text border border-severity-success-border">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-severity-success-text">All Operations Clear</h4>
            <p className="text-[11px] text-ink-secondary">
              Zero critical life-safety deviations flagged in active scope.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-4 rounded-xl border border-severity-critical-border bg-severity-critical-bg/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm-subtle',
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-severity-critical-bg text-severity-critical-text border border-severity-critical-border shrink-0 mt-0.5">
          <AlertOctagon className="w-4 h-4" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-bold text-severity-critical-text uppercase tracking-wide">
              {title}
            </h4>
            <span className="px-1.5 py-0.5 rounded bg-severity-critical-bg border border-severity-critical-border text-severity-critical-text font-mono text-[10px] font-bold tabular-nums">
              {count} CRITICAL
            </span>
          </div>
          <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">{message}</p>
        </div>
      </div>

      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shrink-0 transition-colors focus-ring"
        >
          <span>{actionText}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
