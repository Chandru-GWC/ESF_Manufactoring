import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ehsApi } from '../services/api';
import { useEhs } from '../context/EhsContext';
import { DashboardData, DashboardKind } from '../types/ehs';
import { KpiCards } from '../components/agent/KpiCards';
import { ChartRenderer } from '../components/agent/ChartRenderer';
import { ExportMenu } from '../components/dashboard/ExportMenu';
import { ErrorState } from '../components/ui/ErrorState';

/** Dashboards are cached per kind + plant, so switching tabs does not fetch again (use Refresh to reload). */
const CACHE = new Map<string, DashboardData>();

const cell = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-IN') : String(v);

const Skeleton: React.FC<{ className: string }> = ({ className }) => (
  <div className={`animate-pulse rounded-xl bg-canvas-muted/70 ${className}`} aria-hidden="true" />
);

/** One overview dashboard: 5 KPIs in a line, 4 charts (area, line, heatmap, donut) and a 5-row table with export. */
export const DashboardView: React.FC<{ kind: DashboardKind }> = ({ kind }) => {
  const { facilityId } = useEhs();
  const key = `${kind}:${facilityId}`;
  const [data, setData] = useState<DashboardData | null>(() => CACHE.get(key) ?? null);
  const [loading, setLoading] = useState(!CACHE.has(key));
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (force: boolean) => {
      const cached = CACHE.get(key);
      if (cached && !force) {
        requestId.current += 1; // ignore any request still running for another tab / plant
        setData(cached);
        setLoading(false);
        setError(null);
        return;
      }
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const fresh = await ehsApi.getDashboard(kind, facilityId);
        if (id !== requestId.current) return;
        CACHE.set(key, fresh);
        setData(fresh);
      } catch (err: any) {
        if (id !== requestId.current) return;
        setError(err?.message || 'Unable to load the dashboard.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [key, kind, facilityId]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const shown = data && data.kind === kind ? data : null;
  const table = shown?.table;

  return (
    <div className="space-y-4 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink-primary">{shown?.title ?? 'Dashboard'}</h1>
          <p className="text-xs text-ink-secondary mt-0.5">{shown?.subtitle ?? 'Loading the latest figures from the database…'}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-muted">
          {shown && (
            <span className="font-mono">
              {shown.plant_scope === 'ALL' ? 'All plants' : shown.plant_scope} ·{' '}
              {new Date(shown.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary disabled:opacity-60 focus-ring"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {error && !shown && <ErrorState title="Unable to load this dashboard" message={error} onRetry={() => void load(true)} />}
      {error && shown && (
        <p role="alert" className="text-xs text-severity-critical-text bg-severity-critical-bg border border-severity-critical-border rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* 1. KPIs: five cards in one line */}
      <section aria-label="Key figures">
        {shown ? (
          <KpiCards kpis={shown.kpis} layout="row" />
        ) : (
          !error && (
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-[84px]" />
              ))}
            </div>
          )
        )}
      </section>

      {/* 2. Charts: area, line, heatmap, donut */}
      <section aria-label="Charts" className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {shown
          ? shown.charts.slice(0, 4).map((spec, i) => <ChartRenderer key={`${spec.type}-${i}`} spec={spec} />)
          : !error && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[300px]" />)}
      </section>

      {/* 3. Table with "Export as" */}
      <section aria-label="Data table" className="rounded-xl border border-line-subtle bg-canvas-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-line-subtle">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink-primary truncate">{table?.title ?? 'Latest records'}</h2>
            {table && (
              <p className="text-[11px] text-ink-muted">
                {table.rows.length} of {table.total_rows.toLocaleString('en-IN')} rows
              </p>
            )}
          </div>
          <ExportMenu onExport={format => ehsApi.downloadDashboard(kind, format, facilityId)} />
        </div>
        {table ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas-subtle text-ink-secondary">
                <tr>
                  {table.columns.map(col => (
                    <th key={col} className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-line-subtle hover:bg-canvas-subtle/60">
                    {table.columns.map((_, ci) => (
                      <td key={ci} className={`px-3 py-2 whitespace-nowrap text-ink-primary ${typeof row[ci] === 'number' ? 'text-right tabular-nums' : ''}`}>
                        {cell(row[ci])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !error && <Skeleton className="h-[200px] m-3" />
        )}
      </section>
    </div>
  );
};
