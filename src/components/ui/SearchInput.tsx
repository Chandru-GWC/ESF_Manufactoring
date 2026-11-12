import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChangeValue: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeValue,
  placeholder = 'Search records by ID, equipment, location...',
  className,
  ...props
}) => {
  return (
    <div className={cn('relative flex items-center w-full max-w-sm', className)}>
      <Search className="absolute left-3 w-4 h-4 text-ink-muted pointer-events-none" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={e => onChangeValue(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-8 text-xs bg-canvas-subtle text-ink-primary placeholder:text-ink-muted border border-line-default rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-purple focus:border-transparent transition-colors"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChangeValue('')}
          className="absolute right-2.5 p-0.5 text-ink-muted hover:text-ink-primary rounded"
          aria-label="Clear search input"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
