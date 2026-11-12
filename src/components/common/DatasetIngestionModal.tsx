import React from 'react';
import {
  CheckCircle2,
  Database,
  X,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEhs } from '../../context/EhsContext';
import { MODAL_VARIANTS } from '../../lib/motion';

interface DatasetIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DATASET_SCHEMAS: Record<
  'fact_ehs_event' | 'fact_workforce_attendance' | 'fact_maintenance_work_order',
  {
    table: string;
    primaryKey: string;
    grain: string;
    columns: string[];
  }
> = {
  fact_ehs_event: {
    table: 'ehs_core.fact_ehs_event',
    primaryKey: 'ehs_event_id',
    grain: '1 row per recorded safety event (Hazard, First Aid, Near Miss, Permit Exception, Audit Finding)',
    columns: [
      'ehs_event_id',
      'event_ts',
      'plant_id',
      'area',
      'shift_id',
      'event_type',
      'hazard_category',
      'risk_severity',
      'lost_time_injury',
      'action_owner',
      'due_date',
      'action_status',
      'permit_id',
    ],
  },
  fact_workforce_attendance: {
    table: 'ehs_core.fact_workforce_attendance',
    primaryKey: 'attendance_id',
    grain: '1 row per employee shift assignment across IN-KA-01 & IN-TN-01',
    columns: [
      'attendance_id',
      'work_date',
      'employee_id',
      'plant_id',
      'shift_id',
      'scheduled_hours',
      'actual_hours',
      'attendance_status',
      'overtime_hours',
      'skill_match',
      'training_compliance',
    ],
  },
  fact_maintenance_work_order: {
    table: 'ehs_core.fact_maintenance_work_order',
    primaryKey: 'work_order_id',
    grain: '1 row per preventive, corrective, or predictive maintenance work order',
    columns: [
      'work_order_id',
      'machine_id',
      'plant_id',
      'created_ts',
      'maintenance_type',
      'failure_mode',
      'priority',
      'planned_start',
      'actual_start (nullable)',
      'downtime_avoided_estimate_min',
      'status',
      'technician_id',
    ],
  },
};

export const DatasetIngestionModal: React.FC<DatasetIngestionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { datasetStatuses, isLoading, reloadAllData, facilityId, lastSyncedAt } = useEhs();

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lineage-modal-title"
            variants={MODAL_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-2xl rounded-xl bg-canvas-surface border border-line-default shadow-modal overflow-hidden text-ink-primary z-10 max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-line-subtle bg-canvas-subtle">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand-purple-soft text-brand-purple">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="lineage-modal-title" className="text-base font-bold text-ink-primary">
                    Data Dictionary & Neon Ingestion Lineage
                  </h3>
                  <p className="text-xs text-ink-secondary">
                    Isolated PostgreSQL schema <code className="font-mono text-brand-purple">ehs_core</code> • Zero-Mock Enforced
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-canvas-muted transition-colors focus-ring"
                aria-label="Close Data Lineage Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-canvas-subtle border border-line-subtle">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-severity-success-text" />
                  <span className="font-medium text-ink-primary">
                    Active Query Scope: <span className="font-mono font-bold text-brand-purple">{facilityId}</span>
                  </span>
                </div>
                <span className="font-mono text-[11px] text-ink-muted">
                  {lastSyncedAt ? `Last verified: ${new Date(lastSyncedAt).toLocaleString()}` : 'Syncing...'}
                </span>
              </div>

              {(Object.keys(DATASET_SCHEMAS) as Array<keyof typeof DATASET_SCHEMAS>).map(key => {
                const ds = datasetStatuses[key];
                const schema = DATASET_SCHEMAS[key];
                const isOk = ds?.status === 'ingested';

                return (
                  <div
                    key={key}
                    className="p-4 rounded-xl border border-line-subtle bg-canvas-surface space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isOk ? (
                          <CheckCircle2 className="w-4 h-4 text-severity-success-text shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-brand-orange shrink-0" />
                        )}
                        <span className="font-mono font-bold text-xs text-ink-primary">{schema.table}</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-brand-purple px-2 py-0.5 rounded bg-brand-purple-soft border border-brand-purple/25">
                        {ds?.recordCount !== null && ds?.recordCount !== undefined
                          ? `${ds.recordCount.toLocaleString('en-IN')} verified rows`
                          : 'Connecting...'}
                      </span>
                    </div>

                    <p className="text-[11px] text-ink-secondary">
                      <strong>Grain:</strong> {schema.grain} • <strong>PK:</strong>{' '}
                      <code className="font-mono text-ink-primary">{schema.primaryKey}</code>
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {schema.columns.map(col => (
                        <code
                          key={col}
                          className="px-2 py-0.5 rounded bg-canvas-subtle border border-line-subtle text-[10px] font-mono text-ink-secondary"
                        >
                          {col}
                        </code>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-line-subtle bg-canvas-subtle flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => reloadAllData()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-muted text-ink-primary transition-colors disabled:opacity-50 focus-ring"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-brand-purple' : ''}`} />
                <span>Re-verify Neon Counts</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-brand-purple text-white hover:bg-brand-hover transition-colors focus-ring"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
