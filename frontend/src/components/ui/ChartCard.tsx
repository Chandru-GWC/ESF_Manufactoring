import React from 'react';
import { cn } from '../../lib/utils';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  actions,
  children,
  footer,
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-canvas-surface border border-line-subtle rounded-xl shadow-sm-subtle flex flex-col',
        className
      )}
    >
      <div className="flex items-start justify-between p-4 pb-3 border-b border-line-subtle">
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
          {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <div className="p-4 flex-1">{children}</div>

      {footer && (
        <div className="px-4 py-2.5 bg-canvas-subtle border-t border-line-subtle text-xs text-ink-muted">
          {footer}
        </div>
      )}
    </div>
  );
};
