import React, { useState, useMemo, lazy, Suspense, useCallback } from 'react';
import {
  Box,
  RotateCcw,
  Table2,
  Info,
  Wrench,
  ArrowRight,
  MonitorOff,
  AlertTriangle,
  TrendingUp,
  Shield,
  Zap,
} from 'lucide-react';
import { PageHeader }   from '../components/ui/PageHeader';
import { DataTable, Column } from '../components/ui/DataTable';
import { RiskBadge }    from '../components/ui/RiskBadge';
import { StatusBadge }  from '../components/ui/StatusBadge';
import { DetailDrawer } from '../components/ui/DetailDrawer';
import { ErrorState }   from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { useEhs }       from '../context/EhsContext';
import { EhsEventRecord } from '../types/ehs';
import type { ZoneMetricSummary } from '../components/digital-twin/FactoryDigitalTwinCanvas';

const FactoryDigitalTwinCanvas = lazy(
  () => import('../components/digital-twin/FactoryDigitalTwinCanvas')
);

const AREA_ORDER = [
  'WAREHOUSE', 'SMT', 'QUALITY', 'PACKAGING', 'TEST', 'FINAL_ASSEMBLY',
];

const ZONE_LABELS: Record<string, string> = {
  WAREHOUSE: 'Warehouse', SMT: 'SMT',
  QUALITY: 'Quality', PACKAGING: 'Packaging',
  TEST: 'Test', FINAL_ASSEMBLY: 'Final Assembly',
};

function SeverityBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-canvas-muted overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%`, transition: 'width 0.35s ease' }} />
      </div>
      <span className="font-mono text-[11px] font-semibold text-ink-secondary tabular-nums w-6 text-right shrink-0">{value}</span>
    </div>
  );
}

export const DigitalTwinView: React.FC = () => {
  const {
    rawEvents,
    maintenanceSummary,
    facilityId,
    theme,
    isLoading,
    error,
    reloadAllData,
  } = useEhs();

  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [selectedSeverity,  setSelectedSeverity]  = useState<string>('ALL');
  const [selectedArea,      setSelectedArea]       = useState<string>('WAREHOUSE');
  const [viewMode,          setViewMode]           = useState<'3d' | 'table'>('3d');
  const [webglUnavailable,  setWebglUnavailable]   = useState(false);
  const [resetSignal,       setResetSignal]        = useState(0);
  const [inspectedEvent,    setInspectedEvent]     = useState<EhsEventRecord | null>(null);

  const handleWebGLUnavailable = useCallback(() => setWebglUnavailable(true), []);

  const filteredEvents = useMemo(() => {
    return rawEvents.filter(e => {
      const matchType = selectedEventType === 'ALL' || e.event_type    === selectedEventType;
      const matchSev  = selectedSeverity  === 'ALL' || e.risk_severity === selectedSeverity;
      return matchType && matchSev;
    });
  }, [rawEvents, selectedEventType, selectedSeverity]);

  const zoneSummaries = useMemo<ZoneMetricSummary[]>(() => {
    const map: Record<string, ZoneMetricSummary> = {};
    AREA_ORDER.forEach(area => {
      map[area] = {
        area, label: ZONE_LABELS[area] ?? area.replace(/_/g, ' '),
        total: 0, critical: 0, high: 0, medium: 0, low: 0,
        openActions: 0, hazards: 0, firstAid: 0, nearMiss: 0,
        permitExceptions: 0, auditFindings: 0,
      };
    });
    filteredEvents.forEach(e => {
      if (!map[e.area]) {
        map[e.area] = {
          area: e.area, label: ZONE_LABELS[e.area] ?? e.area.replace(/_/g, ' '),
          total: 0, critical: 0, high: 0, medium: 0, low: 0,
          openActions: 0, hazards: 0, firstAid: 0, nearMiss: 0,
          permitExceptions: 0, auditFindings: 0,
        };
      }
      const z = map[e.area];
      z.total += 1;
      if (e.risk_severity === 'CRITICAL') z.critical += 1;
      else if (e.risk_severity === 'HIGH')   z.high    += 1;
      else if (e.risk_severity === 'MEDIUM') z.medium  += 1;
      else if (e.risk_severity === 'LOW')    z.low     += 1;
      if (e.action_status === 'OPEN' || e.action_status === 'IN_PROGRESS') z.openActions += 1;
      if (e.event_type === 'HAZARD_OBSERVATION') z.hazards        += 1;
      else if (e.event_type === 'FIRST_AID')     z.firstAid       += 1;
      else if (e.event_type === 'NEAR_MISS')     z.nearMiss       += 1;
      else if (e.event_type === 'PERMIT_EXCEPTION') z.permitExceptions += 1;
      else if (e.event_type === 'AUDIT_FINDING')    z.auditFindings    += 1;
    });
    return AREA_ORDER.map(a => map[a]).concat(
      Object.values(map).filter(z => !AREA_ORDER.includes(z.area))
    );
  }, [filteredEvents]);

  const activeZone = useMemo(
    () => zoneSummaries.find(z => z.area === selectedArea) ?? zoneSummaries[0],
    [zoneSummaries, selectedArea]
  );

  const activeZoneEvents = useMemo(
    () => filteredEvents.filter(e => e.area === selectedArea),
    [filteredEvents, selectedArea]
  );

  const maxZoneTotal = useMemo(
    () => Math.max(...zoneSummaries.map(z => z.total), 1),
    [zoneSummaries]
  );

  // ── Top-level fleet telemetry ───────────────────────────────────────────
  const fleetStats = useMemo(() => {
    const critical   = filteredEvents.filter(e => e.risk_severity === 'CRITICAL').length;
    const openCapa   = filteredEvents.filter(e => e.action_status === 'OPEN' || e.action_status === 'IN_PROGRESS').length;
    const hazards    = filteredEvents.filter(e => e.event_type === 'HAZARD_OBSERVATION').length;
    return { total: filteredEvents.length, critical, openCapa, hazards };
  }, [filteredEvents]);

  const zoneTableColumns: Column<ZoneMetricSummary>[] = [
    {
      key: 'label', header: 'Operational Area', sortable: true,
      render: row => (
        <button type="button" onClick={() => setSelectedArea(row.area)}
          className="font-mono text-xs font-bold text-brand-purple hover:underline">
          {row.label}
        </button>
      ),
    },
    { key: 'total',       header: 'Total',      align: 'right', sortable: true,
      render: row => <span className="font-mono font-bold text-ink-primary tabular-nums">{row.total}</span> },
    { key: 'critical',    header: 'Critical',   align: 'right', sortable: true,
      render: row => <span className="font-mono font-semibold text-severity-critical-text tabular-nums">{row.critical}</span> },
    { key: 'hazards',     header: 'Hazards',    align: 'right', sortable: true,
      render: row => <span className="font-mono text-ink-secondary tabular-nums">{row.hazards}</span> },
    { key: 'firstAid',    header: 'First Aid',  align: 'right', sortable: true,
      render: row => <span className="font-mono text-ink-secondary tabular-nums">{row.firstAid}</span> },
    { key: 'nearMiss',    header: 'Near Miss',  align: 'right', sortable: true,
      render: row => <span className="font-mono text-ink-secondary tabular-nums">{row.nearMiss}</span> },
    { key: 'openActions', header: 'Open CAPA',  align: 'right', sortable: true,
      render: row => <span className="font-mono font-semibold text-brand-orange tabular-nums">{row.openActions}</span> },
  ];

  return (
    <div className="space-y-4">
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <PageHeader
        title="Industrial Digital Twin"
        description={`Conceptual 3D factory zone visualization — area-level aggregations from fact_ehs_event · ${facilityId === 'ALL' ? 'Fleet Scope' : facilityId}`}
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Industrial Digital Twin', active: true },
        ]}
        meta={
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-brand-purple-soft text-brand-purple border border-brand-purple/30">
            Conceptual 6-Zone Layout
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="inline-flex p-0.5 rounded-xl border border-line-subtle bg-canvas-subtle">
              <button type="button" onClick={() => setViewMode('3d')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === '3d' ? 'bg-canvas-surface shadow-sm text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'
                }`}>
                <Box className="w-3.5 h-3.5" /><span>3D Twin</span>
              </button>
              <button type="button" onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === 'table' ? 'bg-canvas-surface shadow-sm text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'
                }`}>
                <Table2 className="w-3.5 h-3.5" /><span>Table</span>
              </button>
            </div>
            {/* Reset camera */}
            {viewMode === '3d' && !webglUnavailable && (
              <button type="button" onClick={() => setResetSignal(p => p + 1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line-subtle bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-secondary transition-colors focus-ring"
                title="Reset camera">
                <RotateCcw className="w-3.5 h-3.5" /><span className="hidden sm:inline">Reset Camera</span>
              </button>
            )}
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={reloadAllData} />}

      {/* ── Fleet telemetry strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: TrendingUp,    label: 'Filtered Events',   value: fleetStats.total,    color: 'text-brand-blue'   },
          { icon: AlertTriangle, label: 'Critical Events',   value: fleetStats.critical,  color: 'text-severity-critical-text' },
          { icon: Zap,           label: 'Open CAPA',         value: fleetStats.openCapa,  color: 'text-brand-orange' },
          { icon: Shield,        label: 'Hazard Observations', value: fleetStats.hazards,  color: 'text-brand-purple' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex items-center gap-3 p-3 rounded-2xl border border-line-subtle bg-canvas-surface">
            <div className="w-8 h-8 rounded-xl bg-canvas-subtle flex items-center justify-center shrink-0">
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-lg font-bold text-ink-primary tabular-nums leading-none">{value}</div>
              <div className="text-[11px] text-ink-muted mt-0.5 leading-tight">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter + zone pill bar ────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-start lg:items-center">
        {/* Zone pills */}
        <div className="flex flex-wrap gap-1.5 flex-1">
          {zoneSummaries.map(z => {
            const isSelected = selectedArea === z.area;
            const dotClass =
              z.critical > 0
                ? 'bg-severity-critical-dot'
                : z.high > 0 || z.medium > 0
                ? 'bg-severity-high-dot'
                : 'bg-severity-success-dot';
            return (
              <button key={z.area} type="button" onClick={() => setSelectedArea(z.area)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all focus-ring ${
                  isSelected
                    ? 'bg-brand-purple text-white border-brand-purple shadow-sm'
                    : 'bg-canvas-surface text-ink-secondary border-line-subtle hover:border-line-default hover:text-ink-primary'
                }`}>
                {!isSelected && <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />}
                <span>{z.label}</span>
                <span className={`tabular-nums text-[10px] ${isSelected ? 'opacity-80' : 'text-ink-muted'}`}>{z.total}</span>
              </button>
            );
          })}
        </div>
        {/* Event type + severity filters */}
        <div className="flex items-center gap-2 shrink-0">
          <select aria-label="Event Type Filter" value={selectedEventType} onChange={e => setSelectedEventType(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-line-default bg-canvas-surface text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-purple cursor-pointer">
            <option value="ALL">All Event Types</option>
            <option value="HAZARD_OBSERVATION">Hazard Observation</option>
            <option value="FIRST_AID">First Aid</option>
            <option value="NEAR_MISS">Near Miss</option>
            <option value="PERMIT_EXCEPTION">Permit Exception</option>
            <option value="AUDIT_FINDING">Audit Finding</option>
          </select>
          <select aria-label="Severity Filter" value={selectedSeverity} onChange={e => setSelectedSeverity(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-line-default bg-canvas-surface text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-purple cursor-pointer">
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* ── Main split: 3D (8 cols) + Zone Inspector (4 cols) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: 3D canvas card + compact bottom strip */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle overflow-hidden flex flex-col">
            {viewMode === 'table' ? (
              <div className="p-4">
                <DataTable columns={zoneTableColumns} data={zoneSummaries} keyExtractor={row => row.area} pageSize={10} />
              </div>
            ) : webglUnavailable ? (
              /* WebGL fallback grid */
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-severity-warning-bg border border-severity-warning-border text-xs">
                  <MonitorOff className="w-4 h-4 text-brand-orange shrink-0" />
                  <div>
                    <strong className="text-ink-primary">WebGL Unavailable</strong>
                    <p className="text-ink-secondary">Displaying 2D spatial zone grid with identical Neon event aggregations.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {zoneSummaries.map(z => {
                    const statusColor = z.critical > 0 ? 'border-severity-critical-border bg-severity-critical-bg/30'
                      : z.high > 0 ? 'border-severity-high-border bg-severity-high-bg/30'
                      : 'border-line-subtle bg-canvas-subtle';
                    return (
                      <button key={z.area} type="button" onClick={() => setSelectedArea(z.area)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          selectedArea === z.area ? 'border-brand-purple ring-1 ring-brand-purple bg-brand-purple-soft/40' : statusColor
                        }`}>
                        <div className="font-mono text-xs font-bold text-ink-primary">{z.label}</div>
                        <div className="text-2xl font-bold font-mono text-ink-primary mt-1 tabular-nums">{z.total}</div>
                        <div className="text-[11px] font-mono text-ink-muted mt-0.5">
                          {z.critical > 0 && <span className="text-severity-critical-text">{z.critical} Critical · </span>}
                          {z.openActions} Open CAPA
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <Suspense fallback={
                  <div className="h-[360px] sm:h-[460px] lg:h-[520px] flex items-center justify-center">
                    <LoadingState title="Initializing 3D Factory Twin..." rows={4} />
                  </div>
                }>
                  <FactoryDigitalTwinCanvas
                    zones={zoneSummaries}
                    selectedArea={selectedArea}
                    onSelectArea={setSelectedArea}
                    theme={theme}
                    resetSignal={resetSignal}
                    onWebGLUnavailable={handleWebGLUnavailable}
                  />
                </Suspense>

                {/* Legend + interaction hints */}
                <div className="px-4 py-2.5 border-t border-line-subtle bg-canvas-subtle flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex flex-wrap items-center gap-3">
                    {[
                      { color: 'bg-[#DC2626]', label: 'Critical Risk' },
                      { color: 'bg-[#EA580C]', label: 'High / Medium' },
                      { color: 'bg-[#16A34A]', label: 'Lower Risk / Clear' },
                      { color: 'bg-[#6F3DBA]', label: 'Selected Zone' },
                    ].map(({ color, label }) => (
                      <span key={label} className="inline-flex items-center gap-1.5 text-ink-secondary">
                        <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                        {label}
                      </span>
                    ))}
                  </div>
                  <span className="font-mono text-ink-muted">Drag orbit · Scroll zoom · Click zone</span>
                </div>
              </>
            )}
          </div>

          {/* Zone Activity Comparison + Maintenance Context (Balanced 2-col row below 3D viewport) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-7 p-4 rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted mb-2.5">Zone Activity Comparison</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
                {zoneSummaries.map(z => {
                  const pct = maxZoneTotal > 0 ? Math.min((z.total / maxZoneTotal) * 100, 100) : 0;
                  const isActive = z.area === selectedArea;
                  return (
                    <button key={z.area} type="button" onClick={() => setSelectedArea(z.area)}
                      className="w-full text-left group focus-ring rounded">
                      <div className="flex items-center gap-1.5 text-[11px] mb-1">
                        <span className={`font-mono font-semibold truncate ${isActive ? 'text-brand-purple' : 'text-ink-secondary group-hover:text-ink-primary'} transition-colors`}>
                          {z.label}
                        </span>
                        <span className="font-mono text-ink-muted ml-auto tabular-nums">{z.total}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-canvas-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isActive ? 'bg-brand-purple' : z.critical > 0 ? 'bg-severity-critical-dot' : z.high > 0 ? 'bg-severity-high-dot' : 'bg-severity-success-dot'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-5 p-4 rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle text-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Wrench className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                  <span className="font-semibold text-ink-primary">Plant Maintenance Context</span>
                  <span className="ml-auto font-mono text-[10px] text-ink-muted">{facilityId}</span>
                </div>
                <p className="text-[11px] text-ink-secondary leading-relaxed">
                  {maintenanceSummary
                    ? `${maintenanceSummary.total_work_orders} total work orders · ${maintenanceSummary.by_priority.P1 ?? 0} P1 priority at plant level.`
                    : 'Loading plant maintenance summary…'}
                </p>
              </div>
              <p className="text-[10px] text-ink-muted mt-2 pt-2 border-t border-line-subtle">
                Area mapping omitted: <code className="font-mono text-ink-secondary">fact_maintenance_work_order</code> has no <code className="font-mono text-ink-secondary">area</code> column.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Zone inspector */}
        <aside className="lg:col-span-4 flex flex-col gap-3">
          {/* Zone summary card */}
          <div className="p-4 rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle space-y-3.5">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-line-subtle">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">Selected Zone</p>
                <h2 className="text-base font-bold text-ink-primary leading-tight mt-0.5">
                  {activeZone?.label ?? '—'}
                </h2>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-2xl font-bold text-ink-primary tabular-nums leading-none">
                  {activeZone?.total ?? 0}
                </p>
                <p className="text-[10px] text-ink-muted mt-0.5">total events</p>
              </div>
            </div>

            {isLoading && !rawEvents.length ? (
              <LoadingState rows={4} />
            ) : (
              <>
                {/* Critical + Open CAPA metric pair */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-severity-critical-bg/50 border border-severity-critical-border/40">
                    <p className="text-[10px] font-bold uppercase text-severity-critical-text">Critical</p>
                    <p className="font-mono text-xl font-bold text-ink-primary tabular-nums mt-0.5">
                      {activeZone?.critical ?? 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-severity-warning-bg/50 border border-severity-warning-border/40">
                    <p className="text-[10px] font-bold uppercase text-severity-high-text">Open CAPA</p>
                    <p className="font-mono text-xl font-bold text-ink-primary tabular-nums mt-0.5">
                      {activeZone?.openActions ?? 0}
                    </p>
                  </div>
                </div>

                {/* Severity distribution bars */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted">Severity Breakdown</p>
                  {[
                    { label: 'Critical', value: activeZone?.critical ?? 0, colorClass: 'bg-severity-critical-dot' },
                    { label: 'High',     value: activeZone?.high     ?? 0, colorClass: 'bg-severity-high-dot'     },
                    { label: 'Medium',   value: activeZone?.medium   ?? 0, colorClass: 'bg-severity-warning-dot'  },
                    { label: 'Low',      value: activeZone?.low      ?? 0, colorClass: 'bg-severity-success-dot'  },
                  ].map(({ label, value, colorClass }) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <span className="text-ink-muted w-14 shrink-0">{label}</span>
                      <SeverityBar value={value} max={activeZone?.total ?? 1} colorClass={colorClass} />
                    </div>
                  ))}
                </div>

                {/* Event composition */}
                <div className="space-y-1">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted">Event Composition</p>
                  {[
                    { label: 'Hazard Observations', val: activeZone?.hazards        ?? 0 },
                    { label: 'First Aid Incidents',  val: activeZone?.firstAid       ?? 0 },
                    { label: 'Near Misses',          val: activeZone?.nearMiss       ?? 0 },
                    { label: 'Permit Exceptions',    val: activeZone?.permitExceptions ?? 0 },
                    { label: 'Audit Findings',       val: activeZone?.auditFindings  ?? 0 },
                  ].map(item => (
                    <div key={item.label}
                      className="flex items-center justify-between py-1.5 border-b border-line-subtle/60 text-xs">
                      <span className="text-ink-secondary">{item.label}</span>
                      <span className="font-mono font-semibold text-ink-primary tabular-nums">{item.val}</span>
                    </div>
                  ))}
                </div>

                {/* Zone event record list */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted">
                      Zone Records
                    </p>
                    <span className="text-[10px] font-mono text-ink-muted tabular-nums">
                      {activeZoneEvents.length} total
                    </span>
                  </div>
                  <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
                    {activeZoneEvents.length === 0 ? (
                      <p className="text-xs text-ink-muted text-center py-3">No events match current filters</p>
                    ) : (
                      activeZoneEvents.slice(0, 8).map(evt => (
                        <button key={evt.ehs_event_id} type="button"
                          onClick={() => setInspectedEvent(evt)}
                          className="w-full text-left p-2.5 rounded-xl border border-line-subtle bg-canvas-subtle hover:border-brand-purple/40 hover:bg-canvas-surface transition-all flex items-center justify-between gap-2 focus-ring group">
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] font-bold text-brand-purple">{evt.ehs_event_id}</p>
                            <p className="text-[11px] text-ink-muted truncate mt-0.5">
                              {evt.hazard_category.replace(/_/g, ' ')} · {evt.plant_id}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <RiskBadge severity={evt.risk_severity} />
                            <ArrowRight className="w-3 h-3 text-ink-muted group-hover:text-brand-purple transition-colors" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Disclosure notice (compact inline) */}
      <div className="flex items-start gap-2 text-[11px] text-ink-muted px-1">
        <Info className="w-3.5 h-3.5 text-brand-blue shrink-0 mt-0.5" />
        <span>
          <strong className="text-ink-secondary">Conceptual Visualization:</strong> Zone placements represent categorical{' '}
          <code className="font-mono text-ink-primary">fact_ehs_event.area</code> values. No GPS coordinates, live sensor feeds, or machine-to-zone CAD mappings are implied.
        </span>
      </div>

      {/* Detail drawer */}
      <DetailDrawer
        isOpen={inspectedEvent !== null}
        onClose={() => setInspectedEvent(null)}
        title={inspectedEvent?.ehs_event_id ?? 'Event Details'}
        subtitle={inspectedEvent ? `${inspectedEvent.area} · ${inspectedEvent.plant_id} · Shift ${inspectedEvent.shift_id}` : undefined}
        badge={inspectedEvent ? <RiskBadge severity={inspectedEvent.risk_severity} /> : undefined}
      >
        {inspectedEvent && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-canvas-subtle border border-line-subtle">
              {[
                { label: 'Event Type',      value: inspectedEvent.event_type },
                { label: 'Hazard Category', value: inspectedEvent.hazard_category.replace(/_/g, ' ') },
                { label: 'Action Owner',    value: inspectedEvent.action_owner,     mono: true },
                { label: 'Permit ID',       value: inspectedEvent.permit_id,        mono: true, purple: true },
              ].map(({ label, value, mono, purple }) => (
                <div key={label}>
                  <span className="text-[10px] text-ink-muted uppercase tracking-wide">{label}</span>
                  <p className={`font-semibold mt-0.5 ${mono ? 'font-mono' : ''} ${purple ? 'text-brand-purple' : 'text-ink-primary'}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-between py-2 border-b border-line-subtle">
              <span className="text-ink-muted">Action Status</span>
              <StatusBadge status={
                inspectedEvent.action_status === 'CLOSED'      ? 'Closed'
                : inspectedEvent.action_status === 'IN_PROGRESS' ? 'In Progress'
                : 'Open'
              } />
            </div>
            <div className="flex justify-between py-2 border-b border-line-subtle">
              <span className="text-ink-muted">Event Timestamp</span>
              <span className="font-mono text-ink-primary">{inspectedEvent.event_ts}</span>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
