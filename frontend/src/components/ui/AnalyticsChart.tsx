import React, { useState, useMemo, useRef, useEffect, useId } from 'react';
import { LucideIcon, CalendarRange } from 'lucide-react';
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
        'p-5 rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle flex flex-col justify-between gap-4 w-full min-w-0',
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
      <div className="flex-1 w-full min-w-0 min-h-[140px] flex flex-col justify-center">
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
          <div className="space-y-4 w-full min-w-0">
            <div className="relative h-60 sm:h-72 w-full min-w-0 flex items-end justify-around gap-2 sm:gap-4 pt-6 pb-2 border-b border-line-subtle px-2">
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
  const rawId = useId();
  const gradientId = useMemo(() => `ehs_grad_${rawId.replace(/[^a-zA-Z0-9]/g, '_')}`, [rawId]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) {
        setContainerWidth(prev => (Math.abs(prev - w) > 2 ? w : prev));
      }
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const w = Math.floor(entry.contentRect.width);
          if (w > 0) {
            setContainerWidth(prev => (Math.abs(prev - w) > 2 ? w : prev));
          }
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const width = Math.max(containerWidth, 200);
  // Responsive desktop height: 320-380px on desktop (340px default), 260px on mobile
  const height = width < 640 ? 260 : 340;

  // Axis margins - leaving ~90-95% for plotW
  const padL = width < 640 ? 36 : 46;
  const padR = width < 640 ? 14 : 24;
  const padT = 24;
  const padB = 38;

  const plotW = Math.max(width - padL - padR, 100);
  const plotH = Math.max(height - padT - padB, 80);

  const hasSecondary = data.some(d => d.secondaryValue !== undefined);
  const maxVal = Math.max(
    ...data.flatMap(d => [d.value, d.secondaryValue ?? 0]),
    4
  );
  const yCeiling = Math.ceil(maxVal * 1.15);

  const getX = (idx: number) => {
    if (data.length <= 1) return padL + plotW / 2;
    return padL + (idx / (data.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    if (yCeiling <= 0) return padT + plotH;
    return padT + plotH - (val / yCeiling) * plotH;
  };

  const primaryPoints = data.map((d, i) => ({
    x: getX(i),
    y: getY(d.value),
  }));

  const primaryLine = primaryPoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const primaryArea = data.length > 0
    ? `${primaryLine} L ${getX(data.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
    : '';

  const secondaryPoints = hasSecondary
    ? data.map((d, i) => ({
        x: getX(i),
        y: getY(d.secondaryValue ?? 0),
      }))
    : [];

  const secondaryLine = hasSecondary
    ? secondaryPoints
        .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
        .join(' ')
    : '';

  const hoveredDatum = hoveredIdx !== null ? data[hoveredIdx] : null;

  // 5 evenly distributed horizontal gridlines (0%, 25%, 50%, 75%, 100%)
  const yTicks = [
    0,
    Math.round(yCeiling * 0.25),
    Math.round(yCeiling * 0.5),
    Math.round(yCeiling * 0.75),
    yCeiling,
  ];

  // Smart stride for X labels so dates never collide on small screens
  const minLabelWidth = width < 640 ? 76 : 64;
  const maxAllowedLabels = Math.max(2, Math.floor(plotW / minLabelWidth));
  const labelStride = Math.max(1, Math.ceil((data.length - 1) / (maxAllowedLabels - 1)));

  const shouldShowXLabel = (i: number) => {
    if (i === 0 || i === data.length - 1) return true;
    if ((data.length - 1) - i < labelStride * 0.75) return false;
    return i % labelStride === 0;
  };

  return (
    <div ref={containerRef} className="w-full min-w-0 space-y-3">
      <div className="relative w-full min-w-0">
        {/* Tooltip */}
        {hoveredDatum && hoveredIdx !== null && (
          <div
            className="absolute z-20 px-3 py-2 rounded-xl bg-canvas-surface/95 backdrop-blur-md border border-line-default shadow-elevated text-xs font-mono pointer-events-none transition-all duration-75"
            style={{
              top: '8px',
              left: `${Math.min(Math.max(getX(hoveredIdx), 120), width - 140)}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-bold text-ink-primary flex items-center gap-1.5 pb-1 border-b border-line-subtle mb-1.5">
              <CalendarRange className="w-3.5 h-3.5 text-brand-orange" aria-hidden="true" />
              <span>Week of {hoveredDatum.label}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-ink-secondary text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                <span>{primaryLabel}</span>
              </span>
              <strong className="text-ink-primary font-bold">{hoveredDatum.value.toLocaleString('en-IN')} {unit}</strong>
            </div>
            {hasSecondary && hoveredDatum.secondaryValue !== undefined && (
              <div className="flex items-center justify-between gap-4 text-ink-secondary text-[11px] mt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
                  <span>{secondaryLabel}</span>
                </span>
                <strong className="text-brand-orange font-bold">{hoveredDatum.secondaryValue.toLocaleString('en-IN')} {unit}</strong>
              </div>
            )}
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: `${height}px` }}
          className="w-full block overflow-visible"
          role="img"
          aria-label={`${primaryLabel} trend visualization`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.32" />
              <stop offset="60%" stopColor={primaryColor} stopOpacity="0.10" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.00" />
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
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padL - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-ink-muted text-[10px] font-mono tabular-nums select-none"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Primary Area & Line */}
          {primaryArea && <path d={primaryArea} fill={`url(#${gradientId})`} />}
          {primaryLine && (
            <path
              d={primaryLine}
              fill="none"
              stroke={primaryColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Secondary Line if present */}
          {hasSecondary && secondaryLine && (
            <path
              d={secondaryLine}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="2.2"
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover Vertical Guide Line */}
          {hoveredIdx !== null && (
            <line
              x1={getX(hoveredIdx)}
              y1={padT}
              x2={getX(hoveredIdx)}
              y2={padT + plotH}
              stroke="var(--brand-orange)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Data Points */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.value);
            const isActive = hoveredIdx === i;
            const showXLabel = shouldShowXLabel(i);

            return (
              <g key={`point-${d.label}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? 5.5 : 3.5}
                  fill={primaryColor}
                  stroke="var(--bg-surface)"
                  strokeWidth={isActive ? 2.5 : 1.5}
                  className="transition-all duration-150"
                />
                {hasSecondary && d.secondaryValue !== undefined && (
                  <circle
                    cx={cx}
                    cy={getY(d.secondaryValue)}
                    r={isActive ? 5 : 3}
                    fill={secondaryColor}
                    stroke="var(--bg-surface)"
                    strokeWidth={isActive ? 2.5 : 1.5}
                    className="transition-all duration-150"
                  />
                )}
                {showXLabel && (
                  <text
                    x={cx}
                    y={height - 12}
                    textAnchor="middle"
                    className="fill-ink-muted text-[10px] sm:text-[11px] font-mono select-none"
                  >
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hit Targets for hover */}
          {data.map((d, i) => {
            const stepWidth = plotW / Math.max(data.length - 1, 1);
            const targetX = i === 0 ? padL : getX(i) - stepWidth / 2;
            const targetW = i === 0 || i === data.length - 1 ? stepWidth / 2 + padR : stepWidth;

            return (
              <rect
                key={`hit-${d.label}`}
                x={targetX}
                y={padT}
                width={Math.max(targetW, 16)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-crosshair"
              />
            );
          })}
        </svg>
      </div>

      {/* Legend aligned neatly at bottom */}
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-6 pt-3 border-t border-line-subtle/60 text-xs text-ink-secondary">
        <div className="inline-flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: primaryColor }} />
          <span className="font-semibold text-ink-primary">{primaryLabel}</span>
        </div>
        {hasSecondary && (
          <div className="inline-flex items-center gap-2">
            <span
              className="w-4 h-0 border-t-2 border-dashed shrink-0"
              style={{ borderColor: secondaryColor }}
            />
            <span className="font-semibold text-ink-primary">{secondaryLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
};

