import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterToolbar, FilterSelectConfig } from '../components/ui/FilterToolbar';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { AlertPanel } from '../components/ui/AlertPanel';
import { AnalyticsChart, ChartDatum } from '../components/ui/AnalyticsChart';
import { ErrorState } from '../components/ui/ErrorState';
import { KeyRound, ShieldAlert, Info } from 'lucide-react';
import { useEhs } from '../context/EhsContext';
import { PermitLotoRecord } from '../types/ehs';

export const PermitLotoComplianceView: React.FC = () => {
  const { permits, rawEvents, isLoading, error, reloadAllData, facilityId } = useEhs();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPermit, setSelectedPermit] = useState<PermitLotoRecord | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    permits.forEach(p => set.add(p.hazardCategory));
    return ['ALL', ...Array.from(set).sort()];
  }, [permits]);

  const filteredPermits = useMemo(() => {
    return permits.filter(p => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        p.id.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.zone.toLowerCase().includes(q) ||
        p.authorizedPerson.toLowerCase().includes(q);

      const matchesStatus =
        selectedStatus === 'ALL' || p.status.toUpperCase() === selectedStatus.toUpperCase();
      const matchesCategory =
        selectedCategory === 'ALL' || p.hazardCategory === selectedCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [permits, searchTerm, selectedStatus, selectedCategory]);

  const stats = useMemo(() => {
    const total = permits.length;
    const exceptions = permits.filter(p => p.status === 'Under Exception').length;
    const active = permits.filter(p => p.status === 'Active').length;
    const closed = permits.filter(p => p.status === 'Closed').length;
    return { total, exceptions, active, closed };
  }, [permits]);

  const statusBreakdown = useMemo<ChartDatum[]>(() => {
    if (!permits.length) return [];
    return [
      { label: 'Active', value: stats.active, color: 'var(--brand-blue)' },
      { label: 'Under Exception', value: stats.exceptions, color: '#EF4444' },
      { label: 'Closed', value: stats.closed, color: '#10B981' },
    ];
  }, [permits.length, stats]);

  const exceptionsByZone = useMemo<ChartDatum[]>(() => {
    const counts: Record<string, number> = {};
    rawEvents
      .filter(e => e.event_type === 'PERMIT_EXCEPTION')
      .forEach(e => {
        counts[e.area] = (counts[e.area] || 0) + 1;
      });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([area, value]) => ({
        label: area.replace(/_/g, ' '),
        value,
        color: 'var(--brand-orange)',
      }));
  }, [rawEvents]);

  const filters: FilterSelectConfig[] = [
    {
      id: 'category',
      label: 'Hazard Type',
      value: selectedCategory,
      options: categories.map(c => ({ label: c === 'ALL' ? 'All Categories' : c, value: c })),
      onChange: setSelectedCategory,
    },
    {
      id: 'status',
      label: 'Permit Status',
      value: selectedStatus,
      options: [
        { label: 'All Statuses', value: 'ALL' },
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Under Exception', value: 'UNDER EXCEPTION' },
        { label: 'Closed', value: 'CLOSED' },
      ],
      onChange: setSelectedStatus,
    },
  ];

  const columns: Column<PermitLotoRecord>[] = [
    {
      key: 'id',
      header: 'Permit ID',
      width: '125px',
      sortable: true,
      render: row => <span className="font-mono text-xs font-semibold text-brand-purple">{row.id}</span>,
    },
    {
      key: 'title',
      header: 'Permit Scope',
      render: row => (
        <div className="max-w-md">
          <p className="font-medium text-xs text-ink-primary line-clamp-1">{row.title}</p>
          <span className="text-[10px] text-ink-muted font-mono">{row.permitType}</span>
        </div>
      ),
    },
    {
      key: 'zone',
      header: 'Area',
      width: '130px',
      sortable: true,
      render: row => <span className="text-xs font-medium text-ink-secondary">{row.zone}</span>,
    },
    {
      key: 'shift',
      header: 'Shift',
      width: '95px',
      render: row => <span className="font-mono text-xs text-ink-secondary">{row.shift}</span>,
    },
    {
      key: 'authorizedPerson',
      header: 'Action Owner',
      width: '120px',
      render: row => <span className="font-mono text-xs text-ink-secondary">{row.authorizedPerson}</span>,
    },
    {
      key: 'validTo',
      header: 'Due Date',
      width: '115px',
      sortable: true,
      render: row => <span className="font-mono text-[11px] text-ink-muted">{row.validTo}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '145px',
      align: 'right',
      sortable: true,
      render: row => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Permit-to-Work (PTW) & Exception Tracking"
        description={`Verified permit references and PERMIT_EXCEPTION events from fact_ehs_event in ${facilityId === 'ALL' ? 'all facilities' : facilityId}.`}
        breadcrumbs={[
          { label: 'Safety Governance' },
          { label: 'Permit & LOTO', active: true },
        ]}
        meta={
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-brand-peach-soft text-brand-orange border border-brand-orange/30">
            {stats.exceptions} Permit Exceptions
          </span>
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      {!isLoading && !error && (
        <AlertPanel
          title="Permit Exception Queue"
          count={stats.exceptions}
          message={`${stats.exceptions} open events are flagged with event_type = PERMIT_EXCEPTION in Neon PostgreSQL.`}
          actionText="Isolate Exceptions"
          onAction={() => setSelectedStatus('UNDER EXCEPTION')}
        />
      )}

      {/* Domain Analytics: Status Split + Exception Zone Concentration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <AnalyticsChart
          className="lg:col-span-5"
          title="Permit Status Posture"
          subtitle="Click a status category to isolate matching PTW records."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={KeyRound}
          variant="stacked-bar"
          data={statusBreakdown}
          totalLabel={`${stats.total} Permits`}
          isLoading={isLoading && !permits.length}
          onSelectDatum={datum =>
            setSelectedStatus(prev =>
              prev === datum.label.toUpperCase() ? 'ALL' : datum.label.toUpperCase()
            )
          }
        />

        <AnalyticsChart
          className="lg:col-span-7"
          title="Permit Exceptions by Plant Area"
          subtitle="Geographic concentration of PERMIT_EXCEPTION events."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={ShieldAlert}
          variant="bar-horizontal"
          data={exceptionsByZone}
          unit="exceptions"
          totalLabel={`${exceptionsByZone.reduce((s, x) => s + x.value, 0)} Exceptions`}
          isLoading={isLoading && !rawEvents.length}
        />
      </div>

      {/* Transparent Data Boundary Note */}
      <div className="px-4 py-2.5 rounded-lg border border-line-subtle bg-canvas-subtle text-[11px] text-ink-secondary flex items-center gap-2">
        <Info className="w-4 h-4 text-brand-blue shrink-0" />
        <span>
          <strong>LOTO Dataset Notice:</strong> Standalone Lockout/Tagout lockbox hardware tables are not currently part of the approved schema; permit status shown here is grounded exclusively in <code className="font-mono text-ink-primary">ehs_core.fact_ehs_event.permit_id</code>.
        </span>
      </div>

      <FilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by Permit ID, area, or owner..."
        filters={filters}
        totalRecords={permits.length}
        filteredCount={filteredPermits.length}
        onResetFilters={() => {
          setSearchTerm('');
          setSelectedCategory('ALL');
          setSelectedStatus('ALL');
        }}
      />

      <DataTable
        columns={columns}
        data={filteredPermits}
        keyExtractor={(row, ) => `${row.id}-${row.validFrom}-${row.zone}`}
        isLoading={isLoading && !permits.length}
        onRowClick={row => setSelectedPermit(row)}
        pageSize={25}
        emptyTitle="No Permits Found"
        emptyDescription="No permit records match the active filter settings."
      />

      <DetailDrawer
        isOpen={selectedPermit !== null}
        onClose={() => setSelectedPermit(null)}
        title={selectedPermit ? selectedPermit.id : 'Permit Details'}
        subtitle={selectedPermit ? `${selectedPermit.zone} (${selectedPermit.plantId}) • ${selectedPermit.shift}` : undefined}
        badge={selectedPermit ? <StatusBadge status={selectedPermit.status} /> : undefined}
      >
        {selectedPermit && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Permit Scope
              </span>
              <p className="mt-1 text-sm font-medium text-ink-primary">{selectedPermit.title}</p>
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Hazard Category</span>
                <span className="font-mono text-ink-primary">{selectedPermit.hazardCategory}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Action Owner</span>
                <span className="font-mono text-ink-primary">{selectedPermit.authorizedPerson}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Event Date</span>
                <span className="font-mono text-ink-primary">{selectedPermit.validFrom}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Due Date</span>
                <span className="font-mono text-ink-primary">{selectedPermit.validTo}</span>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
