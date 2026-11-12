import React, { useState, useMemo } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LoadingSkeleton } from './LoadingState';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export interface ChartDatum {
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
  meta?: string;
}

export interface TrackerSegment {
  id: string;
  status: 'success' | 'warning' | 'critical' | 'info' | 'neutral';
  tooltip: string;
}

export type AnalyticsChartVariant =
  | 'area'
  | 'bar-horizontal'
  | 'bar-vertical'
  | 'stacked-bar'
  | 'tracker';

interface AnalyticsChartProps {
  title: string;
  subtitle?: string;
  sourceAttribution?: string;
  unit?: string;
  icon?: LucideIcon;
  variant: AnalyticsChartVariant;
  data?: ChartDatum[];
  trackerData?: TrackerSegment[];
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  totalLabel?: string;
  isLoading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: React.ReactNode;
  className?: string;
  onSelectDatum?: (datum: ChartDatum) => void;
}

const DEFAULT_PALETTE = [
  'var(--brand-purple)',
  'var(--brand-blue)',
  'var(--brand-orange)',
  'var(--cyan)',
  'var(--sky)',
  '#10B981',
];

const TRACKER_BG: Record<TrackerSegment['status'], string> = {
  success: 'bg-emerald-500 hover:bg-emerald-400',
  warning: 'bg-amber-500 hover:bg-amber-400',
  critical: 'bg-rose-500 hover:bg-rose-400',
  info: 'bg-brand-blue hover:opacity-85',
  neutral: 'bg-canvas-muted hover:bg-line-strong',
};

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  title,
  subtitle,
  sourceAttribution,
  unit = 'records',
  icon: Icon,
  variant,
  data = [],
  trackerData = [],
  primaryLabel = 'Primary',
  secondaryLabel = 'Secondary',
  primaryColor = 'var(--brand-purple)',
  secondaryColor = 'var(--brand-blue)',
  totalLabel,
  isLoading = false,
  error = null,
  emptyTitle = 'No chart data available',
  emptyDescription = 'No verified records match the active plant or filter scope.',
  actions,
  className,
  onSelectDatum,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const totalSum = useMemo(
    () => data.reduce((acc, item) => acc + Number(item.value || 0), 0),
    [data]
  );

  const maxVal = useMemo(() => {
    const vals = data.flatMap(d => [Number(d.value || 0), Number(d.secondaryValue || 0)]);
    return Math.max(...vals, 1);
  }, [data]);

  const hasData = variant === 'tracker' ? trackerData.length > 0 : data.length > 0;

  return (
    <section
      className={cn(
        'p-5 rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle flex flex-col justify-between gap-4',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-line-subtle">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-brand-purple shrink-0" aria-hidden="true" />}
            <span className="truncate">{title}</span>
          </h3>
          {subtitle && (
            <p className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {totalLabel && (
            <span className="text-[11px] font-mono font-semibold text-ink-secondary bg-canvas-subtle px-2 py-0.5 rounded border border-line-subtle tabular-nums">
              {totalLabel}
            </span>
          )}
          {actions}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-[140px] flex flex-col justify-center">
        {isLoading ? (
          <div className="space-y-3 py-2">
            <LoadingSkeleton className="h-4 w-full" />
            <LoadingSkeleton className="h-24 w-full" />
            <LoadingSkeleton className="h-4 w-3/4" />
          </div>
        ) : error ? (
          <ErrorState message={error} />
        ) : !hasData ? (
          <EmptyState title={emptyTitle} description={emptyDescription} className="p-6" />
        ) : variant === 'bar-horizontal' ? (
          <div className="space-y-3">
            {data.map((item, idx) => {
              const pctOfTotal = totalSum > 0 ? Math.round((item.value / totalSum) * 100) : 0;
              const widthPct = Math.max(2, Math.round((item.value / maxVal) * 100));
              const barColor = item.color || primaryColor;
              const isHovered = hoveredIdx === idx;

              return (
                <div
                  key={item.label}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => onSelectDatum && onSelectDatum(item)}
                  className={cn(
                    'space-y-1.5 rounded-lg p-1.5 -mx-1.5 transition-colors',
                    onSelectDatum && 'cursor-pointer',
                    isHovered && 'bg-canvas-subtle'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-[11px] font-semibold text-ink-primary truncate">
                      {item.label}
                    </span>
                    <span className="font-mono text-[11px] text-ink-secondary tabular-nums shrink-0">
                      <strong className="text-ink-primary">{item.value.toLocaleString('en-IN')}</strong>{' '}
                      {unit} ({pctOfTotal}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-canvas-muted overflow-hidden border border-line-subtle/50">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : variant === 'bar-vertical' ? (
          <div className="space-y-3">
            <div className="relative h-44 flex items-end justify-around gap-3 pt-6 pb-2 border-b border-line-subtle px-2">
              {data.map((item, idx) => {
                const heightPct = Math.max(4, Math.round((item.value / maxVal) * 100));
                const secHeightPct =
                  item.secondaryValue !== undefined
                    ? Math.max(4, Math.round((item.secondaryValue / maxVal) * 100))
                    : null;
                const isHovered = hoveredIdx === idx;

                return (
                  <div
                    key={item.label}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => onSelectDatum && onSelectDatum(item)}
                    className={cn(
                      'relative flex-1 h-full flex flex-col items-center justify-end group',
                      onSelectDatum && 'cursor-pointer'
                    )}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-2 z-20 px-2.5 py-1.5 rounded-lg bg-canvas-surface border border-line-default shadow-elevated text-[11px] font-mono whitespace-nowrap pointer-events-none">
                        <div className="font-bold text-ink-primary">{item.label}</div>
                        <div className="text-ink-secondary">
                          {primaryLabel}: <strong className="text-ink-primary">{item.value.toLocaleString('en-IN')}</strong>
                        </div>
                        {item.secondaryValue !== undefined && (
                          <div className="text-ink-secondary">
                            {secondaryLabel}: <strong className="text-ink-primary">{item.secondaryValue.toLocaleString('en-IN')}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="w-full h-full flex items-end justify-center gap-1.5 px-1">
                      <div
                        className="w-full max-w-[34px] rounded-t-md transition-all duration-300 relative flex items-start justify-center"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor: item.color || primaryColor,
                          opacity: hoveredIdx !== null && !isHovered ? 0.65 : 1,
                        }}
                      >
                        <span className="text-[10px] font-mono font-bold text-ink-primary -mt-4 tabular-nums">
                          {item.value.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {secHeightPct !== null && (
                        <div
                          className="w-full max-w-[34px] rounded-t-md transition-all duration-300 relative flex items-start justify-center"
                          style={{
                            height: `${secHeightPct}%`,
                            backgroundColor: secondaryColor,
                            opacity: hoveredIdx !== null && !isHovered ? 0.65 : 1,
                          }}
                        >
                          <span className="text-[10px] font-mono font-bold text-ink-secondary -mt-4 tabular-nums">
                            {item.secondaryValue?.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis Labels & Legend */}
            <div className="flex items-center justify-around gap-2 px-2">
              {data.map(item => (
                <span
                  key={item.label}
                  className="flex-1 text-center text-[11px] font-mono font-semibold text-ink-secondary truncate"
                >
                  {item.label}
                </span>
              ))}
            </div>

            {data.some(d => d.secondaryValue !== undefined) && (
              <div className="flex items-center justify-end gap-4 pt-1 text-[11px] text-ink-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
                  <span>{primaryLabel}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: secondaryColor }} />
                  <span>{secondaryLabel}</span>
                </span>
              </div>
            )}
          </div>
        ) : variant === 'stacked-bar' ? (
          <div className="space-y-4">
            {/* Segmented Bar */}
            <div className="relative h-4 w-full rounded-full overflow-hidden flex bg-canvas-muted border border-line-subtle/60">
              {data.map((item, idx) => {
                const pct = totalSum > 0 ? (item.value / totalSum) * 100 : 0;
                if (pct <= 0) return null;
                const segColor = item.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
                return (
                  <div
                    key={item.label}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => onSelectDatum && onSelectDatum(item)}
                    className={cn(
                      'h-full transition-opacity duration-150',
                      onSelectDatum && 'cursor-pointer',
                      hoveredIdx !== null && hoveredIdx !== idx && 'opacity-50'
                    )}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: segColor,
                    }}
                    title={`${item.label}: ${item.value.toLocaleString('en-IN')} (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>

            {/* Interactive Legend Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {data.map((item, idx) => {
                const pct = totalSum > 0 ? ((item.value / totalSum) * 100).toFixed(1) : '0.0';
                const segColor = item.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
                const isHovered = hoveredIdx === idx;
                return (
                  <div
                    key={item.label}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => onSelectDatum && onSelectDatum(item)}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-line-subtle bg-canvas-subtle/60 transition-colors text-xs',
                      onSelectDatum && 'cursor-pointer',
                      isHovered && 'bg-canvas-muted border-line-default'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: segColor }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-ink-primary truncate">{item.label}</span>
                    </div>
                    <span className="font-mono text-[11px] text-ink-secondary tabular-nums shrink-0">
                      <strong className="text-ink-primary">{item.value.toLocaleString('en-IN')}</strong> ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : variant === 'tracker' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-1 h-9 w-full">
              {trackerData.map((seg, idx) => (
                <div
                  key={seg.id || idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={cn(
                    'flex-1 h-full rounded-sm transition-transform duration-150 relative cursor-default',
                    TRACKER_BG[seg.status],
                    hoveredIdx === idx && 'scale-y-110 z-10'
                  )}
                  title={seg.tooltip}
                >
                  {hoveredIdx === idx && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 px-2 py-1 rounded bg-canvas-surface border border-line-default shadow-elevated text-[10px] font-mono text-ink-primary whitespace-nowrap pointer-events-none">
                      {seg.tooltip}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted">
              <span>{trackerData[0]?.tooltip}</span>
              <span>{trackerData[trackerData.length - 1]?.tooltip}</span>
            </div>
          </div>
        ) : (
          // Area / Line Time-Series Chart (SVG)
          <AreaTrendSvg
            data={data}
            primaryLabel={primaryLabel}
            secondaryLabel={secondaryLabel}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            unit={unit}
            hoveredIdx={hoveredIdx}
            setHoveredIdx={setHoveredIdx}
          />
        )}
      </div>

      {/* Source Attribution Footer */}
      {sourceAttribution && (
        <div className="pt-2.5 border-t border-line-subtle flex items-center justify-between text-[10px] font-mono text-ink-muted">
          <span>Source: {sourceAttribution}</span>
          <span>Zero-Mock Verified</span>
        </div>
      )}
    </section>
  );
};

interface AreaTrendSvgProps {
  data: ChartDatum[];
  primaryLabel: string;
  secondaryLabel: string;
  primaryColor: string;
  secondaryColor: string;
  unit: string;
  hoveredIdx: number | null;
  setHoveredIdx: (idx: number | null) => void;
}

const AreaTrendSvg: React.FC<AreaTrendSvgProps> = ({
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor,
  secondaryColor,
  unit,
  hoveredIdx,
  setHoveredIdx,
}) => {
  const width = 620;
  const height = 180;
  const padL = 36;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const hasSecondary = data.some(d => d.secondaryValue !== undefined);
  const maxVal = Math.max(
    ...data.flatMap(d => [d.value, d.secondaryValue ?? 0]),
    4
  );
  const yCeiling = Math.ceil(maxVal * 1.15);

  const getX = (idx: number) =>
    data.length <= 1 ? padL + plotW / 2 : padL + (idx / (data.length - 1)) * plotW;
  const getY = (val: number) => padT + plotH - (val / yCeiling) * plotH;

  const primaryLine = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.value).toFixed(1)}`)
    .join(' ');
  const primaryArea = `${primaryLine} L ${getX(data.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const secondaryLine = hasSecondary
    ? data
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.secondaryValue ?? 0).toFixed(1)}`)
        .join(' ')
    : '';

  const hoveredDatum = hoveredIdx !== null ? data[hoveredIdx] : null;
  const yTicks = [0, Math.round(yCeiling / 2), yCeiling];

  return (
    <div className="space-y-2">
      <div className="relative w-full">
        {hoveredDatum && hoveredIdx !== null && (
          <div className="absolute right-2 top-1 z-20 px-2.5 py-1.5 rounded-lg bg-canvas-surface border border-line-default shadow-elevated text-[11px] font-mono pointer-events-none">
            <div className="font-bold text-ink-primary">{hoveredDatum.label}</div>
            <div className="text-ink-secondary">
              {primaryLabel}: <strong className="text-ink-primary">{hoveredDatum.value}</strong> {unit}
            </div>
            {hasSecondary && hoveredDatum.secondaryValue !== undefined && (
              <div className="text-ink-secondary">
                {secondaryLabel}: <strong className="text-ink-primary">{hoveredDatum.secondaryValue}</strong> {unit}
              </div>
            )}
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 overflow-visible"
          role="img"
          aria-label={`${primaryLabel} trend visualization`}
        >
          <defs>
            <linearGradient id="ehsAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Y gridlines & labels */}
          {yTicks.map(tick => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  stroke="var(--border-subtle)"
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-ink-muted text-[10px] font-mono"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Primary Area + Line */}
          <path d={primaryArea} fill="url(#ehsAreaGrad)" />
          <path
            d={primaryLine}
            fill="none"
            stroke={primaryColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Secondary Line if present */}
          {hasSecondary && (
            <path
              d={secondaryLine}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover Vertical Line */}
          {hoveredIdx !== null && (
            <line
              x1={getX(hoveredIdx)}
              y1={padT}
              x2={getX(hoveredIdx)}
              y2={padT + plotH}
              stroke="var(--border-strong)"
              strokeWidth="1"
            />
          )}

          {/* Data Points & Invisible Hit Targets */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.value);
            const isActive = hoveredIdx === i;
            const showXLabel =
              data.length <= 8 || i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6) === 0;

            return (
              <g key={d.label}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? 4.5 : 2.5}
                  fill={primaryColor}
                  stroke="var(--bg-surface)"
                  strokeWidth="1.5"
                />
                {hasSecondary && d.secondaryValue !== undefined && (
                  <circle
                    cx={cx}
                    cy={getY(d.secondaryValue)}
                    r={isActive ? 4 : 2}
                    fill={secondaryColor}
                    stroke="var(--bg-surface)"
                    strokeWidth="1.5"
                  />
                )}
                {showXLabel && (
                  <text
                    x={cx}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-ink-muted text-[10px] font-mono"
                  >
                    {d.label}
                  </text>
                )}
                <rect
                  x={cx - Math.max(plotW / Math.max(data.length, 1) / 2, 10)}
                  y={padT}
                  width={Math.max(plotW / Math.max(data.length, 1), 20)}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-crosshair"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-[11px] text-ink-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span>{primaryLabel}</span>
        </span>
        {hasSecondary && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
            <span>{secondaryLabel}</span>
          </span>
        )}
      </div>
    </div>
  );
};

