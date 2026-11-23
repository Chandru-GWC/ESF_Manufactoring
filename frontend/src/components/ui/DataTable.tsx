import React, { useState, useMemo, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { Pagination } from './Pagination';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
  pageSize?: number;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching the selected filters or search query.',
  sortColumn: controlledSortCol,
  sortDirection: controlledSortDir,
  onSort: controlledOnSort,
  pageSize = 25,
  className,
}: DataTableProps<T>) {
  const [internalSortCol, setInternalSortCol] = useState<string | undefined>(undefined);
  const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const sortCol = controlledSortCol ?? internalSortCol;
  const sortDir = controlledSortDir ?? internalSortDir;

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  const handleSort = (key: string) => {
    if (controlledOnSort) {
      controlledOnSort(key);
      return;
    }
    if (internalSortCol === key) {
      setInternalSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setInternalSortCol(key);
      setInternalSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortCol || controlledOnSort) return data;
    const colDef = columns.find(c => c.key === sortCol);
    return [...data].sort((a, b) => {
      const aVal = colDef?.sortValue ? colDef.sortValue(a) : (a as Record<string, unknown>)[sortCol];
      const bVal = colDef?.sortValue ? colDef.sortValue(b) : (b as Record<string, unknown>)[sortCol];
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortCol, sortDir, columns, controlledOnSort]);

  const paginatedData = useMemo(() => {
    if (pageSize <= 0) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  if (isLoading) {
    return <LoadingState rows={6} />;
  }

  if (data.length === 0) {
    return (
      <div className="bg-canvas-surface border border-line-subtle rounded-xl p-6">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full border border-line-subtle rounded-2xl bg-canvas-surface shadow-sm-subtle overflow-hidden',
        className
      )}
    >
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line-subtle bg-canvas-subtle text-[11px] font-semibold text-ink-secondary uppercase tracking-wider sticky top-0 z-10">
              {columns.map(col => {
                const isSorted = sortCol === col.key;
                const isRight = col.align === 'right';
                const isCenter = col.align === 'center';

                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width }}
                    className={cn(
                      'py-3 px-4 select-none whitespace-nowrap',
                      isRight && 'text-right',
                      isCenter && 'text-center',
                      !isRight && !isCenter && 'text-left',
                      col.sortable && 'cursor-pointer hover:text-ink-primary transition-colors'
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div
                      className={cn(
                        'inline-flex items-center gap-1',
                        isRight && 'justify-end w-full'
                      )}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="flex flex-col text-ink-muted">
                          {isSorted && sortDir === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-brand-purple" />
                          ) : isSorted && sortDir === 'desc' ? (
                            <ChevronDown className="w-3.5 h-3.5 text-brand-purple" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 opacity-35" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle bg-canvas-surface">
            {paginatedData.map(row => {
              const rowKey = keyExtractor(row);
              return (
                <tr
                  key={rowKey}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={e => {
                    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={cn(
                    'transition-colors duration-100',
                    onRowClick
                      ? 'hover:bg-brand-purple-soft/35 cursor-pointer focus-ring'
                      : 'hover:bg-canvas-subtle/60'
                  )}
                >
                  {columns.map(col => {
                    const isRight = col.align === 'right';
                    const isCenter = col.align === 'center';
                    const content = col.render
                      ? col.render(row)
                      : (row as Record<string, unknown>)[col.key] != null
                      ? String((row as Record<string, unknown>)[col.key])
                      : '—';

                    return (
                      <td
                        key={col.key}
                        className={cn(
                          'py-3 px-4 text-ink-primary whitespace-nowrap',
                          isRight && 'text-right font-mono tabular-nums',
                          isCenter && 'text-center',
                          !isRight && !isCenter && 'text-left'
                        )}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageSize > 0 && sortedData.length > pageSize && (
        <Pagination
          currentPage={currentPage}
          totalItems={sortedData.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
