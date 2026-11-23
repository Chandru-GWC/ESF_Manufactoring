import React, { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { KPIStatCard } from '../components/ui/KPIStatCard';
import { FilterToolbar, FilterSelectConfig } from '../components/ui/FilterToolbar';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { AnalyticsChart, ChartDatum } from '../components/ui/AnalyticsChart';
import { ErrorState } from '../components/ui/ErrorState';
import { Wrench, AlertTriangle, Clock, CheckCircle2, Info } from 'lucide-react';
import { useEhs } from '../context/EhsContext';
import { MaintenanceWorkOrderRecord, RouteFilterPreset } from '../types/ehs';

interface MaintenanceSafetyViewProps {
  preset?: RouteFilterPreset | null;
}

export const MaintenanceSafetyView: React.FC<MaintenanceSafetyViewProps> = ({ preset }) => {
  const { rawMaintenance, maintenanceSummary, isLoading, error, reloadAllData, facilityId } = useEhs();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>(preset?.maintenancePriority ?? 'ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<MaintenanceWorkOrderRecord | null>(null);

  useEffect(() => {
    if (!preset) return;
    if (preset.maintenancePriority !== undefined) {
      setSelectedPriority(preset.maintenancePriority);
      setSearchTerm('');
      setSelectedStatus('ALL');
      setSelectedType('ALL');
    }
  }, [preset]);

  const filteredOrders = useMemo(() => {
    return rawMaintenance.filter(m => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        m.work_order_id.toLowerCase().includes(q) ||
        m.machine_id.toLowerCase().includes(q) ||
        m.failure_mode.toLowerCase().includes(q) ||
        m.technician_id.toLowerCase().includes(q);

      const matchesPriority = selectedPriority === 'ALL' || m.priority === selectedPriority;
      const matchesStatus = selectedStatus === 'ALL' || m.status === selectedStatus;
      const matchesType = selectedType === 'ALL' || m.maintenance_type === selectedType;

      return matchesSearch && matchesPriority && matchesStatus && matchesType;
    });
  }, [rawMaintenance, searchTerm, selectedPriority, selectedStatus, selectedType]);

  const failureModeData = useMemo<ChartDatum[]>(() => {
    if (!maintenanceSummary?.by_failure_mode) return [];
    return Object.entries(maintenanceSummary.by_failure_mode)
      .sort((a, b) => b[1] - a[1])
      .map(([mode, count]) => ({
        label: mode.replace(/_/g, ' '),
        value: count,
        color: 'var(--brand-orange)',
      }));
  }, [maintenanceSummary]);

  const priorityChartData = useMemo<ChartDatum[]>(() => {
    if (!maintenanceSummary?.by_priority) return [];
    return [
      { label: 'P1 Critical', value: maintenanceSummary.by_priority.P1 ?? 0, color: '#EF4444' },
      { label: 'P2 High', value: maintenanceSummary.by_priority.P2 ?? 0, color: 'var(--brand-orange)' },
      { label: 'P3 Routine', value: maintenanceSummary.by_priority.P3 ?? 0, color: 'var(--brand-blue)' },
    ];
  }, [maintenanceSummary]);

  const filters: FilterSelectConfig[] = [
    {
      id: 'priority',
      label: 'Priority',
      value: selectedPriority,
      options: [
        { label: 'All Priorities', value: 'ALL' },
        { label: 'P1', value: 'P1' },
        { label: 'P2', value: 'P2' },
        { label: 'P3', value: 'P3' },
      ],
      onChange: setSelectedPriority,
    },
    {
      id: 'type',
      label: 'Type',
      value: selectedType,
      options: [
        { label: 'All Types', value: 'ALL' },
        { label: 'CORRECTIVE', value: 'CORRECTIVE' },
        { label: 'PREVENTIVE', value: 'PREVENTIVE' },
        { label: 'PREDICTIVE', value: 'PREDICTIVE' },
      ],
      onChange: setSelectedType,
    },
    {
      id: 'status',
      label: 'Status',
      value: selectedStatus,
      options: [
        { label: 'All Statuses', value: 'ALL' },
        { label: 'PLANNED', value: 'PLANNED' },
        { label: 'IN_PROGRESS', value: 'IN_PROGRESS' },
        { label: 'COMPLETED', value: 'COMPLETED' },
      ],
      onChange: setSelectedStatus,
    },
  ];

  const columns: Column<MaintenanceWorkOrderRecord>[] = [
    {
      key: 'work_order_id',
      header: 'Work Order',
      width: '125px',
      sortable: true,
      render: row => (
        <span className="font-mono text-xs font-semibold text-brand-purple">{row.work_order_id}</span>
      ),
    },
    {
      key: 'machine_id',
      header: 'Machine ID',
      width: '120px',
      sortable: true,
      render: row => <span className="font-mono text-xs font-bold text-ink-primary">{row.machine_id}</span>,
    },
    {
      key: 'maintenance_type',
      header: 'Type & Failure Mode',
      render: row => (
        <div>
          <p className="text-xs font-medium text-ink-primary">{row.maintenance_type}</p>
          <span className="text-[10px] font-mono text-ink-muted">
            Mode: {row.failure_mode.replace(/_/g, ' ')}
          </span>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      width: '90px',
      sortable: true,
      render: row => (
        <span
          className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold border ${
            row.priority === 'P1'
              ? 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border'
              : row.priority === 'P2'
              ? 'bg-severity-high-bg text-severity-high-text border-severity-high-border'
              : 'bg-canvas-subtle text-ink-secondary border-line-default'
          }`}
        >
          {row.priority}
        </span>
      ),
    },
    {
      key: 'technician_id',
      header: 'Technician',
      width: '115px',
      render: row => <span className="font-mono text-xs text-ink-secondary">{row.technician_id}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      sortable: true,
      render: row => (
        <StatusBadge
          status={
            row.status === 'COMPLETED'
              ? 'Closed'
              : row.status === 'IN_PROGRESS'
              ? 'In Progress'
              : 'Planned'
          }
        />
      ),
    },
    {
      key: 'downtime_avoided_estimate_min',
      header: 'Est. Downtime Saved',
      width: '155px',
      align: 'right',
      sortable: true,
      render: row => (
        <span className="font-mono text-xs font-semibold text-severity-success-text tabular-nums">
          {row.downtime_avoided_estimate_min} min
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Maintenance & Equipment Safety"
        description={`Preventive, corrective, and predictive machine work orders for ${facilityId === 'ALL' ? 'all facilities' : facilityId} from fact_maintenance_work_order.`}
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Maintenance & Safety', active: true },
        ]}
        meta={
          maintenanceSummary && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-brand-purple-soft text-brand-purple border border-brand-purple/30">
              {maintenanceSummary.total_work_orders} Work Orders
            </span>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      {/* KPI Strip strictly from /maintenance/summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KPIStatCard
          label="Total Work Orders"
          value={maintenanceSummary?.total_work_orders}
          accent="purple"
          icon={Wrench}
          isLoading={isLoading && !maintenanceSummary}
          footnote="fact_maintenance_work_order"
          sourceTag="SQL"
        />

        <KPIStatCard
          label="P1 Priority Orders"
          value={maintenanceSummary?.by_priority?.P1}
          accent="rose"
          icon={AlertTriangle}
          isLoading={isLoading && !maintenanceSummary}
          footnote="Highest risk tier"
          sourceTag="P1"
        />

        <KPIStatCard
          label="In Progress / Planned"
          value={
            maintenanceSummary
              ? (maintenanceSummary.by_status.IN_PROGRESS ?? 0) +
                (maintenanceSummary.by_status.PLANNED ?? 0)
              : null
          }
          accent="orange"
          icon={Clock}
          isLoading={isLoading && !maintenanceSummary}
          footnote={
            maintenanceSummary
              ? `${maintenanceSummary.by_status.COMPLETED ?? 0} completed`
              : undefined
          }
          sourceTag="Queue"
        />

        <KPIStatCard
          label="Est. Downtime Avoided"
          value={
            maintenanceSummary
              ? maintenanceSummary.total_downtime_avoided_min.toLocaleString('en-IN')
              : null
          }
          unit="min"
          accent="emerald"
          icon={CheckCircle2}
          isLoading={isLoading && !maintenanceSummary}
          footnote={
            maintenanceSummary
              ? `~${(maintenanceSummary.total_downtime_avoided_min / 60).toFixed(1)} hrs saved`
              : undefined
          }
          sourceTag="Estimate"
        />
      </div>

      {/* Charts: Failure Modes + Priority Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <AnalyticsChart
          className="lg:col-span-7"
          title="Work Orders by Failure Mode"
          subtitle="Ranked equipment failure classifications recorded in Neon."
          sourceAttribution="ehs_core.fact_maintenance_work_order"
          icon={Wrench}
          variant="bar-horizontal"
          data={failureModeData}
          unit="orders"
          isLoading={isLoading && !maintenanceSummary}
        />

        <AnalyticsChart
          className="lg:col-span-5"
          title="Priority Tier Distribution"
          subtitle="P1, P2, and P3 maintenance priority mix."
          sourceAttribution="ehs_core.fact_maintenance_work_order"
          icon={AlertTriangle}
          variant="stacked-bar"
          data={priorityChartData}
          totalLabel={
            maintenanceSummary ? `${maintenanceSummary.total_work_orders} Orders` : undefined
          }
          isLoading={isLoading && !maintenanceSummary}
        />
      </div>

      {/* Explicit Schema Integrity Note (per Data Dictionary Task 3) */}
      <div className="px-4 py-2.5 rounded-lg border border-line-subtle bg-canvas-subtle text-[11px] text-ink-secondary flex items-center gap-2">
        <Info className="w-4 h-4 text-brand-blue shrink-0" />
        <span>
          <strong>Schema Boundary:</strong> Work orders track machine maintenance and nullable <code className="font-mono text-ink-primary">actual_start</code> timestamps; permit-to-work (<code className="font-mono text-ink-primary">permit_id</code>) joins are not assumed in Neon until confirmed by data engineering.
        </span>
      </div>

      <FilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by Work Order ID, Machine ID, Failure Mode, Technician..."
        filters={filters}
        totalRecords={rawMaintenance.length}
        filteredCount={filteredOrders.length}
        onResetFilters={() => {
          setSearchTerm('');
          setSelectedPriority('ALL');
          setSelectedType('ALL');
          setSelectedStatus('ALL');
        }}
      />

      <DataTable
        columns={columns}
        data={filteredOrders}
        keyExtractor={row => row.work_order_id}
        isLoading={isLoading && !rawMaintenance.length}
        onRowClick={row => setSelectedOrder(row)}
        pageSize={25}
        emptyTitle="No Work Orders Found"
        emptyDescription="No maintenance work orders match the active filters."
      />

      <DetailDrawer
        isOpen={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? selectedOrder.work_order_id : 'Work Order Details'}
        subtitle={selectedOrder ? `${selectedOrder.machine_id} • ${selectedOrder.plant_id}` : undefined}
        badge={
          selectedOrder ? (
            <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-brand-purple-soft text-brand-purple border border-brand-purple/30">
              {selectedOrder.priority}
            </span>
          ) : undefined
        }
      >
        {selectedOrder && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-canvas-subtle border border-line-subtle">
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Maintenance Type</span>
                <p className="font-semibold text-ink-primary mt-0.5">{selectedOrder.maintenance_type}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Failure Mode</span>
                <p className="font-semibold text-ink-primary mt-0.5">{selectedOrder.failure_mode.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Assigned Technician</span>
                <p className="font-mono font-semibold text-ink-primary mt-0.5">{selectedOrder.technician_id}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Est. Downtime Avoided</span>
                <p className="font-mono font-semibold text-severity-success-text mt-0.5">
                  {selectedOrder.downtime_avoided_estimate_min} min
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Status</span>
                <StatusBadge status={selectedOrder.status === 'COMPLETED' ? 'Closed' : selectedOrder.status === 'IN_PROGRESS' ? 'In Progress' : 'Planned'} />
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Created Timestamp</span>
                <span className="font-mono text-ink-primary">{selectedOrder.created_ts}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Planned Start</span>
                <span className="font-mono text-ink-primary">{selectedOrder.planned_start}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Actual Start (Nullable)</span>
                <span className="font-mono text-ink-primary">
                  {selectedOrder.actual_start || '— (Not yet started)'}
                </span>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
