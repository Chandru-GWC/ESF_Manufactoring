import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className }) => {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center text-xs text-ink-muted', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <span className="flex items-center text-ink-muted">
            <Home className="w-3.5 h-3.5 mr-1 shrink-0" aria-hidden="true" />
            <span>EHS Platform</span>
          </span>
        </li>

        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            <ChevronRight className="w-3 h-3 text-ink-disabled shrink-0" aria-hidden="true" />
            {item.onClick && !item.active ? (
              <button
                type="button"
                onClick={item.onClick}
                className="text-ink-secondary hover:text-ink-primary transition-colors font-medium focus-ring rounded px-0.5"
              >
                {item.label}
              </button>
            ) : (
              <span
                className={cn(
                  item.active
                    ? 'text-brand-purple font-semibold'
                    : 'text-ink-secondary font-medium'
                )}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
