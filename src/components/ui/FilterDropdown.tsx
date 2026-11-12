import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  className?: string;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  value,
  options,
  onChange,
  className,
}) => {
  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <label htmlFor={`filter-${label}`} className="sr-only">
        Filter by {label}
      </label>
      <select
        id={`filter-${label}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none h-9 pl-3 pr-8 text-xs font-medium bg-canvas-surface text-ink-primary border border-line-default rounded-lg hover:bg-canvas-subtle focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent transition-colors cursor-pointer shadow-sm-subtle"
      >
        <option value="ALL">All {label}s</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 w-3.5 h-3.5 text-ink-muted pointer-events-none" aria-hidden="true" />
    </div>
  );
};
