import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LoadingSkeleton } from './LoadingState';

export type KPIAccent = 'purple' | 'blue' | 'orange' | 'sky' | 'emerald' | 'rose' | 'amber';

// Restrained palette: neutral icon chips; only severity-like accents carry colour.
const ICON_BG: Record<KPIAccent, string> = {
  purple: 'bg-canvas-subtle text-ink-secondary',
  blue: 'bg-canvas-subtle text-ink-secondary',
  orange: 'bg-brand-peach-soft text-brand-orange',
  sky: 'bg-canvas-subtle text-ink-secondary',
  emerald: 'bg-canvas-subtle text-ink-secondary',
  rose: 'bg-severity-critical-bg text-severity-critical-text',
  amber: 'bg-severity-warning-bg text-severity-warning-text',
};

interface KPIStatCardProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  accent?: KPIAccent;
  delta?: {
    value: string;
    trend: 'up' | 'down' | 'neutral';
    isPositive: boolean;
  };
  footnote?: string;
  sourceTag?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  isLoading?: boolean;
  onClick?: () => void;
  className?: string;
}

export const KPIStatCard: React.FC<KPIStatCardProps> = ({
  label,
  value,
  unit,
  accent = 'purple',
  delta,
  footnote,
  sourceTag,
  icon: Icon,
  badge,
  isLoading = false,
  onClick,
  className,
}) => {
  const displayValue =
    value === null || value === undefined || value === '' ? '—' : value;

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'text-left w-full p-4 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle flex flex-col justify-between transition-all duration-150',
        onClick &&
          'cursor-pointer hover:border-line-default hover:shadow-elevated group focus-ring active:scale-[0.99]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary truncate">
          {label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          {Icon && (
            <div className={cn('p-1.5 rounded-lg', ICON_BG[accent])}>
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="my-2 space-y-2">
          <LoadingSkeleton className="h-7 w-24" />
          <LoadingSkeleton className="h-3 w-32" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold tracking-tight text-ink-primary font-mono tabular-nums">
              {displayValue}
            </span>
            {unit && (
              <span className="text-xs text-ink-muted font-mono font-medium">
                {unit}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] mt-2 pt-2 border-t border-line-subtle/70">
            {delta ? (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-semibold',
                  delta.isPositive
                    ? 'text-severity-success-text'
                    : delta.trend === 'neutral'
                    ? 'text-ink-secondary'
                    : 'text-severity-critical-text'
                )}
              >
                {delta.trend === 'up' && <ArrowUpRight className="w-3 h-3" aria-hidden="true" />}
                {delta.trend === 'down' && <ArrowDownRight className="w-3 h-3" aria-hidden="true" />}
                {delta.trend === 'neutral' && <Minus className="w-3 h-3" aria-hidden="true" />}
                <span>{delta.value}</span>
              </span>
            ) : footnote ? (
              <span className="text-ink-muted truncate flex items-center gap-1">
                <span>{footnote}</span>
                {onClick && (
                  <ArrowRight className="w-3 h-3 text-ink-muted group-hover:translate-x-0.5 transition-transform shrink-0" />
                )}
              </span>
            ) : (
              <span />
            )}

            {sourceTag && (
              <span className="font-mono text-[10px] text-ink-muted font-semibold shrink-0">
                {sourceTag}
              </span>
            )}
          </div>
        </>
      )}
    </Component>
  );
};
