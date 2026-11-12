import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Telemetry Unavailable',
  message,
  onRetry,
  className,
}) => {
  return (
    <div
      role="alert"
      className={cn(
        'p-5 rounded-xl border border-severity-critical-border bg-severity-critical-bg/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-severity-critical-bg border border-severity-critical-border text-severity-critical-text shrink-0">
          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-severity-critical-text">
            {title}
          </h3>
          <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-canvas-surface border border-line-default text-ink-primary hover:bg-canvas-muted transition-colors shrink-0 focus-ring"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
};

