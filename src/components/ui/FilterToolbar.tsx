import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterSelectConfig {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

interface FilterToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterSelectConfig[];
  totalRecords: number;
  filteredCount: number;
  onResetFilters?: () => void;
  className?: string;
  actions?: React.ReactNode;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search records by keyword, ID, location...',
  filters = [],
  totalRecords,
  filteredCount,
  onResetFilters,
  className,
  actions,
}) => {
  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    filters.some(f => f.value !== 'ALL' && f.value !== '');

  return (
    <div
      className={cn(
        'p-3 rounded-xl border border-line-subtle bg-canvas-surface shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3',
        className
      )}
    >
      {/* Left: Search & Select Dropdowns */}
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {/* Search Bar */}
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-line-subtle bg-canvas-subtle text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary"
              aria-label="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        {filters.map(filter => (
          <div key={filter.id} className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-ink-muted uppercase tracking-wider hidden sm:inline">
              {filter.label}:
            </span>
            <select
              value={filter.value}
              onChange={e => filter.onChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-line-subtle bg-canvas-subtle text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-purple transition-all"
            >
              {filter.options.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* Clear Filters Button */}
        {hasActiveFilters && onResetFilters && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-brand-orange hover:text-brand-orange/80 hover:bg-brand-peach-soft rounded-lg transition-colors font-medium"
            title="Reset active filters"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Right: Record count telemetry and extra actions */}
      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-line-subtle">
        <span className="text-xs font-mono text-ink-secondary">
          Showing <span className="font-bold text-ink-primary">{filteredCount}</span> of{' '}
          <span className="font-medium text-ink-muted">{totalRecords}</span> records
        </span>
        {actions}
      </div>
    </div>
  );
};

