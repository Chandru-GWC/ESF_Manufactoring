import React, { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterToolbar, FilterSelectConfig } from '../components/ui/FilterToolbar';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RiskBadge } from '../components/ui/RiskBadge';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { AnalyticsChart, ChartDatum } from '../components/ui/AnalyticsChart';
import { ErrorState } from '../components/ui/ErrorState';
import { CheckSquare, Users } from 'lucide-react';
import { useEhs } from '../context/EhsContext';
import { CapaEscalationPanel, useCapaOverdue } from '../components/insights/CapaEscalationPanel';
import { ESCALATION_BADGE } from '../components/insights/AlertBadges';
import { CorrectiveAction, RouteFilterPreset } from '../types/ehs';

interface CorrectiveActionsViewProps {
  preset?: RouteFilterPreset | null;
}

export const CorrectiveActionsView: React.FC<CorrectiveActionsViewProps> = ({ preset }) => {
  const { actions, isLoading, error, reloadAllData, facilityId } = useEhs();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(preset?.actionStatus ?? 'ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedOwner, setSelectedOwner] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<CorrectiveAction | null>(null);
  const overdue = useCapaOverdue(facilityId);
  const overdueByEvent = useMemo(() => new Map((overdue.data?.items ?? []).map(i => [i.event_id, i])), [overdue.data]);

  useEffect(() => {
    if (!preset) return;
    if (preset.actionStatus !== undefined) {
      setSelectedStatus(preset.actionStatus);
      setSearchTerm('');
      setSelectedPriority('ALL');
      setSelectedOwner('ALL');
    }
  }, [preset]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    actions.forEach(a => set.add(a.owner));
    return ['ALL', ...Array.from(set).sort()];
  }, [actions]);

  const filteredActions = useMemo(() => {
    return actions.filter(a => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        a.id.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.owner.toLowerCase().includes(q) ||
        a.sourceRef.toLowerCase().includes(q) ||
        a.dueDate.toLowerCase().includes(q);

      const matchesStatus =
        selectedStatus === 'ALL' || a.status.toUpperCase() === selectedStatus.toUpperCase();
      const matchesPriority =
        selectedPriority === 'ALL' || a.priority.toUpperCase() === selectedPriority.toUpperCase();
      const matchesOwner = selectedOwner === 'ALL' || a.owner === selectedOwner;

      return matchesSearch && matchesStatus && matchesPriority && matchesOwner;
    });
  }, [actions, searchTerm, selectedStatus, selectedPriority, selectedOwner]);

  const stats = useMemo(() => {
    const total = actions.length;
    const open = actions.filter(a => a.status === 'Open').length;
    const inProgress = actions.filter(a => a.status === 'In Progress').length;
    const closed = actions.filter(a => a.status === 'Closed').length;
    const closureRate = total > 0 ? ((closed / total) * 100).toFixed(1) : null;
    return { total, open, inProgress, closed, closureRate };
  }, [actions]);

  const statusFunnelData = useMemo<ChartDatum[]>(() => {
    if (!actions.length) return [];
    return [
      { label: 'Open', value: stats.open, color: '#EF4444' },
      { label: 'In Progress', value: stats.inProgress, color: 'var(--brand-orange)' },
      { label: 'Closed', value: stats.closed, color: '#10B981' },
    ];
  }, [actions.length, stats]);

  const topOwnersData = useMemo<ChartDatum[]>(() => {
    const openByOwner: Record<string, number> = {};
    actions
      .filter(a => a.status !== 'Closed')
      .forEach(a => {
        openByOwner[a.owner] = (openByOwner[a.owner] || 0) + 1;
      });
    return Object.entries(openByOwner)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([owner, count]) => ({
        label: owner,
        value: count,
        color: 'var(--brand-purple)',
      }));
  }, [actions]);

  const filters: FilterSelectConfig[] = [
    {
      id: 'status',
      label: 'CAPA Status',
      value: selectedStatus,
      options: [
        { label: 'All Statuses', value: 'ALL' },
        { label: 'Open', value: 'OPEN' },
        { label: 'In Progress', value: 'IN PROGRESS' },
        { label: 'Closed', value: 'CLOSED' },
      ],
      onChange: setSelectedStatus,
    },
    {
      id: 'priority',
      label: 'Priority',
      value: selectedPriority,
      options: [
        { label: 'All Priorities', value: 'ALL' },
        { label: 'Critical', value: 'CRITICAL' },
        { label: 'High', value: 'HIGH' },
        { label: 'Medium', value: 'WARNING' },
        { label: 'Low', value: 'SUCCESS' },
      ],
      onChange: setSelectedPriority,
    },
    {
      id: 'owner',
      label: 'Owner',
      value: selectedOwner,
      options: owners.map(o => ({ label: o === 'ALL' ? 'All Owners' : o, value: o })),
      onChange: setSelectedOwner,
    },
  ];

  const columns: Column<CorrectiveAction>[] = [
    {
      key: 'id',
      header: 'CAPA Ref',
      width: '125px',
      sortable: true,
      render: row => <span className="font-mono text-xs font-semibold text-brand-purple">{row.id}</span>,
    },
    {
      key: 'title',
      header: 'Corrective Action Scope',
      render: row => (
        <div className="max-w-md">
          <p className="font-medium text-xs text-ink-primary line-clamp-1">{row.title}</p>
          <span className="text-[10px] text-ink-muted font-mono">
            Source: {row.sourceRef} • {row.plantId}
          </span>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Severity',
      width: '115px',
      sortable: true,
      render: row => <RiskBadge severity={row.priority} />,
    },
    {
      key: 'owner',
      header: 'Action Owner',
      width: '120px',
      sortable: true,
      render: row => <span className="font-mono text-xs text-ink-secondary">{row.owner}</span>,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      width: '115px',
      sortable: true,
      render: row => <span className="font-mono text-[11px] text-ink-secondary">{row.dueDate}</span>,
    },
    {
      key: 'progress',
      header: 'Action Stage',
      width: '150px',
      render: row => (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-ink-muted">{row.status}</span>
            <span className="font-semibold text-ink-primary">{row.progress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-canvas-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${row.progress}%`,
                backgroundColor:
                  row.progress === 100
                    ? '#10B981'
                    : row.progress > 40
                    ? 'var(--brand-blue)'
                    : 'var(--brand-orange)',
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'escalation',
      header: 'Escalation',
      width: '150px',
      render: row => {
        const o = overdueByEvent.get(row.sourceRef);
        if (!o) return <span className="text-[11px] text-ink-muted">—</span>;
        return (
          <span
            title={o.escalated_to ? `Escalated to ${o.escalated_to}` : 'Overdue, below the first escalation threshold'}
            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${ESCALATION_BADGE(o.escalation_level)}`}
          >
            {o.days_overdue}d overdue{o.escalation_level ? ` · L${o.escalation_level}` : ''}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '125px',
      align: 'right',
      sortable: true,
      render: row => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Corrective & Preventive Actions (CAPA)"
        description={`Owner accountability, due dates, and closure progress derived from fact_ehs_event in ${facilityId === 'ALL' ? 'all facilities' : facilityId}.`}
        breadcrumbs={[
          { label: 'Safety Governance' },
          { label: 'Corrective Actions', active: true },
        ]}
        meta={
          stats.closureRate !== null && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-brand-peach-soft text-brand-orange border border-brand-orange/30">
              {stats.open + stats.inProgress} Open/In-Progress • {stats.closureRate}% Closed
            </span>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      <CapaEscalationPanel
        state={overdue}
        onSelectEvent={eventId => {
          const match = actions.find(a => a.sourceRef === eventId);
          if (match) setSelectedAction(match);
        }}
      />

      {/* Analytics Split: Status Funnel + Open Owner Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <AnalyticsChart
          className="lg:col-span-5"
          title="CAPA Closure Funnel"
          subtitle="Click a status segment to filter the action register."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={CheckSquare}
          variant="stacked-bar"
          data={statusFunnelData}
          totalLabel={`${stats.total} Total`}
          isLoading={isLoading && !actions.length}
          onSelectDatum={datum =>
            setSelectedStatus(prev =>
              prev === datum.label.toUpperCase() ? 'ALL' : datum.label.toUpperCase()
            )
          }
        />

        <AnalyticsChart
          className="lg:col-span-7"
          title="Open Action Workload by Owner (Top 6)"
          subtitle="Active Open + In Progress CAPA assignments per owner ID."
          sourceAttribution="ehs_core.fact_ehs_event"
          icon={Users}
          variant="bar-horizontal"
          data={topOwnersData}
          unit="open"
          isLoading={isLoading && !actions.length}
          onSelectDatum={datum =>
            setSelectedOwner(prev => (prev === datum.label ? 'ALL' : datum.label))
          }
        />
      </div>

      <FilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by CAPA ID, source event, owner, or due date..."
        filters={filters}
        totalRecords={actions.length}
        filteredCount={filteredActions.length}
        onResetFilters={() => {
          setSearchTerm('');
          setSelectedStatus('ALL');
          setSelectedPriority('ALL');
          setSelectedOwner('ALL');
        }}
      />

      <DataTable
        columns={columns}
        data={filteredActions}
        keyExtractor={row => row.id}
        isLoading={isLoading && !actions.length}
        onRowClick={row => setSelectedAction(row)}
        pageSize={25}
        emptyTitle="No Corrective Actions Found"
        emptyDescription="No CAPA assignments match the active filter criteria."
      />

      <DetailDrawer
        isOpen={selectedAction !== null}
        onClose={() => setSelectedAction(null)}
        title={selectedAction ? selectedAction.id : 'CAPA Details'}
        subtitle={selectedAction ? `Origin Event: ${selectedAction.sourceRef} • ${selectedAction.plantId}` : undefined}
        badge={selectedAction ? <RiskBadge severity={selectedAction.priority} /> : undefined}
      >
        {selectedAction && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Action Scope
              </span>
              <p className="mt-1 text-sm font-medium text-ink-primary">{selectedAction.title}</p>
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Responsible Owner</span>
                <span className="font-mono font-semibold text-ink-primary">{selectedAction.owner}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Target Due Date</span>
                <span className="font-mono text-ink-primary">{selectedAction.dueDate}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line-subtle">
                <span className="text-ink-muted">Resolution Status</span>
                <StatusBadge status={selectedAction.status} />
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
