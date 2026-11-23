import React, { useState } from 'react';
import { Database, Sparkles, Table2, Target } from 'lucide-react';
import { Window } from '../ui/Window';
import { FingerprintIllustration, MachineIllustration, SlipIllustration } from './TableIllustrations';

export type SourceTableId = 'events' | 'attendance' | 'maintenance';

interface TableInfo {
  table: string;
  title: string;
  oneLine: string;
  story: string;
  records: { label: string; columns: string }[];
  usedFor: string;
  Illustration: React.FC;
}

const INFO: Record<SourceTableId, TableInfo> = {
  events: {
    table: 'fact_ehs_event',
    title: 'Safety events',
    oneLine: 'Every hazard, near-miss, first-aid case, permit exception or audit finding in a plant.',
    story: 'A worker slips on an oil spill, so one new row is added.',
    records: [
      { label: 'What happened', columns: 'event_type, hazard_category' },
      { label: 'Where and when', columns: 'plant_id, area, shift_id, event_ts' },
      { label: 'How serious', columns: 'risk_severity, lost_time_injury' },
      { label: 'The fix', columns: 'action_owner, due_date, action_status' },
    ],
    usedFor: 'Hazards, incidents and overdue corrective actions.',
    Illustration: SlipIllustration,
  },
  attendance: {
    table: 'fact_workforce_attendance',
    title: 'Workforce attendance',
    oneLine: 'Every shift of every employee: who came, how long they worked and whether safety training is valid.',
    story: 'A worker scans a fingerprint at the gate, so one new row is added.',
    records: [
      { label: 'Who and when', columns: 'employee_id, work_date, shift_id, plant_id' },
      { label: 'Hours', columns: 'scheduled_hours, actual_hours, overtime_hours' },
      { label: 'Attendance', columns: 'attendance_status' },
      { label: 'Safety', columns: 'skill_match, training_compliance' },
    ],
    usedFor: 'Training compliance, overtime and shift staffing.',
    Illustration: FingerprintIllustration,
  },
  maintenance: {
    table: 'fact_maintenance_work_order',
    title: 'Maintenance work orders',
    oneLine: 'Every repair or service job on a machine, from the request to the finished work.',
    story: 'A machine develops a fault, so a work order is raised for a technician.',
    records: [
      { label: 'Which machine', columns: 'machine_id, plant_id' },
      { label: 'What is wrong', columns: 'failure_mode, maintenance_type' },
      { label: 'How urgent', columns: 'priority (P1 = most urgent), status' },
      { label: 'Who and when', columns: 'technician_id, created_ts, planned_start, actual_start' },
    ],
    usedFor: 'Equipment risk, open P1 jobs and downtime.',
    Illustration: MachineIllustration,
  },
};

interface SourceTableDetailProps {
  id: SourceTableId;
  rowCount: number;
  rows: Record<string, unknown>[];
  loading: boolean;
}

/** Short explanation on the left, animated picture on the right, live rows on demand. */
export const SourceTableDetail: React.FC<SourceTableDetailProps> = ({ id, rowCount, rows, loading }) => {
  const info = INFO[id];
  const [showRows, setShowRows] = useState(false);
  const [shown, setShown] = useState(10);
  const Illustration = info.Illustration;
  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
        {/* Left: clear and short */}
        <div className="space-y-3 min-w-0">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted">
              <Database className="w-3 h-3" aria-hidden="true" />
              ehs_core.{info.table} · {rowCount.toLocaleString('en-IN')} rows
            </span>
            <h3 className="text-lg font-bold text-ink-primary mt-1">{info.title}</h3>
            <p className="text-sm text-ink-secondary mt-1">{info.oneLine}</p>
          </div>

          <p className="flex items-start gap-2 text-sm text-ink-primary rounded-lg bg-brand-subtle px-3 py-2">
            <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-brand-orange" aria-hidden="true" />
            <span>
              <strong>Example:</strong> {info.story}
            </span>
          </p>

          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary mb-1.5">Each row records</h4>
            <ul className="space-y-1">
              {info.records.map(r => (
                <li key={r.label} className="text-xs text-ink-primary">
                  <span className="font-semibold">{r.label}:</span>{' '}
                  <span className="font-mono text-ink-secondary">{r.columns}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="flex items-start gap-2 text-xs text-ink-secondary">
            <Target className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-primary" aria-hidden="true" />
            <span>
              <strong className="text-ink-primary">Used for:</strong> {info.usedFor}
            </span>
          </p>
        </div>

        {/* Right: animated picture */}
        <div className="rounded-2xl overflow-hidden border border-line-subtle bg-canvas-subtle">
          <Illustration />
        </div>
      </div>

      {/* Live rows open in a window, so the card keeps its size */}
      <button
        type="button"
        onClick={() => setShowRows(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline focus-ring rounded"
      >
        <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
        Show data rows
      </button>
      <Window open={showRows} title={`ehs_core.${info.table} · ${rowCount.toLocaleString('en-IN')} rows`} onClose={() => setShowRows(false)} widthClass="max-w-5xl">
        <div className="p-4 space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-ink-muted">{loading ? 'Loading rows…' : 'No rows loaded for this table.'}</p>
          ) : (
            <>
              <div className="overflow-auto max-h-[60vh] rounded-lg border border-line-subtle">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-canvas-subtle text-ink-secondary">
                    <tr>
                      {columns.map(col => (
                        <th key={col} className="px-2.5 py-1.5 font-mono font-semibold whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, shown).map((row, ri) => (
                      <tr key={ri} className="border-t border-line-subtle">
                        {columns.map(col => (
                          <td key={col} className="px-2.5 py-1.5 whitespace-nowrap text-ink-primary">
                            {row[col] === null || row[col] === undefined ? '—' : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-xs text-ink-secondary">
                <span>
                  Showing {Math.min(shown, rows.length)} of {rows.length.toLocaleString('en-IN')} rows
                </span>
                {shown < rows.length && (
                  <button type="button" onClick={() => setShown(n => n + 20)} className="font-semibold text-brand-primary hover:underline focus-ring rounded">
                    Show 20 more
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Window>
    </div>
  );
};
