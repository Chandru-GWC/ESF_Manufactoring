import React, { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { KPIStatCard } from '../components/ui/KPIStatCard';
import { FilterToolbar, FilterSelectConfig } from '../components/ui/FilterToolbar';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AnalyticsChart, ChartDatum, TrackerSegment } from '../components/ui/AnalyticsChart';
import { ErrorState } from '../components/ui/ErrorState';
import { Award, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { useEhs } from '../context/EhsContext';
import { RouteFilterPreset, WorkforceAttendanceRecord } from '../types/ehs';

interface TrainingComplianceViewProps {
  preset?: RouteFilterPreset | null;
}

export const TrainingComplianceView: React.FC<TrainingComplianceViewProps> = ({ preset }) => {
  const { rawAttendance, workforceSummary, overviewSummary, isLoading, error, reloadAllData, facilityId } = useEhs();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(preset?.trainingStatus ?? 'ALL');
  const [selectedSkill, setSelectedSkill] = useState<string>('ALL');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');

  useEffect(() => {
    if (!preset) return;
    if (preset.trainingStatus !== undefined) {
      setSelectedStatus(preset.trainingStatus);
      setSearchTerm('');
      setSelectedSkill('ALL');
      setSelectedShift('ALL');
    }
  }, [preset]);

  const filteredRecords = useMemo(() => {
    return rawAttendance.filter(r => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        r.employee_id.toLowerCase().includes(q) ||
        r.attendance_id.toLowerCase().includes(q) ||
        r.work_date.toLowerCase().includes(q);

      const matchesStatus = selectedStatus === 'ALL' || r.training_compliance === selectedStatus;
      const matchesSkill = selectedSkill === 'ALL' || r.skill_match === selectedSkill;
      const matchesShift = selectedShift === 'ALL' || r.shift_id === selectedShift;

      return matchesSearch && matchesStatus && matchesSkill && matchesShift;
    });
  }, [rawAttendance, searchTerm, selectedStatus, selectedSkill, selectedShift]);

  const currentCount = workforceSummary?.by_training_compliance?.CURRENT ?? null;
  const expiredCount = workforceSummary?.by_training_compliance?.EXPIRED ?? null;
  const totalCount = workforceSummary?.total_records ?? null;

  // Proportional 40-segment tracker directly reflecting CURRENT vs EXPIRED share
  const complianceTrackerSegments = useMemo<TrackerSegment[]>(() => {
    if (!totalCount || currentCount === null || expiredCount === null) return [];
    const totalBlocks = 40;
    const expiredBlocks = Math.max(
      expiredCount > 0 ? 1 : 0,
      Math.round((expiredCount / totalCount) * totalBlocks)
    );
    const currentBlocks = totalBlocks - expiredBlocks;

    const segs: TrackerSegment[] = [];
    for (let i = 0; i < currentBlocks; i++) {
      segs.push({
        id: `cur-${i}`,
        status: 'success',
        tooltip: `CURRENT (${currentCount.toLocaleString('en-IN')} rows)`,
      });
    }
    for (let i = 0; i < expiredBlocks; i++) {
      segs.push({
        id: `exp-${i}`,
        status: 'critical',
        tooltip: `EXPIRED (${expiredCount.toLocaleString('en-IN')} rows)`,
      });
    }
    return segs;
  }, [totalCount, currentCount, expiredCount]);

  const skillMatchData = useMemo<ChartDatum[]>(() => {
    if (!workforceSummary?.by_skill_match) return [];
    return [
      { label: 'Skill Matched', value: workforceSummary.by_skill_match.MATCHED ?? 0, color: '#10B981' },
      { label: 'Skill Gap', value: workforceSummary.by_skill_match.GAP ?? 0, color: 'var(--brand-orange)' },
    ];
  }, [workforceSummary]);

  const filters: FilterSelectConfig[] = [
    {
      id: 'status',
      label: 'Training',
      value: selectedStatus,
      options: [
        { label: 'All Training', value: 'ALL' },
        { label: 'CURRENT', value: 'CURRENT' },
        { label: 'EXPIRED', value: 'EXPIRED' },
      ],
      onChange: setSelectedStatus,
    },
    {
      id: 'skill',
      label: 'Skill Match',
      value: selectedSkill,
      options: [
        { label: 'All Skill States', value: 'ALL' },
        { label: 'MATCHED', value: 'MATCHED' },
        { label: 'GAP', value: 'GAP' },
      ],
      onChange: setSelectedSkill,
    },
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
  ];

  const columns: Column<WorkforceAttendanceRecord>[] = [
    {
      key: 'employee_id',
      header: 'Employee ID',
      width: '125px',
      sortable: true,
      render: row => <span className="font-mono text-xs font-semibold text-brand-purple">{row.employee_id}</span>,
    },
    {
      key: 'work_date',
      header: 'Shift Date & Plant',
      render: row => (
        <div>
          <p className="font-medium text-xs text-ink-primary font-mono">{row.work_date}</p>
          <span className="text-[10px] text-ink-muted font-mono">
            {row.plant_id} • Shift {row.shift_id}
          </span>
        </div>
      ),
    },
    {
      key: 'skill_match',
      header: 'Skill Match',
      width: '125px',
      sortable: true,
      render: row => <StatusBadge status={row.skill_match} />,
    },
    {
      key: 'actual_hours',
      header: 'Actual Hours',
      width: '120px',
      align: 'right',
      render: row => (
        <span className="font-mono text-xs font-semibold text-ink-primary tabular-nums">
          {Number(row.actual_hours).toFixed(1)} hrs
        </span>
      ),
    },
    {
      key: 'training_compliance',
      header: 'Training Status',
      width: '140px',
      align: 'right',
      sortable: true,
      render: row => <StatusBadge status={row.training_compliance} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workforce Training Matrix"
        description={`Training qualification currency (CURRENT vs EXPIRED) and skill-match telemetry from fact_workforce_attendance in ${facilityId === 'ALL' ? 'all facilities' : facilityId}.`}
        breadcrumbs={[
          { label: 'Safety Governance' },
          { label: 'Training Matrix', active: true },
        ]}
        meta={
          overviewSummary && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-severity-success-bg text-severity-success-text border border-severity-success-border">
              {overviewSummary.training_compliance_rate}% Current
            </span>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      {/* KPI Strip strictly from /workforce/summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KPIStatCard
          label="Training Current Rate"
          value={overviewSummary ? `${overviewSummary.training_compliance_rate}%` : null}
          accent="emerald"
          icon={Award}
          isLoading={isLoading && !overviewSummary}
          footnote="CURRENT / total_records"
          sourceTag="SQL Ratio"
        />

        <KPIStatCard
          label="Workforce Logs"
          value={totalCount !== null ? totalCount.toLocaleString('en-IN') : null}
          accent="purple"
          icon={Users}
          isLoading={isLoading && !workforceSummary}
          footnote="Verified attendance rows"
          sourceTag="Scope"
        />

        <KPIStatCard
          label="Current Qualifications"
          value={currentCount !== null ? currentCount.toLocaleString('en-IN') : null}
          accent="blue"
          icon={CheckCircle2}
          isLoading={isLoading && !workforceSummary}
          footnote="training_compliance = CURRENT"
          sourceTag="Current"
        />

        <KPIStatCard
          label="Expired Records"
          value={expiredCount !== null ? expiredCount.toLocaleString('en-IN') : null}
          accent="rose"
          icon={AlertTriangle}
          isLoading={isLoading && !workforceSummary}
          footnote="training_compliance = EXPIRED"
          sourceTag="Action"
          onClick={() => setSelectedStatus('EXPIRED')}
        />
      </div>

      {/* Analytics Row: Compliance Tracker + Skill Alignment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <AnalyticsChart
          className="lg:col-span-6"
          title="Training Qualification Proportion Strip"
          subtitle="40-block proportional ratio derived directly from verified CURRENT vs EXPIRED counts."
          sourceAttribution="ehs_core.fact_workforce_attendance"
          icon={Award}
          variant="tracker"
          trackerData={complianceTrackerSegments}
          totalLabel={
            overviewSummary ? `${overviewSummary.training_compliance_rate}% Current` : undefined
          }
          isLoading={isLoading && !workforceSummary}
        />

        <AnalyticsChart
          className="lg:col-span-6"
          title="Workforce Skill Match Distribution"
          subtitle="MATCHED vs GAP shift assignments recorded across attendance rosters."
          sourceAttribution="ehs_core.fact_workforce_attendance"
          icon={Users}
          variant="stacked-bar"
          data={skillMatchData}
          totalLabel={totalCount !== null ? `${totalCount.toLocaleString('en-IN')} Logs` : undefined}
          isLoading={isLoading && !workforceSummary}
        />
      </div>

      <FilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by Employee ID, Attendance ID, or Work Date..."
        filters={filters}
        totalRecords={rawAttendance.length}
        filteredCount={filteredRecords.length}
        onResetFilters={() => {
          setSearchTerm('');
          setSelectedStatus('ALL');
          setSelectedSkill('ALL');
          setSelectedShift('ALL');
        }}
      />

      <DataTable
        columns={columns}
        data={filteredRecords}
        keyExtractor={row => row.attendance_id}
        isLoading={isLoading && !rawAttendance.length}
        pageSize={25}
        emptyTitle="No Training Records Match"
        emptyDescription="No employee attendance rows match the selected training, skill, or shift filters."
      />
    </div>
  );
};
