import React, { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorState } from '../components/ui/ErrorState';
import { Download, FileSpreadsheet, CheckCircle2, Database, Calendar } from 'lucide-react';
import { useEhs } from '../context/EhsContext';

export const ReportsView: React.FC = () => {
  const {
    rawEvents,
    rawAttendance,
    rawMaintenance,
    overviewSummary,
    eventSummary,
    facilityId,
    isLoading,
    error,
    reloadAllData,
  } = useEhs();

  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const downloadBlob = (content: string, filename: string, rowCount: number) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setExportNotice(`Exported ${rowCount.toLocaleString('en-IN')} verified rows to ${filename}`);
  };

  const handleExportEventsCsv = () => {
    if (rawEvents.length === 0) return;
    const headers =
      'ehs_event_id,event_ts,plant_id,area,shift_id,event_type,hazard_category,risk_severity,lost_time_injury,action_owner,due_date,action_status,permit_id\n';
    const rows = rawEvents
      .map(
        e =>
          `"${e.ehs_event_id}","${e.event_ts}","${e.plant_id}","${e.area}","${e.shift_id}","${e.event_type}","${e.hazard_category}","${e.risk_severity}",${e.lost_time_injury},"${e.action_owner || ''}","${e.due_date}","${e.action_status}","${e.permit_id}"`
      )
      .join('\n');
    downloadBlob(
      headers + rows,
      `EHS_Events_${facilityId}_${new Date().toISOString().split('T')[0]}.csv`,
      rawEvents.length
    );
  };

  const handleExportAttendanceCsv = () => {
    if (rawAttendance.length === 0) return;
    const headers =
      'attendance_id,work_date,employee_id,plant_id,shift_id,scheduled_hours,actual_hours,attendance_status,overtime_hours,skill_match,training_compliance\n';
    const rows = rawAttendance
      .map(
        a =>
          `"${a.attendance_id}","${a.work_date}","${a.employee_id}","${a.plant_id}","${a.shift_id}",${a.scheduled_hours},${a.actual_hours},"${a.attendance_status}",${a.overtime_hours},"${a.skill_match}","${a.training_compliance}"`
      )
      .join('\n');
    downloadBlob(
      headers + rows,
      `Workforce_Attendance_${facilityId}_${new Date().toISOString().split('T')[0]}.csv`,
      rawAttendance.length
    );
  };

  const handleExportMaintenanceCsv = () => {
    if (rawMaintenance.length === 0) return;
    const headers =
      'work_order_id,machine_id,plant_id,created_ts,maintenance_type,failure_mode,priority,planned_start,actual_start,downtime_avoided_estimate_min,status,technician_id\n';
    const rows = rawMaintenance
      .map(
        m =>
          `"${m.work_order_id}","${m.machine_id}","${m.plant_id}","${m.created_ts}","${m.maintenance_type}","${m.failure_mode}","${m.priority}","${m.planned_start}","${m.actual_start || ''}",${m.downtime_avoided_estimate_min},"${m.status}","${m.technician_id}"`
      )
      .join('\n');
    downloadBlob(
      headers + rows,
      `Maintenance_Orders_${facilityId}_${new Date().toISOString().split('T')[0]}.csv`,
      rawMaintenance.length
    );
  };

  const dateWindow =
    eventSummary?.date_range?.start && eventSummary?.date_range?.end
      ? `${eventSummary.date_range.start.slice(0, 10)} to ${eventSummary.date_range.end.slice(0, 10)}`
      : 'Derived from active query';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Exports & Reporting Extracts"
        description={`Download verified CSV extracts scoped to ${facilityId === 'ALL' ? 'all facilities' : facilityId} directly from Neon PostgreSQL tables.`}
        breadcrumbs={[
          { label: 'Intelligence' },
          { label: 'Reports & Export', active: true },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-severity-info-bg text-severity-info-text border border-severity-info-border">
            <Calendar className="w-3.5 h-3.5" />
            {dateWindow}
          </span>
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      {exportNotice && (
        <div
          role="status"
          className="p-3.5 rounded-xl border border-severity-success-border bg-severity-success-bg/70 text-severity-success-text text-xs font-medium flex items-center justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{exportNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="font-mono text-[11px] underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="p-4 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle text-xs text-ink-secondary flex items-start gap-3">
        <Database className="w-4 h-4 text-brand-purple shrink-0 mt-0.5" />
        <div>
          <strong className="text-ink-primary font-semibold">Export Integrity Guarantee:</strong>{' '}
          Exports serialize verified columns directly from <code className="font-mono text-brand-purple">ehs_core</code> without synthetic columns or external regulatory compliance claims. Note: Workforce export downloads up to the active fetched slice ({rawAttendance.length.toLocaleString('en-IN')} of{' '}
          {overviewSummary?.total_workforce_records?.toLocaleString('en-IN') ?? '—'} rows).
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle flex flex-col justify-between border-t-2 border-t-brand-purple">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-lg bg-brand-purple-soft text-brand-purple">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-mono font-semibold text-ink-muted">ehs_core.fact_ehs_event</span>
            </div>
            <h3 className="font-bold text-sm text-ink-primary">EHS Events Extract</h3>
            <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
              Hazards, Near Misses, First Aid events, Permit Exceptions, Audit Findings, and CAPA owners.
            </p>
            <div className="mt-3 py-1.5 px-2.5 rounded-lg bg-canvas-subtle border border-line-subtle text-[11px] font-mono text-ink-secondary">
              Verified Rows: <strong className="text-ink-primary">{rawEvents.length.toLocaleString('en-IN')}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportEventsCsv}
            disabled={isLoading || rawEvents.length === 0}
            className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg bg-brand-purple text-white hover:bg-brand-hover shadow-sm-subtle transition-colors disabled:opacity-50 focus-ring"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Events CSV</span>
          </button>
        </div>

        <div className="p-5 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle flex flex-col justify-between border-t-2 border-t-brand-blue">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-lg bg-brand-blue-soft text-brand-blue">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-mono font-semibold text-ink-muted">fact_workforce_attendance</span>
            </div>
            <h3 className="font-bold text-sm text-ink-primary">Workforce Attendance Extract</h3>
            <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
              Shift rosters, actual and overtime hours, skill match, and training currency status.
            </p>
            <div className="mt-3 py-1.5 px-2.5 rounded-lg bg-canvas-subtle border border-line-subtle text-[11px] font-mono text-ink-secondary">
              Loaded Slice: <strong className="text-ink-primary">{rawAttendance.length.toLocaleString('en-IN')}</strong> /{' '}
              {overviewSummary?.total_workforce_records?.toLocaleString('en-IN') ?? '—'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportAttendanceCsv}
            disabled={isLoading || rawAttendance.length === 0}
            className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg bg-brand-blue text-white hover:opacity-90 shadow-sm-subtle transition-opacity disabled:opacity-50 focus-ring"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Workforce CSV</span>
          </button>
        </div>

        <div className="p-5 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle flex flex-col justify-between border-t-2 border-t-brand-orange">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-lg bg-brand-peach-soft text-brand-orange">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-mono font-semibold text-ink-muted">fact_maintenance_work_order</span>
            </div>
            <h3 className="font-bold text-sm text-ink-primary">Maintenance Work Orders Extract</h3>
            <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
              Machine identifiers, failure modes, priority tiers, nullable actual start timestamps, and downtime estimates.
            </p>
            <div className="mt-3 py-1.5 px-2.5 rounded-lg bg-canvas-subtle border border-line-subtle text-[11px] font-mono text-ink-secondary">
              Verified Rows: <strong className="text-ink-primary">{rawMaintenance.length.toLocaleString('en-IN')}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportMaintenanceCsv}
            disabled={isLoading || rawMaintenance.length === 0}
            className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg bg-brand-orange text-white hover:opacity-90 shadow-sm-subtle transition-opacity disabled:opacity-50 focus-ring"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Maintenance CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
