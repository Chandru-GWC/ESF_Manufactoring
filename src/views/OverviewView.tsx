import React, { useMemo, useState } from 'react';
import {
  Flame,
  AlertOctagon,
  CheckSquare,
  Clock,
  TrendingDown,
  Activity,
  ShieldCheck,
  Building2,
  ArrowRight,
  Wrench,
  CalendarRange,
  Box,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { KPIStatCard } from '../components/ui/KPIStatCard';
import { AnalyticsChart, ChartDatum } from '../components/ui/AnalyticsChart';
import { DataLineagePanel } from '../components/ui/DataLineagePanel';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RiskBadge } from '../components/ui/RiskBadge';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { ErrorState } from '../components/ui/ErrorState';
import { AlertPanel } from '../components/ui/AlertPanel';
import { useEhs } from '../context/EhsContext';
import { EhsEventRecord, NavSection, RouteFilterPreset } from '../types/ehs';

interface OverviewViewProps {
  onOpenIngestModal: () => void;
  onNavigate: (section: NavSection, preset?: Omit<RouteFilterPreset, 'token'>) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onOpenIngestModal,
  onNavigate,
}) => {
  const {
    overviewSummary,
    eventSummary,
    workforceSummary,
    maintenanceSummary,
    rawEvents,
    hazards,
    facilityName,
    facilityId,
    isLoading,
    error,
    reloadAllData,
  } = useEhs();

  const [selectedEvent, setSelectedEvent] = useState<EhsEventRecord | null>(null);

  const criticalOpenCount = useMemo(
    () => hazards.filter(h => h.severity === 'critical' && h.status === 'Open').length,
    [hazards]
  );

  const totalVerifiedRecords = overviewSummary
    ? overviewSummary.total_ehs_events +
      overviewSummary.total_workforce_records +
      overviewSummary.total_maintenance_work_orders
    : null;

  const ltiCount = useMemo(
    () => rawEvents.filter(e => e.lost_time_injury).length,
    [rawEvents]
  );

  const closedPct = useMemo(() => {
    if (!overviewSummary || overviewSummary.total_ehs_events === 0) return null;
    return Math.round(
      (overviewSummary.closed_actions_count / overviewSummary.total_ehs_events) * 100
    );
  }, [overviewSummary]);

  // Weekly event time-series strictly computed from rawEvents timestamps
  const weeklyTrendData = useMemo<ChartDatum[]>(() => {
    if (!rawEvents.length) return [];
    const buckets: Record<string, { total: number; highCrit: number }> = {};

    rawEvents.forEach(evt => {
      const dateStr = evt.event_ts.slice(0, 10);
      const dt = new Date(dateStr + 'T00:00:00Z');
      if (Number.isNaN(dt.getTime())) return;
      const day = dt.getUTCDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      dt.setUTCDate(dt.getUTCDate() + diffToMonday);
      const weekKey = dt.toISOString().slice(0, 10);

      if (!buckets[weekKey]) {
        buckets[weekKey] = { total: 0, highCrit: 0 };
      }
      buckets[weekKey].total += 1;
      if (evt.risk_severity === 'CRITICAL' || evt.risk_severity === 'HIGH') {
        buckets[weekKey].highCrit += 1;
      }
    });

    return Object.entries(buckets)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, counts]) => ({
        label: week.slice(5), // MM-DD
        value: counts.total,
        secondaryValue: counts.highCrit,
      }));
  }, [rawEvents]);

  // Area distribution strictly from /api/v1/events/summary
  const areaChartData = useMemo<ChartDatum[]>(() => {
    if (!eventSummary?.by_area) return [];
    return Object.entries(eventSummary.by_area)
      .sort((a, b) => b[1] - a[1])
      .map(([area, count]) => ({
        label: area.replace(/_/g, ' '),
        value: count,
        color: 'var(--brand-purple)',
      }));
  }, [eventSummary]);

  // Maintenance Priority Breakdown strictly from /api/v1/analytics/maintenance/summary
  const maintenancePriorityData = useMemo<ChartDatum[]>(() => {
    if (!maintenanceSummary?.by_priority) return [];
    const p1 = maintenanceSummary.by_priority.P1 ?? 0;
    const p2 = maintenanceSummary.by_priority.P2 ?? 0;
    const p3 = maintenanceSummary.by_priority.P3 ?? 0;
    return [
      { label: 'P1 Critical', value: p1, color: '#EF4444' },
      { label: 'P2 High', value: p2, color: 'var(--brand-orange)' },
      { label: 'P3 Standard', value: p3, color: 'var(--brand-blue)' },
    ];
  }, [maintenanceSummary]);

  const severityCounts = eventSummary?.by_severity ?? null;

  const streamColumns: Column<EhsEventRecord>[] = [
    {
      key: 'ehs_event_id',
      header: 'Event ID',
      width: '120px',
      sortable: true,
      render: row => (
        <span className="font-mono text-xs font-semibold text-brand-purple">
          {row.ehs_event_id}
        </span>
      ),
    },
    {
      key: 'event_type',
      header: 'Type',
      width: '155px',
      render: row => (
        <span className="font-medium text-xs text-ink-primary">
          {row.event_type.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'hazard_category',
      header: 'Hazard Category',
      width: '140px',
      render: row => (
        <span className="font-mono text-[11px] text-ink-secondary">
          {row.hazard_category.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'area',
      header: 'Area & Plant',
      width: '175px',
      render: row => (
        <span className="text-xs">
          <strong className="font-medium text-ink-primary">{row.area}</strong>{' '}
          <span className="font-mono text-[11px] text-ink-muted">({row.plant_id})</span>
        </span>
      ),
    },
    {
      key: 'shift_id',
      header: 'Shift',
      width: '90px',
      render: row => (
        <span className="font-mono text-xs font-semibold text-ink-secondary">
          Shift {row.shift_id}
        </span>
      ),
    },
    {
      key: 'risk_severity',
      header: 'Severity',
      width: '115px',
      render: row => <RiskBadge severity={row.risk_severity} />,
    },
    {
      key: 'action_status',
      header: 'Action Status',
      width: '130px',
      render: row => (
        <StatusBadge
          status={
            row.action_status === 'CLOSED'
              ? 'Closed'
              : row.action_status === 'IN_PROGRESS'
              ? 'In Progress'
              : 'Open'
          }
        />
      ),
    },
    {
      key: 'action_owner',
      header: 'Owner',
      width: '110px',
      align: 'right',
      render: row => (
        <span className="font-mono text-[11px] text-ink-muted">
          {row.action_owner || 'Unassigned'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Single Canonical PageHeader (No Duplicate Breadcrumb) */}
      <PageHeader
        title="Safety Operations Command Center"
        description={`Operational safety intelligence for ${facilityName}. Every KPI, chart, and table row resolves directly from Neon PostgreSQL.`}
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Command Overview', active: true },
        ]}
        actions={
          <div className="px-3 py-1.5 rounded-lg border border-line-subtle bg-canvas-surface shadow-sm-subtle flex items-center gap-2 text-xs">
            <Building2 className="w-3.5 h-3.5 text-brand-purple shrink-0" />
            <span className="font-semibold text-ink-primary font-mono">{facilityId}</span>
            <span className="text-ink-disabled">|</span>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-severity-success-dot" />
            </span>
            <span className="text-severity-success-text font-mono text-[11px] font-semibold whitespace-nowrap tabular-nums">
              {totalVerifiedRecords !== null
                ? `${totalVerifiedRecords.toLocaleString('en-IN')} Verified`
                : 'Connecting...'}
            </span>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      {!isLoading && !error && (
        <AlertPanel
          title="Critical Uncontrolled Hazards"
          count={criticalOpenCount}
          message={`${criticalOpenCount} critical-severity hazard observations remain in OPEN status and require field verification.`}
          actionText="Filter Critical Open"
          onAction={() =>
            onNavigate('hazards', {
              hazardSeverity: 'CRITICAL',
              hazardStatus: 'OPEN',
              hazardSearch: '',
              hazardCategory: 'ALL',
            })
          }
        />
      )}

      {/* 2. Executive KPI Telemetry Strip (6 Real-Data Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <KPIStatCard
          label="Work Hours"
          value={
            overviewSummary
              ? overviewSummary.total_actual_work_hours.toLocaleString('en-IN')
              : null
          }
          unit="hrs"
          accent="sky"
          icon={Clock}
          isLoading={isLoading && !overviewSummary}
          footnote={
            overviewSummary
              ? `${overviewSummary.total_workforce_records.toLocaleString('en-IN')} logs`
              : undefined
          }
          sourceTag="Workforce"
          onClick={() => onNavigate('workforce-shifts')}
        />

        <KPIStatCard
          label="Hazards"
          value={overviewSummary?.hazards_count}
          accent="orange"
          icon={Flame}
          isLoading={isLoading && !overviewSummary}
          footnote="Field observations"
          sourceTag="Events"
          onClick={() => onNavigate('hazards')}
        />

        <KPIStatCard
          label="Near Misses"
          value={overviewSummary?.near_miss_count}
          accent="blue"
          icon={TrendingDown}
          isLoading={isLoading && !overviewSummary}
          footnote="Leading signals"
          sourceTag="Events"
          onClick={() => onNavigate('incidents')}
        />

        <KPIStatCard
          label="Incidents"
          value={overviewSummary?.incidents_count}
          accent="purple"
          icon={AlertOctagon}
          isLoading={isLoading && !overviewSummary}
          footnote={`${ltiCount} LTI recorded`}
          sourceTag="First Aid"
          onClick={() => onNavigate('incidents')}
        />

        <KPIStatCard
          label="Open CAPA"
          value={overviewSummary?.open_actions_count}
          unit={overviewSummary ? `/ ${overviewSummary.total_ehs_events}` : undefined}
          accent="amber"
          icon={CheckSquare}
          isLoading={isLoading && !overviewSummary}
          footnote={
            closedPct !== null && overviewSummary
              ? `${overviewSummary.closed_actions_count} closed (${closedPct}%)`
              : undefined
          }
          sourceTag="CAPA"
          onClick={() => onNavigate('actions', { actionStatus: 'OPEN' })}
        />

        <KPIStatCard
          label="Training Rate"
          value={
            overviewSummary ? `${overviewSummary.training_compliance_rate}%` : null
          }
          accent="emerald"
          icon={ShieldCheck}
          isLoading={isLoading && !overviewSummary}
          footnote={
            workforceSummary?.by_training_compliance?.CURRENT !== undefined
              ? `${workforceSummary.by_training_compliance.CURRENT.toLocaleString('en-IN')} current`
              : undefined
          }
          sourceTag="Compliance"
          onClick={() => onNavigate('training')}
        />
      </div>

      {/* 3. Analytics Row 1: Weekly Event Trend (Area Chart) + Area Density (Horizontal Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <AnalyticsChart
          className="lg:col-span-7"
          title="Weekly EHS Event Trend"
          subtitle="Weekly safety event volume vs High/Critical risk subset derived from event_ts timestamps."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={CalendarRange}
          variant="area"
          data={weeklyTrendData}
          primaryLabel="Total Events"
          secondaryLabel="Critical & High"
          primaryColor="var(--brand-purple)"
          secondaryColor="var(--brand-orange)"
          unit="events"
          totalLabel={
            overviewSummary ? `${overviewSummary.total_ehs_events} total` : undefined
          }
          isLoading={isLoading && !rawEvents.length}
          error={error}
        />

        <AnalyticsChart
          className="lg:col-span-5"
          title="Event Density by Plant Area"
          subtitle="Ranked distribution across operational manufacturing zones."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={Activity}
          variant="bar-horizontal"
          data={areaChartData}
          unit="events"
          totalLabel={`${areaChartData.length} Zones`}
          isLoading={isLoading && !eventSummary}
          error={error}
        />
      </div>

      {/* 4. Analytics Row 2: Severity Matrix + Maintenance Priority Composition + Ingestion Lineage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Risk Severity Matrix */}
        <section className="lg:col-span-4 p-5 rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line-subtle">
            <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-brand-orange shrink-0" />
              <span>Risk Severity Matrix</span>
            </h3>
            <span className="text-[11px] font-mono text-ink-muted font-semibold tabular-nums">
              {eventSummary ? `${eventSummary.total_events} Classified` : '—'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onNavigate('risks', { riskSeverity: 'CRITICAL' })}
              className="text-left p-3.5 rounded-lg border border-severity-critical-border/60 bg-severity-critical-bg/50 hover:border-severity-critical-border transition-colors focus-ring"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-severity-critical-dot" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-severity-critical-text">
                  Critical
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-ink-primary mt-1.5 tabular-nums">
                {severityCounts ? severityCounts.CRITICAL ?? 0 : '—'}
              </div>
              <p className="text-[10px] text-ink-muted mt-0.5">Immediate intervention</p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('risks', { riskSeverity: 'HIGH' })}
              className="text-left p-3.5 rounded-lg border border-severity-high-border/60 bg-severity-high-bg/50 hover:border-severity-high-border transition-colors focus-ring"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-severity-high-dot" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-severity-high-text">
                  High
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-ink-primary mt-1.5 tabular-nums">
                {severityCounts ? severityCounts.HIGH ?? 0 : '—'}
              </div>
              <p className="text-[10px] text-ink-muted mt-0.5">Priority CAPA</p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('risks', { riskSeverity: 'MEDIUM' })}
              className="text-left p-3.5 rounded-lg border border-severity-warning-border/60 bg-severity-warning-bg/50 hover:border-severity-warning-border transition-colors focus-ring"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-severity-warning-dot" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-severity-warning-text">
                  Medium
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-ink-primary mt-1.5 tabular-nums">
                {severityCounts ? severityCounts.MEDIUM ?? 0 : '—'}
              </div>
              <p className="text-[10px] text-ink-muted mt-0.5">Standard controls</p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('risks', { riskSeverity: 'LOW' })}
              className="text-left p-3.5 rounded-lg border border-severity-success-border/60 bg-severity-success-bg/50 hover:border-severity-success-border transition-colors focus-ring"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-severity-success-dot" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-severity-success-text">
                  Low
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-ink-primary mt-1.5 tabular-nums">
                {severityCounts ? severityCounts.LOW ?? 0 : '—'}
              </div>
              <p className="text-[10px] text-ink-muted mt-0.5">Routine monitoring</p>
            </button>
          </div>
        </section>

        {/* Maintenance Work Order Priority Composition */}
        <AnalyticsChart
          className="lg:col-span-4"
          title="Maintenance Priority Posture"
          subtitle={
            maintenanceSummary
              ? `${maintenanceSummary.total_downtime_avoided_min.toLocaleString('en-IN')} min estimated downtime avoided`
              : 'Loading maintenance work order distribution'
          }
          sourceAttribution="ehs_core.fact_maintenance_work_order"
          icon={Wrench}
          variant="stacked-bar"
          data={maintenancePriorityData}
          totalLabel={
            maintenanceSummary
              ? `${maintenanceSummary.total_work_orders} Orders`
              : undefined
          }
          isLoading={isLoading && !maintenanceSummary}
          error={error}
          onSelectDatum={datum =>
            onNavigate('maintenance-safety', {
              maintenancePriority: datum.label.split(' ')[0],
            })
          }
        />

        {/* Verified Ingestion Lineage */}
        <div className="lg:col-span-4">
          <DataLineagePanel onOpenModal={onOpenIngestModal} />
        </div>
      </div>

      {/* 5. Conceptual 3D Digital Twin Quick Entry Strip */}
      <section className="p-5 rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-brand-purple-soft text-brand-purple border border-brand-purple/25 shrink-0">
            <Box className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-ink-primary">
                EHS Industrial Digital Twin (3D Zone Explorer)
              </h3>
              <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-canvas-subtle border border-line-subtle text-ink-secondary">
                Conceptual 6-Zone View
              </span>
            </div>
            <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
              Inspect area-level hazard, incident, and open CAPA density interactively across Warehouse, SMT, Quality, Packaging, Test, and Final Assembly zones.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {areaChartData.slice(0, 3).map(zone => (
            <span
              key={zone.label}
              className="px-2.5 py-1 rounded-lg bg-canvas-subtle border border-line-subtle font-mono text-[11px] text-ink-secondary"
            >
              {zone.label}: <strong className="text-ink-primary">{zone.value}</strong>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onNavigate('digital-twin')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-purple hover:bg-brand-hover text-white text-xs font-semibold transition-colors shadow-sm-subtle focus-ring"
          >
            <span>Open 3D Twin</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* 6. Bottom Section: Live EHS Operational Event Stream */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-ink-primary">
              Live EHS Operational Event Stream
            </h3>
            <p className="text-xs text-ink-muted">
              Latest records from <code className="font-mono text-brand-purple">ehs_core.fact_ehs_event</code> • Click any row to inspect details
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('hazards')}
            className="text-xs font-semibold text-brand-purple hover:underline inline-flex items-center gap-1 self-start sm:self-auto group focus-ring rounded"
          >
            <span>Open Hazard Register</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <DataTable
          columns={streamColumns}
          data={rawEvents}
          keyExtractor={row => row.ehs_event_id}
          onRowClick={row => setSelectedEvent(row)}
          isLoading={isLoading && !rawEvents.length}
          pageSize={8}
          emptyTitle="No EHS Events Found"
          emptyDescription="No events returned from Neon PostgreSQL for the active plant filter."
        />
      </section>

      {/* Row Inspector Drawer */}
      <DetailDrawer
        isOpen={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent ? selectedEvent.ehs_event_id : 'Event Details'}
        subtitle={selectedEvent ? `${selectedEvent.plant_id} • ${selectedEvent.area} • Shift ${selectedEvent.shift_id}` : undefined}
        badge={selectedEvent ? <RiskBadge severity={selectedEvent.risk_severity} /> : undefined}
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-canvas-subtle border border-line-subtle">
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Event Type</span>
                <p className="font-semibold text-ink-primary mt-0.5">{selectedEvent.event_type.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Hazard Category</span>
                <p className="font-semibold text-ink-primary mt-0.5">{selectedEvent.hazard_category.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Action Owner</span>
                <p className="font-mono font-semibold text-ink-primary mt-0.5">{selectedEvent.action_owner || 'Unassigned'}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Permit ID</span>
                <p className="font-mono font-semibold text-brand-purple mt-0.5">{selectedEvent.permit_id}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Action Status</span>
                <StatusBadge
                  status={
                    selectedEvent.action_status === 'CLOSED'
                      ? 'Closed'
                      : selectedEvent.action_status === 'IN_PROGRESS'
                      ? 'In Progress'
                      : 'Open'
                  }
                />
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Lost Time Injury</span>
                <span className="font-mono font-semibold text-ink-primary">
                  {selectedEvent.lost_time_injury ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Event Timestamp</span>
                <span className="font-mono text-ink-primary">{selectedEvent.event_ts}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Due Date</span>
                <span className="font-mono text-ink-primary">{selectedEvent.due_date}</span>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
