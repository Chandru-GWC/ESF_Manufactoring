import React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DateRangeFilterProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  value,
  onChange,
  className,
}) => {
  const ranges = [
    { value: '7D', label: 'Last 7 Days' },
    { value: '30D', label: 'Last 30 Days' },
    { value: '90D', label: 'Quarter to Date' },
    { value: 'YTD', label: 'Year to Date' },
  ];

  return (
    <div className={cn('inline-flex items-center gap-1 bg-white p-1 rounded-md border border-slate-300 shadow-sm-subtle', className)}>
      <span className="flex items-center gap-1 px-2 text-xs text-slate-500 font-medium border-r border-slate-200">
        <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
        <span>Window</span>
      </span>
      <div className="flex items-center space-x-0.5">
        {ranges.map((r) => {
          const isActive = value === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange(r.value)}
              className={cn(
                'px-2.5 py-1 text-xs rounded transition-colors font-medium',
                isActive
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

