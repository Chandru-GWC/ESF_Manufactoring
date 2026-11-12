import React from 'react';
import { Breadcrumb, BreadcrumbItem } from './Breadcrumb';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs = [{ label: 'EHS Operations' }, { label: title, active: true }],
  actions,
  meta,
  className,
}) => {
  return (
    <div className={cn('pb-4 border-b border-line-subtle', className)}>
      <Breadcrumb items={breadcrumbs} className="mb-2" />
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink-primary">
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="mt-1 text-xs text-ink-secondary max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
