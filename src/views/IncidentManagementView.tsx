import React, { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterToolbar, FilterSelectConfig } from '../components/ui/FilterToolbar';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RiskBadge } from '../components/ui/RiskBadge';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { AnalyticsChart, ChartDatum } from '../components/ui/AnalyticsChart';
import { ErrorState } from '../components/ui/ErrorState';
import { AlertOctagon, HeartPulse, CheckCircle2, CalendarRange, Clock } from 'lucide-react';
import { useEhs } from '../context/EhsContext';
import { IncidentRecord, RouteFilterPreset } from '../types/ehs';

interface IncidentManagementViewProps {
  preset?: RouteFilterPreset | null;
}

export const IncidentManagementView: React.FC<IncidentManagementViewProps> = ({ preset }) => {
  const { incidents, isLoading, error, reloadAllData } = useEhs();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>(preset?.incidentType ?? 'ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);

  useEffect(() => {
    if (!preset) return;
    if (preset.incidentType !== undefined) {
      setSelectedType(preset.incidentType);
      setSearchTerm('');
      setSelectedSeverity('ALL');
    }
  }, [preset]);

  const types = useMemo(() => {
    const set = new Set<string>();
    incidents.forEach(i => set.add(i.incidentType));
    return ['ALL', ...Array.from(set).sort()];
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(i => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        i.id.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        i.responsiblePerson.toLowerCase().includes(q) ||
        i.permitId.toLowerCase().includes(q);

      const matchesType = selectedType === 'ALL' || i.incidentType === selectedType;
      const matchesSeverity =
        selectedSeverity === 'ALL' || i.severity.toUpperCase() === selectedSeverity.toUpperCase();

      return matchesSearch && matchesType && matchesSeverity;
    });
  }, [incidents, searchTerm, selectedType, selectedSeverity]);

  const stats = useMemo(() => {
    const total = incidents.length;
    const firstAid = incidents.filter(i => i.incidentType.includes('FIRST AID')).length;
    const nearMiss = incidents.filter(i => i.incidentType.includes('NEAR MISS')).length;
    const ltiCount = incidents.filter(i => i.lostTimeInjury).length;
    return { total, firstAid, nearMiss, ltiCount };
  }, [incidents]);

  // Weekly First Aid vs Near Miss time-series strictly computed from reportedDate
  const weeklyIncidentTrend = useMemo<ChartDatum[]>(() => {
    if (!incidents.length) return [];
    const buckets: Record<string, { firstAid: number; nearMiss: number }> = {};

    incidents.forEach(inc => {
      const dt = new Date(inc.reportedDate.slice(0, 10) + 'T00:00:00Z');
      if (Number.isNaN(dt.getTime())) return;
      const day = dt.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      dt.setUTCDate(dt.getUTCDate() + diff);
      const weekKey = dt.toISOString().slice(0, 10);

      if (!buckets[weekKey]) buckets[weekKey] = { firstAid: 0, nearMiss: 0 };
      if (inc.incidentType.includes('FIRST AID')) buckets[weekKey].firstAid += 1;
      else buckets[weekKey].nearMiss += 1;
    });

    return Object.entries(buckets)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, counts]) => ({
        label: week.slice(5),
        value: counts.firstAid,
        secondaryValue: counts.nearMiss,
      }));
  }, [incidents]);

  // Shift breakdown column chart strictly from incidents array
  const shiftBreakdownData = useMemo<ChartDatum[]>(() => {
    const counts: Record<string, { firstAid: number; nearMiss: number }> = {
      'Shift A': { firstAid: 0, nearMiss: 0 },
      'Shift B': { firstAid: 0, nearMiss: 0 },
      'Shift C': { firstAid: 0, nearMiss: 0 },
    };
    incidents.forEach(inc => {
      if (!counts[inc.shift]) counts[inc.shift] = { firstAid: 0, nearMiss: 0 };
      if (inc.incidentType.includes('FIRST AID')) counts[inc.shift].firstAid += 1;
      else counts[inc.shift].nearMiss += 1;
    });
    return Object.entries(counts).map(([label, c]) => ({
      label,
      value: c.firstAid,
      secondaryValue: c.nearMiss,
    }));
  }, [incidents]);

  const filters: FilterSelectConfig[] = [
    {
      id: 'type',
      label: 'Incident Type',
      value: selectedType,
      options: types.map(t => ({ label: t === 'ALL' ? 'All Types' : t, value: t })),
      onChange: setSelectedType,
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
  ];

  const columns: Column<IncidentRecord>[] = [
    {
      key: 'id',
      header: 'Incident ID',
      width: '120px',
      sortable: true,
      render: row => (
        <span className="font-mono text-xs font-semibold text-brand-purple">{row.id}</span>
      ),
    },
    {
      key: 'title',
      header: 'Event Details',
      render: row => (
        <div className="max-w-md">
          <p className="font-medium text-xs text-ink-primary line-clamp-1">{row.title}</p>
          <span className="text-[10px] text-ink-muted font-mono">{row.category}</span>
        </div>
      ),
    },
    {
      key: 'incidentType',
      header: 'Classification',
      width: '130px',
      sortable: true,
      render: row => (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ink-secondary">
          {row.incidentType.includes('FIRST AID') ? (
            <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
          ) : (
            <AlertOctagon className="w-3.5 h-3.5 text-brand-blue" />
          )}
          {row.incidentType}
        </span>
      ),
    },
    {
      key: 'severity',
      header: 'Risk Severity',
      width: '115px',
      sortable: true,
      render: row => <RiskBadge severity={row.severity} />,
    },
    {
      key: 'location',
      header: 'Plant & Area',
      width: '165px',
      render: row => <span className="text-xs font-medium text-ink-secondary">{row.location}</span>,
    },
    {
      key: 'investigationStatus',
      header: 'Investigation',
      width: '150px',
      sortable: true,
      render: row => <StatusBadge status={row.investigationStatus} />,
    },
    {
      key: 'reportedDate',
      header: 'Reported',
      width: '150px',
      align: 'right',
      sortable: true,
      render: row => (
        <span className="font-mono text-[11px] text-ink-muted">
          {row.reportedDate.replace('T', ' ')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incident & Near-Miss Management"
        description="Operational tracking of FIRST_AID incidents and NEAR_MISS leading safety signals derived from fact_ehs_event."
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Incident Management', active: true },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-severity-success-bg text-severity-success-text border border-severity-success-border">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {stats.ltiCount} Lost Time Injuries (LTI)
          </span>
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      {/* Analytics Focus: Weekly Trend + Shift Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <AnalyticsChart
          className="lg:col-span-7"
          title="Weekly First-Aid vs Near-Miss Signals"
          subtitle="Time-series comparison computed from event_ts timestamps."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={CalendarRange}
          variant="area"
          data={weeklyIncidentTrend}
          primaryLabel={`First Aid (${stats.firstAid})`}
          secondaryLabel={`Near Miss (${stats.nearMiss})`}
          primaryColor="var(--brand-purple)"
          secondaryColor="var(--brand-blue)"
          unit="cases"
          totalLabel={`${stats.total} Total`}
          isLoading={isLoading && !incidents.length}
        />

        <AnalyticsChart
          className="lg:col-span-5"
          title="Shift Exposure Comparison"
          subtitle="First Aid vs Near Miss distribution across Shifts A, B, and C."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={Clock}
          variant="bar-vertical"
          data={shiftBreakdownData}
          primaryLabel="First Aid"
          secondaryLabel="Near Miss"
          primaryColor="var(--brand-purple)"
          secondaryColor="var(--brand-blue)"
          unit="cases"
          isLoading={isLoading && !incidents.length}
        />
      </div>

      <FilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by Incident ID, area, owner, or PTW..."
        filters={filters}
        totalRecords={incidents.length}
        filteredCount={filteredIncidents.length}
        onResetFilters={() => {
          setSearchTerm('');
          setSelectedType('ALL');
          setSelectedSeverity('ALL');
        }}
      />

      <DataTable
        columns={columns}
        data={filteredIncidents}
        keyExtractor={row => row.id}
        isLoading={isLoading && !incidents.length}
        onRowClick={row => setSelectedIncident(row)}
        emptyTitle="No Incidents Found"
        emptyDescription="No incident or near-miss records match the specified filters."
      />

      <DetailDrawer
        isOpen={selectedIncident !== null}
        onClose={() => setSelectedIncident(null)}
        title={selectedIncident ? selectedIncident.id : 'Incident Details'}
        subtitle={selectedIncident ? `${selectedIncident.location} • ${selectedIncident.shift}` : undefined}
        badge={selectedIncident ? <RiskBadge severity={selectedIncident.severity} /> : undefined}
      >
        {selectedIncident && (
          <div className="space-y-5 text-xs">
            <div>
              <span className="font-semibold text-ink-secondary uppercase tracking-wider text-[10px]">
                Incident Narrative
              </span>
              <p className="mt-1 text-sm font-medium text-ink-primary">{selectedIncident.title}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-canvas-subtle border border-line-subtle">
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Classification</span>
                <p className="font-semibold text-ink-primary mt-0.5">{selectedIncident.incidentType}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Hazard Category</span>
                <p className="font-semibold text-ink-primary mt-0.5">{selectedIncident.category}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Operating Shift</span>
                <p className="font-mono font-semibold text-ink-primary mt-0.5">{selectedIncident.shift}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Action Owner</span>
                <p className="font-mono font-semibold text-ink-primary mt-0.5">{selectedIncident.responsiblePerson}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Investigation Status</span>
                <StatusBadge status={selectedIncident.investigationStatus} />
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Permit Authorization</span>
                <span className="font-mono text-brand-purple font-semibold">{selectedIncident.permitId}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Lost Time Injury</span>
                <span className="font-mono font-semibold text-severity-success-text">
                  {selectedIncident.lostTimeInjury ? 'YES (LTI)' : 'NO (0 LTI)'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Reported Date</span>
                <span className="font-mono text-ink-primary">{selectedIncident.reportedDate}</span>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
