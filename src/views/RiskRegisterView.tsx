import React, { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterToolbar, FilterSelectConfig } from '../components/ui/FilterToolbar';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RiskBadge } from '../components/ui/RiskBadge';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { AnalyticsChart, ChartDatum } from '../components/ui/AnalyticsChart';
import { ErrorState } from '../components/ui/ErrorState';
import { HardHat, AlertOctagon, ShieldCheck, Flame, Info } from 'lucide-react';
import { useEhs } from '../context/EhsContext';
import { EhsEventRecord, RouteFilterPreset } from '../types/ehs';

interface RiskRegisterViewProps {
  preset?: RouteFilterPreset | null;
}

export const RiskRegisterView: React.FC<RiskRegisterViewProps> = ({ preset }) => {
  const { rawEvents, eventSummary, isLoading, error, reloadAllData, facilityId } = useEhs();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>(preset?.riskSeverity ?? 'ALL');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [selectedRisk, setSelectedRisk] = useState<EhsEventRecord | null>(null);

  useEffect(() => {
    if (!preset) return;
    if (preset.riskSeverity !== undefined) {
      setSelectedSeverity(preset.riskSeverity);
      setSearchTerm('');
      setSelectedArea('ALL');
    }
  }, [preset]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    rawEvents.forEach(e => set.add(e.area));
    return ['ALL', ...Array.from(set).sort()];
  }, [rawEvents]);

  const filteredRisks = useMemo(() => {
    return rawEvents.filter(r => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        r.ehs_event_id.toLowerCase().includes(q) ||
        r.hazard_category.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        r.event_type.toLowerCase().includes(q);

      const matchesSeverity =
        selectedSeverity === 'ALL' || r.risk_severity.toUpperCase() === selectedSeverity.toUpperCase();
      const matchesArea = selectedArea === 'ALL' || r.area === selectedArea;

      return matchesSearch && matchesSeverity && matchesArea;
    });
  }, [rawEvents, searchTerm, selectedSeverity, selectedArea]);

  const sevCounts = eventSummary?.by_severity ?? null;

  const categoryRiskData = useMemo<ChartDatum[]>(() => {
    if (!eventSummary?.by_hazard_category) return [];
    return Object.entries(eventSummary.by_hazard_category)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, value]) => ({
        label: cat.replace(/_/g, ' '),
        value,
        color: 'var(--brand-purple)',
      }));
  }, [eventSummary]);

  const toggleSeverityFilter = (sev: string) => {
    setSelectedSeverity(prev => (prev === sev ? 'ALL' : sev));
  };

  const filters: FilterSelectConfig[] = [
    {
      id: 'severity',
      label: 'Severity',
      value: selectedSeverity,
      options: [
        { label: 'All Severities', value: 'ALL' },
        { label: 'CRITICAL', value: 'CRITICAL' },
        { label: 'HIGH', value: 'HIGH' },
        { label: 'MEDIUM', value: 'MEDIUM' },
        { label: 'LOW', value: 'LOW' },
      ],
      onChange: setSelectedSeverity,
    },
    {
      id: 'area',
      label: 'Plant Zone',
      value: selectedArea,
      options: areas.map(a => ({ label: a === 'ALL' ? 'All Zones' : a, value: a })),
      onChange: setSelectedArea,
    },
  ];

  const columns: Column<EhsEventRecord>[] = [
    {
      key: 'ehs_event_id',
      header: 'Register ID',
      width: '120px',
      sortable: true,
      render: row => <span className="font-mono text-xs font-semibold text-brand-purple">{row.ehs_event_id}</span>,
    },
    {
      key: 'hazard_category',
      header: 'Hazard Category & Type',
      render: row => (
        <div>
          <p className="font-medium text-xs text-ink-primary">{row.hazard_category.replace(/_/g, ' ')}</p>
          <span className="text-[10px] text-ink-muted font-mono">
            {row.event_type.replace(/_/g, ' ')} • {row.area} ({row.plant_id})
          </span>
        </div>
      ),
    },
    {
      key: 'risk_severity',
      header: 'Classification',
      width: '120px',
      sortable: true,
      render: row => <RiskBadge severity={row.risk_severity} />,
    },
    {
      key: 'shift_id',
      header: 'Shift',
      width: '90px',
      render: row => <span className="font-mono text-xs text-ink-secondary">Shift {row.shift_id}</span>,
    },
    {
      key: 'action_owner',
      header: 'Owner',
      width: '115px',
      render: row => <span className="font-mono text-xs text-ink-secondary">{row.action_owner || 'Unassigned'}</span>,
    },
    {
      key: 'action_status',
      header: 'Control Status',
      width: '130px',
      align: 'right',
      sortable: true,
      render: row => (
        <StatusBadge
          status={
            row.action_status === 'CLOSED'
              ? 'Controlled'
              : row.action_status === 'IN_PROGRESS'
              ? 'In Progress'
              : 'Open'
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Risk Classification Register"
        description={`Source-backed risk_severity classifications from fact_ehs_event in ${facilityId === 'ALL' ? 'all facilities' : facilityId}.`}
        breadcrumbs={[
          { label: 'Safety Governance' },
          { label: 'Risk Register', active: true },
        ]}
        meta={
          sevCounts && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-severity-critical-bg text-severity-critical-text border border-severity-critical-border">
              {sevCounts.CRITICAL ?? 0} Critical Severity Events
            </span>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      {/* Interactive 4-Tier Severity Matrix + Category Risk Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 p-5 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line-subtle">
            <h3 className="text-sm font-bold text-ink-primary">Interactive Severity Filter Matrix</h3>
            <span className="text-[11px] font-mono text-ink-muted">Click tier to filter</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'CRITICAL', label: 'Critical', count: sevCounts?.CRITICAL, icon: AlertOctagon, cls: 'border-severity-critical-border bg-severity-critical-bg/50 text-severity-critical-text' },
              { key: 'HIGH', label: 'High', count: sevCounts?.HIGH, icon: Flame, cls: 'border-severity-high-border bg-severity-high-bg/50 text-severity-high-text' },
              { key: 'MEDIUM', label: 'Medium', count: sevCounts?.MEDIUM, icon: HardHat, cls: 'border-severity-warning-border bg-severity-warning-bg/50 text-severity-warning-text' },
              { key: 'LOW', label: 'Low', count: sevCounts?.LOW, icon: ShieldCheck, cls: 'border-severity-success-border bg-severity-success-bg/50 text-severity-success-text' },
            ].map(tier => {
              const Icon = tier.icon;
              const isSelected = selectedSeverity === tier.key;
              return (
                <button
                  key={tier.key}
                  type="button"
                  onClick={() => toggleSeverityFilter(tier.key)}
                  className={`text-left p-3.5 rounded-lg border transition-all focus-ring ${tier.cls} ${
                    isSelected ? 'ring-2 ring-brand-purple shadow-sm' : 'opacity-90 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span>{tier.label}</span>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-ink-primary mt-1.5 tabular-nums">
                    {tier.count ?? '—'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-3 py-2 rounded-lg bg-canvas-subtle border border-line-subtle text-[11px] text-ink-secondary flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-brand-blue shrink-0 mt-0.5" />
            <span>
              <strong>Transparent Rule:</strong> Tiers mirror raw <code className="font-mono text-ink-primary">risk_severity</code> values without invented numerical likelihood multipliers.
            </span>
          </div>
        </div>

        <AnalyticsChart
          className="lg:col-span-7"
          title="Hazard Category Risk Volume"
          subtitle="All 400 safety events grouped by hazard_category."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={Flame}
          variant="bar-horizontal"
          data={categoryRiskData}
          unit="events"
          isLoading={isLoading && !eventSummary}
        />
      </div>

      <FilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by Register ID, hazard category, area, or type..."
        filters={filters}
        totalRecords={rawEvents.length}
        filteredCount={filteredRisks.length}
        onResetFilters={() => {
          setSearchTerm('');
          setSelectedSeverity('ALL');
          setSelectedArea('ALL');
        }}
      />

      <DataTable
        columns={columns}
        data={filteredRisks}
        keyExtractor={row => row.ehs_event_id}
        isLoading={isLoading && !rawEvents.length}
        onRowClick={row => setSelectedRisk(row)}
        pageSize={25}
        emptyTitle="No Risk Records Found"
        emptyDescription="No events match the selected severity tier or area filter."
      />

      <DetailDrawer
        isOpen={selectedRisk !== null}
        onClose={() => setSelectedRisk(null)}
        title={selectedRisk ? selectedRisk.ehs_event_id : 'Risk Record'}
        subtitle={selectedRisk ? `${selectedRisk.area} (${selectedRisk.plant_id})` : undefined}
        badge={selectedRisk ? <RiskBadge severity={selectedRisk.risk_severity} /> : undefined}
      >
        {selectedRisk && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-canvas-subtle border border-line-subtle">
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Hazard Category</span>
                <p className="font-semibold text-ink-primary mt-0.5">{selectedRisk.hazard_category}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Event Type</span>
                <p className="font-semibold text-ink-primary mt-0.5">{selectedRisk.event_type}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Action Owner</span>
                <p className="font-mono font-semibold text-ink-primary mt-0.5">{selectedRisk.action_owner}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Permit ID</span>
                <p className="font-mono font-semibold text-brand-purple mt-0.5">{selectedRisk.permit_id}</p>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
