import React from 'react';
import {
  Filter,
  RotateCcw,
  Building2,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MapPin,
  Wrench,
  Users,
  Shield,
} from 'lucide-react';
import { DashboardKind } from '../../types/ehs';

export interface DashboardFilterState {
  plantId: string;
  dateRange: 'ALL' | '30D' | '90D' | 'YTD';
  // Events
  severity: string;
  eventType: string;
  actionStatus: string;
  area: string;
  // Attendance
  shiftId: string;
  trainingCompliance: string;
  attendanceStatus: string;
  skillMatch: string;
  // Maintenance
  priority: string;
  maintenanceType: string;
  workOrderStatus: string;
  failureMode: string;
}

export const INITIAL_FILTER_STATE: DashboardFilterState = {
  plantId: 'ALL',
  dateRange: 'ALL',
  severity: 'ALL',
  eventType: 'ALL',
  actionStatus: 'ALL',
  area: 'ALL',
  shiftId: 'ALL',
  trainingCompliance: 'ALL',
  attendanceStatus: 'ALL',
  skillMatch: 'ALL',
  priority: 'ALL',
  maintenanceType: 'ALL',
  workOrderStatus: 'ALL',
  failureMode: 'ALL',
};

interface DashboardFiltersProps {
  kind: DashboardKind;
  filters: DashboardFilterState;
  onFilterChange: (filters: DashboardFilterState) => void;
  onReset: () => void;
  areas?: string[];
  failureModes?: string[];
  matchingCount?: number;
  totalCount?: number;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  kind,
  filters,
  onFilterChange,
  onReset,
  areas = [],
  failureModes = [],
  matchingCount,
  totalCount,
}) => {
  const update = <K extends keyof DashboardFilterState>(key: K, val: DashboardFilterState[K]) => {
    onFilterChange({ ...filters, [key]: val });
  };

  // Determine how many non-default filters are active
  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'plantId') return v !== 'ALL';
    if (k === 'dateRange') return v !== 'ALL';
    if (kind === 'events' && ['severity', 'eventType', 'actionStatus', 'area'].includes(k)) return v !== 'ALL';
    if (kind === 'attendance' && ['shiftId', 'trainingCompliance', 'attendanceStatus', 'skillMatch'].includes(k)) return v !== 'ALL';
    if (kind === 'maintenance' && ['priority', 'maintenanceType', 'workOrderStatus', 'failureMode'].includes(k)) return v !== 'ALL';
    return false;
  }).length;

  const selectClass =
    'h-8 pl-2.5 pr-8 py-1 bg-canvas-surface hover:bg-canvas-subtle border border-line-subtle focus:border-brand-primary rounded-lg text-xs font-semibold text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-primary transition-colors cursor-pointer';

  return (
    <div className="rounded-xl border border-line-subtle bg-canvas-surface shadow-xs p-3 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter Title & Active Indicator */}
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-canvas-subtle text-ink-secondary border border-line-subtle">
            <Filter className="w-3.5 h-3.5" />
          </span>
          <span className="text-xs font-bold text-ink-primary uppercase tracking-wider">
            Filters
          </span>
          {activeCount > 0 && (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-subtle text-brand-primary border border-brand-primary/20">
              {activeCount} active
            </span>
          )}
          {matchingCount !== undefined && totalCount !== undefined && activeCount > 0 && (
            <span className="text-[11px] text-ink-muted">
              ({matchingCount.toLocaleString('en-IN')} of {totalCount.toLocaleString('en-IN')} records)
            </span>
          )}
        </div>

        {/* Reset Button */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-secondary hover:text-severity-critical-text transition-colors py-1 px-2 rounded-md hover:bg-canvas-subtle"
          >
            <RotateCcw className="w-3 h-3" />
            Reset filters
          </button>
        )}
      </div>

      {/* Filter Selectors Bar */}
      <div className="mt-2.5 pt-2.5 border-t border-line-subtle flex flex-wrap items-center gap-2.5">
        {/* 1. Plant / Fleet Scope */}
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-ink-muted shrink-0" />
          <select
            value={filters.plantId}
            onChange={e => update('plantId', e.target.value)}
            className={selectClass}
            aria-label="Plant Filter"
          >
            <option value="ALL">All Plants (Enterprise Fleet)</option>
            <option value="IN-KA-01">IN-KA-01 • Karnataka Plant</option>
            <option value="IN-TN-01">IN-TN-01 • Tamil Nadu Plant</option>
          </select>
        </div>

        {/* 2. Date Range Filter */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-ink-muted shrink-0" />
          <select
            value={filters.dateRange}
            onChange={e => update('dateRange', e.target.value as DashboardFilterState['dateRange'])}
            className={selectClass}
            aria-label="Date Range Filter"
          >
            <option value="ALL">All Time</option>
            <option value="30D">Last 30 Days</option>
            <option value="90D">Last 90 Days</option>
            <option value="YTD">Current Year (2026)</option>
          </select>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* KIND-SPECIFIC CONTROLS                                           */}
        {/* ---------------------------------------------------------------- */}

        {/* === EVENTS FILTERS === */}
        {kind === 'events' && (
          <>
            {/* Severity */}
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <select
                value={filters.severity}
                onChange={e => update('severity', e.target.value)}
                className={selectClass}
                aria-label="Severity Filter"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical Severity</option>
                <option value="HIGH">High Severity</option>
                <option value="MEDIUM">Medium Severity</option>
                <option value="LOW">Low Severity</option>
              </select>
            </div>

            {/* Event Type */}
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <select
                value={filters.eventType}
                onChange={e => update('eventType', e.target.value)}
                className={selectClass}
                aria-label="Event Type Filter"
              >
                <option value="ALL">All Event Types</option>
                <option value="HAZARD_OBSERVATION">Hazard Observation</option>
                <option value="NEAR_MISS">Near Miss</option>
                <option value="FIRST_AID">First Aid Incident</option>
                <option value="PERMIT_EXCEPTION">Permit Exception</option>
                <option value="AUDIT_FINDING">Audit Finding</option>
              </select>
            </div>

            {/* Action Status */}
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <select
                value={filters.actionStatus}
                onChange={e => update('actionStatus', e.target.value)}
                className={selectClass}
                aria-label="Action Status Filter"
              >
                <option value="ALL">All Action Statuses</option>
                <option value="OPEN">Open Actions</option>
                <option value="OVERDUE">Overdue Actions</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CLOSED">Closed Actions</option>
              </select>
            </div>

            {/* Plant Area */}
            {areas.length > 0 && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                <select
                  value={filters.area}
                  onChange={e => update('area', e.target.value)}
                  className={selectClass}
                  aria-label="Area Filter"
                >
                  <option value="ALL">All Plant Areas</option>
                  {areas.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {/* === ATTENDANCE FILTERS === */}
        {kind === 'attendance' && (
          <>
            {/* Shift */}
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <select
                value={filters.shiftId}
                onChange={e => update('shiftId', e.target.value)}
                className={selectClass}
                aria-label="Shift Filter"
              >
                <option value="ALL">All Shifts</option>
                <option value="A">Shift A (Morning)</option>
                <option value="B">Shift B (Evening)</option>
                <option value="C">Shift C (Night)</option>
              </select>
            </div>

            {/* Training Compliance */}
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <select
                value={filters.trainingCompliance}
                onChange={e => update('trainingCompliance', e.target.value)}
                className={selectClass}
                aria-label="Training Compliance Filter"
              >
                <option value="ALL">All Training Statuses</option>
                <option value="CURRENT">Compliant (Current)</option>
                <option value="EXPIRED">Non-Compliant (Expired)</option>
              </select>
            </div>

            {/* Attendance Status */}
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <select
                value={filters.attendanceStatus}
                onChange={e => update('attendanceStatus', e.target.value)}
                className={selectClass}
                aria-label="Attendance Status Filter"
              >
                <option value="ALL">All Attendance</option>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="LATE">Late Arrival</option>
                <option value="LEAVE">On Leave</option>
              </select>
            </div>

            {/* Skill Match */}
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <select
                value={filters.skillMatch}
                onChange={e => update('skillMatch', e.target.value)}
                className={selectClass}
                aria-label="Skill Match Filter"
              >
                <option value="ALL">All Skill Matches</option>
                <option value="MATCHED">Matched Station Skill</option>
                <option value="GAP">Skill Gap Detected</option>
              </select>
            </div>
          </>
        )}

        {/* === MAINTENANCE FILTERS === */}
        {kind === 'maintenance' && (
          <>
            {/* Priority */}
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <select
                value={filters.priority}
                onChange={e => update('priority', e.target.value)}
                className={selectClass}
                aria-label="Priority Filter"
              >
                <option value="ALL">All Priorities</option>
                <option value="P1">P1 (Emergency / Critical)</option>
                <option value="P2">P2 (Urgent Maintenance)</option>
                <option value="P3">P3 (Routine Preventive)</option>
              </select>
            </div>

            {/* Maintenance Type */}
            <div className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <select
                value={filters.maintenanceType}
                onChange={e => update('maintenanceType', e.target.value)}
                className={selectClass}
                aria-label="Maintenance Type Filter"
              >
                <option value="ALL">All Maintenance Types</option>
                <option value="PREVENTIVE">Preventive Maintenance</option>
                <option value="CORRECTIVE">Corrective Maintenance</option>
                <option value="PREDICTIVE">Predictive Sensor Trigger</option>
              </select>
            </div>

            {/* Work Order Status */}
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <select
                value={filters.workOrderStatus}
                onChange={e => update('workOrderStatus', e.target.value)}
                className={selectClass}
                aria-label="Status Filter"
              >
                <option value="ALL">All Statuses</option>
                <option value="PLANNED">Planned / Queued</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            {/* Failure Mode */}
            {failureModes.length > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                <select
                  value={filters.failureMode}
                  onChange={e => update('failureMode', e.target.value)}
                  className={selectClass}
                  aria-label="Failure Mode Filter"
                >
                  <option value="ALL">All Failure Modes</option>
                  {failureModes.map(fm => (
                    <option key={fm} value={fm}>
                      {fm}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
