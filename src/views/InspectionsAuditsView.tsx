import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterToolbar, FilterSelectConfig } from '../components/ui/FilterToolbar';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RiskBadge } from '../components/ui/RiskBadge';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { AnalyticsChart, ChartDatum } from '../components/ui/AnalyticsChart';
import { ErrorState } from '../components/ui/ErrorState';
import { ClipboardList, Layers, Info } from 'lucide-react';
import { useEhs } from '../context/EhsContext';
import { EhsEventRecord } from '../types/ehs';

export const InspectionsAuditsView: React.FC = () => {
  const { rawEvents, isLoading, error, reloadAllData, facilityId } = useEhs();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedAudit, setSelectedAudit] = useState<EhsEventRecord | null>(null);

  const auditFindings = useMemo(
    () => rawEvents.filter(e => e.event_type === 'AUDIT_FINDING'),
    [rawEvents]
  );

  const filteredAudits = useMemo(() => {
    return auditFindings.filter(a => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        a.ehs_event_id.toLowerCase().includes(q) ||
        a.hazard_category.toLowerCase().includes(q) ||
        a.area.toLowerCase().includes(q) ||
        (a.action_owner && a.action_owner.toLowerCase().includes(q));

      const matchesSeverity =
        selectedSeverity === 'ALL' || a.risk_severity.toUpperCase() === selectedSeverity.toUpperCase();
      const matchesStatus =
        selectedStatus === 'ALL' || a.action_status.toUpperCase() === selectedStatus.toUpperCase();

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [auditFindings, searchTerm, selectedSeverity, selectedStatus]);

  const areaAuditData = useMemo<ChartDatum[]>(() => {
    const counts: Record<string, number> = {};
    auditFindings.forEach(a => {
      counts[a.area] = (counts[a.area] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([area, value]) => ({
        label: area.replace(/_/g, ' '),
        value,
        color: 'var(--brand-purple)',
      }));
  }, [auditFindings]);

  const statusSplitData = useMemo<ChartDatum[]>(() => {
    if (!auditFindings.length) return [];
    return [
      { label: 'Open', value: auditFindings.filter(a => a.action_status === 'OPEN').length, color: '#EF4444' },
      { label: 'In Progress', value: auditFindings.filter(a => a.action_status === 'IN_PROGRESS').length, color: 'var(--brand-orange)' },
      { label: 'Closed', value: auditFindings.filter(a => a.action_status === 'CLOSED').length, color: '#10B981' },
    ];
  }, [auditFindings]);

  const filters: FilterSelectConfig[] = [
    {
      id: 'severity',
      label: 'Severity',
      value: selectedSeverity,
      options: [
        { label: 'All Severities', value: 'ALL' },
        { label: 'Critical', value: 'CRITICAL' },
        { label: 'High', value: 'HIGH' },
        { label: 'Medium', value: 'MEDIUM' },
        { label: 'Low', value: 'LOW' },
      ],
      onChange: setSelectedSeverity,
    },
    {
      id: 'status',
      label: 'Closure Status',
      value: selectedStatus,
      options: [
        { label: 'All Statuses', value: 'ALL' },
        { label: 'OPEN', value: 'OPEN' },
        { label: 'IN_PROGRESS', value: 'IN_PROGRESS' },
        { label: 'CLOSED', value: 'CLOSED' },
      ],
      onChange: setSelectedStatus,
    },
  ];

  const columns: Column<EhsEventRecord>[] = [
    {
      key: 'ehs_event_id',
      header: 'Audit Record ID',
      width: '130px',
      sortable: true,
      render: row => <span className="font-mono text-xs font-semibold text-brand-purple">{row.ehs_event_id}</span>,
    },
    {
      key: 'hazard_category',
      header: 'Finding Category',
      render: row => (
        <div>
          <p className="font-medium text-xs text-ink-primary">
            {row.hazard_category.replace(/_/g, ' ')} Finding
          </p>
          <span className="text-[10px] text-ink-muted font-mono">
            {row.area} ({row.plant_id})
          </span>
        </div>
      ),
    },
    {
      key: 'risk_severity',
      header: 'Severity',
      width: '115px',
      sortable: true,
      render: row => <RiskBadge severity={row.risk_severity} />,
    },
    {
      key: 'action_owner',
      header: 'Owner',
      width: '120px',
      render: row => <span className="font-mono text-xs text-ink-secondary">{row.action_owner || 'Unassigned'}</span>,
    },
    {
      key: 'due_date',
      header: 'Due Date',
      width: '115px',
      sortable: true,
      render: row => <span className="font-mono text-[11px] text-ink-secondary">{row.due_date}</span>,
    },
    {
      key: 'action_status',
      header: 'Status',
      width: '130px',
      align: 'right',
      sortable: true,
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
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inspections & Audit Findings"
        description={`Internal audit findings (event_type = AUDIT_FINDING) in ${facilityId === 'ALL' ? 'all facilities' : facilityId}.`}
        breadcrumbs={[
          { label: 'Safety Governance' },
          { label: 'Inspections & Audits', active: true },
        ]}
        meta={
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-brand-purple-soft text-brand-purple border border-brand-purple/30">
            {auditFindings.length} Audit Findings
          </span>
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <AnalyticsChart
          className="lg:col-span-7"
          title="Audit Findings by Plant Area"
          subtitle="Distribution of AUDIT_FINDING events across plant zones."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={ClipboardList}
          variant="bar-horizontal"
          data={areaAuditData}
          unit="findings"
          totalLabel={`${auditFindings.length} Findings`}
          isLoading={isLoading && !rawEvents.length}
        />

        <AnalyticsChart
          className="lg:col-span-5"
          title="Audit Finding Closure Status"
          subtitle="Open vs In Progress vs Closed resolution state."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={Layers}
          variant="stacked-bar"
          data={statusSplitData}
          totalLabel={`${auditFindings.length} Total`}
          isLoading={isLoading && !rawEvents.length}
        />
      </div>

      {/* Pending Dataset Boundary Notice */}
      <div className="px-4 py-2.5 rounded-lg border border-line-subtle bg-canvas-subtle text-[11px] text-ink-secondary flex items-center gap-2">
        <Info className="w-4 h-4 text-brand-blue shrink-0" />
        <span>
          <strong>Dataset Availability:</strong> Standalone inspection schedule checklists are not present in Neon <code className="font-mono text-ink-primary">ehs_core</code>; only verified <code className="font-mono text-ink-primary">AUDIT_FINDING</code> records are shown.
        </span>
      </div>

      <FilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by Audit ID, category, area, or owner..."
        filters={filters}
        totalRecords={auditFindings.length}
        filteredCount={filteredAudits.length}
        onResetFilters={() => {
          setSearchTerm('');
          setSelectedSeverity('ALL');
          setSelectedStatus('ALL');
        }}
      />

      <DataTable
        columns={columns}
        data={filteredAudits}
        keyExtractor={row => row.ehs_event_id}
        isLoading={isLoading && !rawEvents.length}
        onRowClick={row => setSelectedAudit(row)}
        pageSize={25}
        emptyTitle="No Audit Findings Match"
        emptyDescription="No audit findings match the selected severity or closure status."
      />

      <DetailDrawer
        isOpen={selectedAudit !== null}
        onClose={() => setSelectedAudit(null)}
        title={selectedAudit ? selectedAudit.ehs_event_id : 'Audit Finding'}
        subtitle={selectedAudit ? `${selectedAudit.area} (${selectedAudit.plant_id}) • Shift ${selectedAudit.shift_id}` : undefined}
        badge={selectedAudit ? <RiskBadge severity={selectedAudit.risk_severity} /> : undefined}
      >
        {selectedAudit && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-canvas-subtle border border-line-subtle">
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Finding Category</span>
                <p className="font-semibold text-ink-primary mt-0.5">{selectedAudit.hazard_category.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <span className="text-[10px] text-ink-muted uppercase">Action Owner</span>
                <p className="font-mono font-semibold text-ink-primary mt-0.5">{selectedAudit.action_owner || 'Unassigned'}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Closure Status</span>
                <StatusBadge
                  status={
                    selectedAudit.action_status === 'CLOSED'
                      ? 'Closed'
                      : selectedAudit.action_status === 'IN_PROGRESS'
                      ? 'In Progress'
                      : 'Open'
                  }
                />
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Event Timestamp</span>
                <span className="font-mono text-ink-primary">{selectedAudit.event_ts}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Target Due Date</span>
                <span className="font-mono text-ink-primary">{selectedAudit.due_date}</span>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
