import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-10 text-center border border-dashed border-line-default rounded-xl bg-canvas-subtle/70',
        className
      )}
    >
      <div className="w-10 h-10 rounded-full bg-canvas-surface flex items-center justify-center mb-3 text-ink-muted border border-line-subtle shadow-xs">
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-ink-primary mb-1">{title}</h3>
      <p className="text-xs text-ink-secondary max-w-md mb-4 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-brand-purple hover:bg-brand-hover rounded-lg transition-colors shadow-xs focus-ring"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
