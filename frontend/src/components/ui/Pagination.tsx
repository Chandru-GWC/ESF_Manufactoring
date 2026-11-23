import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  className,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-canvas-subtle border-t border-line-subtle text-xs text-ink-secondary',
        className
      )}
    >
      <div className="font-mono tabular-nums text-ink-muted">
        Showing <span className="font-semibold text-ink-primary">{startItem}</span> to{' '}
        <span className="font-semibold text-ink-primary">{endItem}</span> of{' '}
        <span className="font-semibold text-ink-primary">{totalItems.toLocaleString('en-IN')}</span> records
      </div>

      <div className="flex items-center space-x-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-md border border-line-default bg-canvas-surface text-ink-secondary hover:bg-canvas-muted hover:text-ink-primary disabled:opacity-40 disabled:cursor-not-allowed focus-ring transition-colors"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <span className="px-2.5 font-mono tabular-nums text-ink-primary font-medium">
          Page {currentPage} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-md border border-line-default bg-canvas-surface text-ink-secondary hover:bg-canvas-muted hover:text-ink-primary disabled:opacity-40 disabled:cursor-not-allowed focus-ring transition-colors"
          aria-label="Next Page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
