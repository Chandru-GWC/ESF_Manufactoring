import React, { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterToolbar, FilterSelectConfig } from '../components/ui/FilterToolbar';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RiskBadge } from '../components/ui/RiskBadge';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { AlertPanel } from '../components/ui/AlertPanel';
import { AnalyticsChart, ChartDatum } from '../components/ui/AnalyticsChart';
import { ErrorState } from '../components/ui/ErrorState';
import { Flame, Layers } from 'lucide-react';
import { useEhs } from '../context/EhsContext';
import { HazardRecord, RouteFilterPreset } from '../types/ehs';

interface HazardMonitoringViewProps {
  preset?: RouteFilterPreset | null;
}

export const HazardMonitoringView: React.FC<HazardMonitoringViewProps> = ({ preset }) => {
  const { hazards, isLoading, error, reloadAllData, facilityId } = useEhs();
  const [searchTerm, setSearchTerm] = useState(preset?.hazardSearch ?? '');
  const [selectedCategory, setSelectedCategory] = useState<string>(preset?.hazardCategory ?? 'ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>(preset?.hazardSeverity ?? 'ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>(preset?.hazardStatus ?? 'ALL');
  const [selectedHazard, setSelectedHazard] = useState<HazardRecord | null>(null);

  useEffect(() => {
    if (!preset) return;
    if (preset.hazardSeverity !== undefined) setSelectedSeverity(preset.hazardSeverity);
    if (preset.hazardStatus !== undefined) setSelectedStatus(preset.hazardStatus);
    if (preset.hazardSearch !== undefined) setSearchTerm(preset.hazardSearch);
    if (preset.hazardCategory !== undefined) setSelectedCategory(preset.hazardCategory);
  }, [preset]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    hazards.forEach(h => set.add(h.category));
    return ['ALL', ...Array.from(set).sort()];
  }, [hazards]);

  const filteredHazards = useMemo(() => {
    return hazards.filter(h => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        h.id.toLowerCase().includes(q) ||
        h.location.toLowerCase().includes(q) ||
        h.title.toLowerCase().includes(q) ||
        h.assignedOwner.toLowerCase().includes(q) ||
        h.permitId.toLowerCase().includes(q);

      const matchesCategory =
        selectedCategory === 'ALL' || h.category === selectedCategory;

      const matchesSeverity =
        selectedSeverity === 'ALL' || h.severity.toUpperCase() === selectedSeverity.toUpperCase();

      const matchesStatus =
        selectedStatus === 'ALL' || h.status.toUpperCase() === selectedStatus.toUpperCase();

      return matchesSearch && matchesCategory && matchesSeverity && matchesStatus;
    });
  }, [hazards, searchTerm, selectedCategory, selectedSeverity, selectedStatus]);

  const criticalOpenCount = useMemo(
    () => hazards.filter(h => h.severity === 'critical' && h.status === 'Open').length,
    [hazards]
  );

  // Category distribution chart strictly from verified HAZARD_OBSERVATION rows
  const categoryChartData = useMemo<ChartDatum[]>(() => {
    const counts: Record<string, number> = {};
    hazards.forEach(h => {
      counts[h.category] = (counts[h.category] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        label,
        value,
        color: 'var(--brand-orange)',
      }));
  }, [hazards]);

  // Control status stacked bar strictly from verified HAZARD_OBSERVATION rows
  const statusChartData = useMemo<ChartDatum[]>(() => {
    const open = hazards.filter(h => h.status === 'Open').length;
    const inProgress = hazards.filter(h => h.status === 'In Progress').length;
    const controlled = hazards.filter(h => h.status === 'Controlled').length;
    return [
      { label: 'Open', value: open, color: '#EF4444' },
      { label: 'In Progress', value: inProgress, color: 'var(--brand-orange)' },
      { label: 'Controlled', value: controlled, color: '#10B981' },
    ];
  }, [hazards]);

  const filters: FilterSelectConfig[] = [
    {
      id: 'category',
      label: 'Category',
      value: selectedCategory,
      options: categories.map(c => ({
        label: c === 'ALL' ? 'All Categories' : c,
        value: c,
      })),
      onChange: setSelectedCategory,
    },
    {
      id: 'severity',
      label: 'Severity',
      value: selectedSeverity,
      options: [
        { label: 'All Severities', value: 'ALL' },
        { label: 'Critical', value: 'CRITICAL' },
        { label: 'High', value: 'HIGH' },
        { label: 'Medium', value: 'WARNING' },
        { label: 'Low', value: 'SUCCESS' },
      ],
      onChange: setSelectedSeverity,
    },
    {
      id: 'status',
      label: 'Status',
      value: selectedStatus,
      options: [
        { label: 'All Statuses', value: 'ALL' },
        { label: 'Open', value: 'OPEN' },
        { label: 'In Progress', value: 'IN PROGRESS' },
        { label: 'Controlled', value: 'CONTROLLED' },
      ],
      onChange: setSelectedStatus,
    },
  ];

  const columns: Column<HazardRecord>[] = [
    {
      key: 'id',
      header: 'Event ID',
      width: '120px',
      sortable: true,
      render: row => (
        <span className="font-mono text-xs font-semibold text-brand-purple">{row.id}</span>
      ),
    },
    {
      key: 'title',
      header: 'Hazard Observation',
      render: row => (
        <div className="max-w-md">
          <p className="font-medium text-xs text-ink-primary line-clamp-1">{row.title}</p>
          <span className="text-[10px] text-ink-muted font-mono">{row.category}</span>
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      width: '115px',
      sortable: true,
      render: row => <RiskBadge severity={row.severity} />,
    },
    {
      key: 'location',
      header: 'Area & Plant',
      width: '165px',
      sortable: true,
      render: row => (
        <span className="text-xs font-medium text-ink-secondary">{row.location}</span>
      ),
    },
    {
      key: 'status',
      header: 'Control Status',
      width: '130px',
      sortable: true,
      render: row => <StatusBadge status={row.status} />,
    },
    {
      key: 'assignedOwner',
      header: 'Owner',
      width: '110px',
      render: row => (
        <span className="font-mono text-xs text-ink-secondary">{row.assignedOwner}</span>
      ),
    },
    {
      key: 'reportedAt',
      header: 'Reported',
      width: '150px',
      align: 'right',
      sortable: true,
      render: row => (
        <span className="font-mono text-[11px] text-ink-muted">
          {row.reportedAt.replace('T', ' ')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hazard Monitoring & Field Triage"
        description={`Workplace hazard observations filtered to HAZARD_OBSERVATION records in ${facilityId === 'ALL' ? 'all plants' : facilityId}.`}
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Hazard Monitoring', active: true },
        ]}
        meta={
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-brand-peach-soft text-brand-orange border border-brand-orange/30">
            {hazards.length} Verified Hazards
          </span>
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      {!isLoading && !error && (
        <AlertPanel
          title="Critical Uncontrolled Hazards"
          count={criticalOpenCount}
          message={`${criticalOpenCount} critical-severity hazard observations remain in OPEN status and require field verification.`}
          actionText="Filter Critical Open"
          onAction={() => {
            setSearchTerm('');
            setSelectedCategory('ALL');
            setSelectedSeverity('CRITICAL');
            setSelectedStatus('OPEN');
          }}
        />
      )}

      {/* Domain Analytics: Category Concentration + Mitigation Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <AnalyticsChart
          className="lg:col-span-7"
          title="Hazard Category Concentration"
          subtitle="Click a category bar to filter the hazard register below."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={Flame}
          variant="bar-horizontal"
          data={categoryChartData}
          unit="hazards"
          totalLabel={`${hazards.length} Total`}
          isLoading={isLoading && !hazards.length}
          onSelectDatum={datum =>
            setSelectedCategory(prev => (prev === datum.label ? 'ALL' : datum.label))
          }
        />

        <AnalyticsChart
          className="lg:col-span-5"
          title="Control & Mitigation Posture"
          subtitle="Live resolution split across Open, In Progress, and Controlled hazards."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={Layers}
          variant="stacked-bar"
          data={statusChartData}
          totalLabel={`${hazards.length} Tracked`}
          isLoading={isLoading && !hazards.length}
          onSelectDatum={datum =>
            setSelectedStatus(prev =>
              prev === datum.label.toUpperCase() ? 'ALL' : datum.label.toUpperCase()
            )
          }
        />
      </div>

      <FilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by Hazard ID, area, owner, or PTW..."
        filters={filters}
        totalRecords={hazards.length}
        filteredCount={filteredHazards.length}
        onResetFilters={() => {
          setSearchTerm('');
          setSelectedCategory('ALL');
          setSelectedSeverity('ALL');
          setSelectedStatus('ALL');
        }}
      />

      <DataTable
        columns={columns}
        data={filteredHazards}
        keyExtractor={row => row.id}
        isLoading={isLoading && !hazards.length}
        onRowClick={row => setSelectedHazard(row)}
        emptyTitle="No Hazards Match Filters"
        emptyDescription="Clear or adjust category, severity, or status filters to view verified hazard records."
      />

      <DetailDrawer
        isOpen={selectedHazard !== null}
        onClose={() => setSelectedHazard(null)}
        title={selectedHazard ? selectedHazard.id : 'Hazard Details'}
        subtitle={selectedHazard ? `${selectedHazard.location} • ${selectedHazard.shift}` : undefined}
        badge={selectedHazard ? <RiskBadge severity={selectedHazard.severity} /> : undefined}
      >
        {selectedHazard && (
          <div className="space-y-5 text-xs">
            <div>
              <span className="font-semibold text-ink-secondary uppercase tracking-wider text-[10px]">
                Observation Summary
              </span>
              <p className="mt-1 text-sm font-medium text-ink-primary">{selectedHazard.title}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-canvas-subtle border border-line-subtle">
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Plant ID</span>
                <p className="font-mono font-semibold text-ink-primary mt-0.5">{selectedHazard.plantId}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Category</span>
                <p className="font-semibold text-ink-primary mt-0.5">{selectedHazard.category}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Operating Shift</span>
                <p className="font-mono font-semibold text-ink-primary mt-0.5">{selectedHazard.shift}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Assigned Lead</span>
                <p className="font-mono font-semibold text-ink-primary mt-0.5">{selectedHazard.assignedOwner}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Control Status</span>
                <StatusBadge status={selectedHazard.status} />
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Permit Reference</span>
                <span className="font-mono text-brand-purple font-semibold">{selectedHazard.permitId}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Reported Timestamp</span>
                <span className="font-mono text-ink-primary">{selectedHazard.reportedAt}</span>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
