import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { KPIStatCard } from '../components/ui/KPIStatCard';
import { FilterToolbar, FilterSelectConfig } from '../components/ui/FilterToolbar';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AnalyticsChart, ChartDatum } from '../components/ui/AnalyticsChart';
import { ErrorState } from '../components/ui/ErrorState';
import { Users, Clock, Timer, Award } from 'lucide-react';
import { useEhs } from '../context/EhsContext';
import { WorkforceAttendanceRecord } from '../types/ehs';

export const WorkforceShiftsView: React.FC = () => {
  const { rawAttendance, workforceSummary, overviewSummary, isLoading, error, reloadAllData, facilityId } = useEhs();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedTraining, setSelectedTraining] = useState<string>('ALL');

  const filteredAttendance = useMemo(() => {
    return rawAttendance.filter(r => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        r.attendance_id.toLowerCase().includes(q) ||
        r.employee_id.toLowerCase().includes(q) ||
        r.work_date.toLowerCase().includes(q);

      const matchesShift = selectedShift === 'ALL' || r.shift_id === selectedShift;
      const matchesStatus = selectedStatus === 'ALL' || r.attendance_status === selectedStatus;
      const matchesTraining = selectedTraining === 'ALL' || r.training_compliance === selectedTraining;

      return matchesSearch && matchesShift && matchesStatus && matchesTraining;
    });
  }, [rawAttendance, searchTerm, selectedShift, selectedStatus, selectedTraining]);

  const shiftChartData = useMemo<ChartDatum[]>(() => {
    if (!workforceSummary?.by_shift) return [];
    return ['A', 'B', 'C']
      .filter(s => workforceSummary.by_shift[s] !== undefined)
      .map(s => ({
        label: `Shift ${s}`,
        value: workforceSummary.by_shift[s],
        color: s === 'A' ? 'var(--brand-purple)' : s === 'B' ? 'var(--brand-blue)' : 'var(--sky)',
      }));
  }, [workforceSummary]);

  const attendanceStatusData = useMemo<ChartDatum[]>(() => {
    if (!workforceSummary?.by_status) return [];
    const order: Array<{ key: string; label: string; color: string }> = [
      { key: 'PRESENT', label: 'Present', color: '#10B981' },
      { key: 'LEAVE', label: 'Approved Leave', color: 'var(--brand-blue)' },
      { key: 'LATE', label: 'Late Check-In', color: 'var(--brand-orange)' },
      { key: 'ABSENT', label: 'Absent', color: '#EF4444' },
    ];
    return order
      .filter(o => workforceSummary.by_status[o.key] !== undefined)
      .map(o => ({
        label: o.label,
        value: workforceSummary.by_status[o.key],
        color: o.color,
      }));
  }, [workforceSummary]);

  const filters: FilterSelectConfig[] = [
    {
      id: 'shift',
      label: 'Shift',
      value: selectedShift,
      options: [
        { label: 'All Shifts', value: 'ALL' },
        { label: 'Shift A', value: 'A' },
        { label: 'Shift B', value: 'B' },
        { label: 'Shift C', value: 'C' },
      ],
      onChange: setSelectedShift,
    },
    {
      id: 'status',
      label: 'Attendance',
      value: selectedStatus,
      options: [
        { label: 'All Statuses', value: 'ALL' },
        { label: 'PRESENT', value: 'PRESENT' },
        { label: 'ABSENT', value: 'ABSENT' },
        { label: 'LEAVE', value: 'LEAVE' },
        { label: 'LATE', value: 'LATE' },
      ],
      onChange: setSelectedStatus,
    },
    {
      id: 'training',
      label: 'Training',
      value: selectedTraining,
      options: [
        { label: 'All Training', value: 'ALL' },
        { label: 'CURRENT', value: 'CURRENT' },
        { label: 'EXPIRED', value: 'EXPIRED' },
      ],
      onChange: setSelectedTraining,
    },
  ];

  const columns: Column<WorkforceAttendanceRecord>[] = [
    {
      key: 'attendance_id',
      header: 'Attendance ID',
      width: '135px',
      sortable: true,
      render: row => (
        <span className="font-mono text-xs font-semibold text-brand-purple">{row.attendance_id}</span>
      ),
    },
    {
      key: 'employee_id',
      header: 'Employee ID',
      width: '120px',
      sortable: true,
      render: row => <span className="font-mono text-xs font-medium text-ink-primary">{row.employee_id}</span>,
    },
    {
      key: 'work_date',
      header: 'Work Date',
      width: '115px',
      sortable: true,
      render: row => <span className="font-mono text-xs text-ink-secondary">{row.work_date}</span>,
    },
    {
      key: 'plant_id',
      header: 'Plant / Shift',
      width: '135px',
      render: row => (
        <span className="font-mono text-xs text-ink-primary">
          {row.plant_id} • Shift {row.shift_id}
        </span>
      ),
    },
    {
      key: 'attendance_status',
      header: 'Attendance',
      width: '115px',
      render: row => <StatusBadge status={row.attendance_status} />,
    },
    {
      key: 'actual_hours',
      header: 'Actual / Sched (h)',
      width: '140px',
      align: 'right',
      render: row => (
        <span className="font-mono text-xs tabular-nums">
          <strong className="text-ink-primary">{Number(row.actual_hours).toFixed(1)}</strong>
          <span className="text-ink-muted"> / {row.scheduled_hours}h</span>
        </span>
      ),
    },
    {
      key: 'overtime_hours',
      header: 'Overtime',
      width: '95px',
      align: 'right',
      render: row => (
        <span className="font-mono text-xs text-ink-secondary tabular-nums">
          {Number(row.overtime_hours).toFixed(1)}h
        </span>
      ),
    },
    {
      key: 'training_compliance',
      header: 'Training',
      width: '120px',
      align: 'right',
      render: row => <StatusBadge status={row.training_compliance} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workforce & Shift Exposure"
        description={`Shift roster coverage, scheduled vs actual exposure hours, and overtime telemetry for ${facilityId === 'ALL' ? 'all facilities' : facilityId}.`}
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Workforce & Shifts', active: true },
        ]}
        meta={
          workforceSummary && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-brand-blue-soft text-brand-blue border border-brand-blue/30">
              {workforceSummary.total_records.toLocaleString('en-IN')} Shift Logs
            </span>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      {/* Summary KPIs strictly from /workforce/summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KPIStatCard
          label="Total Shift Records"
          value={workforceSummary ? workforceSummary.total_records.toLocaleString('en-IN') : null}
          accent="purple"
          icon={Users}
          isLoading={isLoading && !workforceSummary}
          footnote="Verified Neon attendance table"
          sourceTag="SQL Count"
        />

        <KPIStatCard
          label="Actual Work Hours"
          value={workforceSummary ? workforceSummary.total_actual_hours.toLocaleString('en-IN') : null}
          unit="hrs"
          accent="blue"
          icon={Clock}
          isLoading={isLoading && !workforceSummary}
          footnote="Aggregate labor exposure"
          sourceTag="Hours"
        />

        <KPIStatCard
          label="Recorded Overtime"
          value={workforceSummary ? workforceSummary.total_overtime_hours.toLocaleString('en-IN') : null}
          unit="hrs"
          accent="orange"
          icon={Timer}
          isLoading={isLoading && !workforceSummary}
          footnote={
            workforceSummary?.by_skill_match?.GAP !== undefined
              ? `${workforceSummary.by_skill_match.GAP} skill-gap shifts`
              : undefined
          }
          sourceTag="Overtime"
        />

        <KPIStatCard
          label="Training Current"
          value={overviewSummary ? `${overviewSummary.training_compliance_rate}%` : null}
          accent="emerald"
          icon={Award}
          isLoading={isLoading && !overviewSummary}
          footnote={
            workforceSummary?.by_training_compliance?.CURRENT !== undefined
              ? `${workforceSummary.by_training_compliance.CURRENT.toLocaleString('en-IN')} current rows`
              : undefined
          }
          sourceTag="Verified"
        />
      </div>

      {/* Visualizations: Shift Volume vs Attendance Posture */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <AnalyticsChart
          className="lg:col-span-5"
          title="Shift Assignment Distribution"
          subtitle="Verified workforce records across Shifts A, B, and C."
          sourceAttribution="ehs_core.fact_workforce_attendance"
          icon={Users}
          variant="bar-vertical"
          data={shiftChartData}
          unit="logs"
          isLoading={isLoading && !workforceSummary}
        />

        <AnalyticsChart
          className="lg:col-span-7"
          title="Attendance Status Breakdown"
          subtitle="Full-table aggregation across Present, Leave, Late, and Absent records."
          sourceAttribution="ehs_core.fact_workforce_attendance"
          icon={Clock}
          variant="stacked-bar"
          data={attendanceStatusData}
          totalLabel={
            workforceSummary
              ? `${workforceSummary.total_records.toLocaleString('en-IN')} Total`
              : undefined
          }
          isLoading={isLoading && !workforceSummary}
        />
      </div>

      <FilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by Attendance ID, Employee ID, or Work Date..."
        filters={filters}
        totalRecords={rawAttendance.length}
        filteredCount={filteredAttendance.length}
        onResetFilters={() => {
          setSearchTerm('');
          setSelectedShift('ALL');
          setSelectedStatus('ALL');
          setSelectedTraining('ALL');
        }}
      />

      <DataTable
        columns={columns}
        data={filteredAttendance}
        keyExtractor={row => row.attendance_id}
        isLoading={isLoading && !rawAttendance.length}
        pageSize={25}
        emptyTitle="No Workforce Records Match"
        emptyDescription="No attendance rows match the current shift, status, or search filter."
      />
    </div>
  );
};
