import React from 'react';
import { Database, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useEhs } from '../../context/EhsContext';
import { LoadingSkeleton } from './LoadingState';

interface DataLineagePanelProps {
  onOpenModal?: () => void;
  compact?: boolean;
}

export const DataLineagePanel: React.FC<DataLineagePanelProps> = ({
  onOpenModal,
  compact = false,
}) => {
  const { datasetStatuses, isDataConnected, isLoading, facilityId, lastSyncedAt } = useEhs();

  const tables = [
    {
      key: 'fact_ehs_event',
      schemaName: 'ehs_core.fact_ehs_event',
      desc: 'Hazards, Incidents, Near Misses, Permits, CAPA',
      accentClass: 'text-brand-purple',
    },
    {
      key: 'fact_workforce_attendance',
      schemaName: 'ehs_core.fact_workforce_attendance',
      desc: 'Shift rosters, exposure hours, training compliance',
      accentClass: 'text-brand-blue',
    },
    {
      key: 'fact_maintenance_work_order',
      schemaName: 'ehs_core.fact_maintenance_work_order',
      desc: 'Preventive, corrective & P1 safety work orders',
      accentClass: 'text-brand-orange',
    },
  ];

  return (
    <div className="p-5 rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-line-subtle">
          <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2 min-w-0">
            <Database className="w-4 h-4 text-brand-blue shrink-0" />
            <span className="truncate">Verified Ingestion Lineage</span>
          </h3>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold shrink-0 flex items-center gap-1 ${
              isDataConnected
                ? 'bg-severity-success-bg text-severity-success-text border-severity-success-border'
                : isLoading
                ? 'bg-canvas-subtle text-ink-muted border-line-default'
                : 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border'
            }`}
          >
            {isDataConnected ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span>Neon Active</span>
              </>
            ) : isLoading ? (
              <span>Syncing...</span>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                <span>Disconnected</span>
              </>
            )}
          </span>
        </div>

        <div className="space-y-2.5 pt-3 text-xs">
          {tables.map(t => {
            const ds = datasetStatuses[t.key];
            return (
              <div
                key={t.key}
                className="p-2.5 rounded-lg border border-line-subtle bg-canvas-subtle flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-ink-primary font-mono text-[11px] truncate">
                    {t.schemaName}
                  </div>
                  {!compact && (
                    <div className="text-[10px] text-ink-muted truncate mt-0.5">{t.desc}</div>
                  )}
                </div>
                <span className={`font-mono font-bold text-xs shrink-0 whitespace-nowrap tabular-nums ${t.accentClass}`}>
                  {isLoading || ds?.recordCount === null ? (
                    <LoadingSkeleton className="h-4 w-14" />
                  ) : (
                    `${ds.recordCount.toLocaleString('en-IN')} rows`
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted px-0.5">
          <span>Scope: {facilityId === 'ALL' ? 'Enterprise Fleet' : facilityId}</span>
          <span>
            {lastSyncedAt
              ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'PostgreSQL SSL'}
          </span>
        </div>

        {onOpenModal && (
          <button
            type="button"
            onClick={onOpenModal}
            className="w-full py-2 px-3 rounded-lg border border-line-default bg-canvas-subtle hover:bg-canvas-muted text-xs font-semibold text-ink-primary transition-colors flex items-center justify-center gap-1.5 focus-ring"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-purple" />
            <span>Open Data Dictionary & Lineage</span>
          </button>
        )}
      </div>
    </div>
  );
};

