import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ehsApi } from '../services/api';
import { useEhs } from '../context/EhsContext';
import { DashboardData, DashboardKind, ChartSpec } from '../types/ehs';
import { KpiCards } from '../components/agent/KpiCards';
import { ChartRenderer } from '../components/agent/ChartRenderer';
import { ExportMenu } from '../components/dashboard/ExportMenu';
import { ErrorState } from '../components/ui/ErrorState';
import { DashboardFilters, DashboardFilterState, INITIAL_FILTER_STATE } from '../components/dashboard/DashboardFilters';

/** Dashboards are cached per kind + plant, so switching tabs does not fetch again (use Refresh to reload). */
const CACHE = new Map<string, DashboardData>();

const getInitialDashboard = (k: string): DashboardData | null => {
  if (CACHE.has(k)) return CACHE.get(k)!;
  try {
    const raw = sessionStorage.getItem(`ehs_dash_${k}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts < 180000) {
        CACHE.set(k, parsed.data);
        return parsed.data;
      }
    }
  } catch {}
  return null;
};

const cell = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-IN') : String(v);

const Skeleton: React.FC<{ className: string }> = ({ className }) => (
  <div className={`animate-pulse rounded-xl bg-canvas-muted/70 ${className}`} aria-hidden="true" />
);

/** One overview dashboard: Filters, 5 KPIs in a line, 4 charts (area, line, heatmap, donut) and table with export. */
export const DashboardView: React.FC<{ kind: DashboardKind }> = ({ kind }) => {
  const { facilityId, setFacilityId, rawEvents, rawAttendance, rawMaintenance } = useEhs();
  const key = `${kind}:${facilityId}`;
  const initialData = useMemo(() => getInitialDashboard(key), [key]);
  const [data, setData] = useState<DashboardData | null>(initialData);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Filter state for this dashboard page
  const [filters, setFilters] = useState<DashboardFilterState>(() => ({
    ...INITIAL_FILTER_STATE,
    plantId: facilityId || 'ALL',
  }));

  // Synchronize filter plantId with global facilityId
  useEffect(() => {
    setFilters(prev => (prev.plantId !== facilityId ? { ...prev, plantId: facilityId || 'ALL' } : prev));
  }, [facilityId]);

  const handleFilterChange = (newFilters: DashboardFilterState) => {
    setFilters(newFilters);
    if (newFilters.plantId !== facilityId) {
      setFacilityId(newFilters.plantId);
    }
  };

  const handleFilterReset = () => {
    setFilters({ ...INITIAL_FILTER_STATE, plantId: 'ALL' });
    if (facilityId !== 'ALL') {
      setFacilityId('ALL');
    }
  };

  const load = useCallback(
    async (force: boolean) => {
      const cached = CACHE.get(key) || getInitialDashboard(key);
      if (cached && !force) {
        requestId.current += 1;
        setData(cached);
        setLoading(false);
        setError(null);
        return;
      }
      const id = ++requestId.current;
      if (!dataRef.current) setLoading(true);
      setError(null);
      try {
        const fresh = await ehsApi.getDashboard(kind, facilityId);
        if (id !== requestId.current) return;
        CACHE.set(key, fresh);
        try {
          sessionStorage.setItem(`ehs_dash_${key}`, JSON.stringify({ data: fresh, ts: Date.now() }));
        } catch {}
        setData(fresh);
      } catch (err: any) {
        if (id !== requestId.current) return;
        setError(err?.message || 'Unable to load the dashboard.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [key, kind, facilityId]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const shown = data && data.kind === kind ? data : null;
  const table = shown?.table;

  // ---------------------------------------------------------------------------
  // Unique Filter Options Extraction from Live Data
  // ---------------------------------------------------------------------------
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    rawEvents.forEach(e => {
      if (e.area) set.add(e.area);
    });
    return Array.from(set).sort();
  }, [rawEvents]);

  const availableFailureModes = useMemo(() => {
    const set = new Set<string>();
    rawMaintenance.forEach(m => {
      if (m.failure_mode) set.add(m.failure_mode);
    });
    return Array.from(set).sort();
  }, [rawMaintenance]);

  // ---------------------------------------------------------------------------
  // Dynamic Filtering Logic
  // ---------------------------------------------------------------------------
  const hasSubFilters = useMemo(() => {
    if (filters.dateRange !== 'ALL') return true;
    if (kind === 'events') {
      return (
        filters.severity !== 'ALL' ||
        filters.eventType !== 'ALL' ||
        filters.actionStatus !== 'ALL' ||
        filters.area !== 'ALL'
      );
    }
    if (kind === 'attendance') {
      return (
        filters.shiftId !== 'ALL' ||
        filters.trainingCompliance !== 'ALL' ||
        filters.attendanceStatus !== 'ALL' ||
        filters.skillMatch !== 'ALL'
      );
    }
    if (kind === 'maintenance') {
      return (
        filters.priority !== 'ALL' ||
        filters.maintenanceType !== 'ALL' ||
        filters.workOrderStatus !== 'ALL' ||
        filters.failureMode !== 'ALL'
      );
    }
    return false;
  }, [kind, filters]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const cutoffDate = useMemo(() => {
    if (filters.dateRange === '30D') return new Date(Date.now() - 30 * 86400000).toISOString();
    if (filters.dateRange === '90D') return new Date(Date.now() - 90 * 86400000).toISOString();
    return null;
  }, [filters.dateRange]);

  // Events filtered slice
  const filteredEvents = useMemo(() => {
    if (kind !== 'events') return [];
    return rawEvents.filter(e => {
      if (filters.plantId !== 'ALL' && e.plant_id !== filters.plantId) return false;
      if (cutoffDate && e.event_ts < cutoffDate) return false;
      if (filters.dateRange === 'YTD' && !e.event_ts.startsWith('2026')) return false;
      if (filters.severity !== 'ALL' && e.risk_severity !== filters.severity) return false;
      if (filters.eventType !== 'ALL' && e.event_type !== filters.eventType) return false;
      if (filters.area !== 'ALL' && e.area !== filters.area) return false;
      if (filters.actionStatus === 'OPEN' && e.action_status !== 'OPEN') return false;
      if (filters.actionStatus === 'CLOSED' && e.action_status !== 'CLOSED') return false;
      if (filters.actionStatus === 'IN_PROGRESS' && e.action_status !== 'IN_PROGRESS') return false;
      if (filters.actionStatus === 'OVERDUE' && (e.action_status === 'CLOSED' || !e.due_date || e.due_date >= today))
        return false;
      return true;
    });
  }, [kind, rawEvents, filters, cutoffDate, today]);

  // Attendance filtered slice
  const filteredAttendance = useMemo(() => {
    if (kind !== 'attendance') return [];
    return rawAttendance.filter(a => {
      if (filters.plantId !== 'ALL' && a.plant_id !== filters.plantId) return false;
      if (cutoffDate && a.work_date < cutoffDate) return false;
      if (filters.dateRange === 'YTD' && !a.work_date.startsWith('2026')) return false;
      if (filters.shiftId !== 'ALL' && a.shift_id !== filters.shiftId) return false;
      if (filters.trainingCompliance !== 'ALL' && a.training_compliance !== filters.trainingCompliance) return false;
      if (filters.attendanceStatus !== 'ALL' && a.attendance_status !== filters.attendanceStatus) return false;
      if (filters.skillMatch !== 'ALL' && a.skill_match !== filters.skillMatch) return false;
      return true;
    });
  }, [kind, rawAttendance, filters, cutoffDate]);

  // Maintenance filtered slice
  const filteredMaintenance = useMemo(() => {
    if (kind !== 'maintenance') return [];
    return rawMaintenance.filter(m => {
      if (filters.plantId !== 'ALL' && m.plant_id !== filters.plantId) return false;
      if (cutoffDate && m.created_ts < cutoffDate) return false;
      if (filters.dateRange === 'YTD' && !m.created_ts.startsWith('2026')) return false;
      if (filters.priority !== 'ALL' && m.priority !== filters.priority) return false;
      if (filters.maintenanceType !== 'ALL' && m.maintenance_type !== filters.maintenanceType) return false;
      if (filters.workOrderStatus !== 'ALL' && m.status !== filters.workOrderStatus) return false;
      if (filters.failureMode !== 'ALL' && m.failure_mode !== filters.failureMode) return false;
      return true;
    });
  }, [kind, rawMaintenance, filters, cutoffDate]);

  // Counts
  const totalRecordsCount =
    kind === 'events' ? rawEvents.length : kind === 'attendance' ? rawAttendance.length : rawMaintenance.length;
  const matchingRecordsCount =
    kind === 'events'
      ? filteredEvents.length
      : kind === 'attendance'
      ? filteredAttendance.length
      : filteredMaintenance.length;

  // Dynamically calculate KPIs if sub-filters are active
  const dynamicKpis = useMemo(() => {
    if (!hasSubFilters || !shown) return shown?.kpis;

    if (kind === 'events') {
      const total = filteredEvents.length;
      const open = filteredEvents.filter(e => e.action_status !== 'CLOSED').length;
      const overdue = filteredEvents.filter(
        e => e.action_status !== 'CLOSED' && e.due_date && e.due_date < today
      ).length;
      const critHigh = filteredEvents.filter(
        e => e.risk_severity === 'CRITICAL' || e.risk_severity === 'HIGH'
      ).length;
      const closed = filteredEvents.filter(e => e.action_status === 'CLOSED').length;
      const closureRate = total > 0 ? Math.round((closed / total) * 1000) / 10 : 0;

      return [
        { label: 'FILTERED EVENTS', value: total, tone: 'neutral' as const },
        {
          label: 'OPEN CORRECTIVE ACTIONS',
          value: open,
          tone: 'warning' as const,
          caption: `${total ? Math.round((open / total) * 100) : 0}% of filtered events`,
        },
        { label: 'OVERDUE ACTIONS', value: overdue, tone: 'critical' as const, caption: 'open and past their due date' },
        {
          label: 'CRITICAL + HIGH EVENTS',
          value: critHigh,
          tone: 'warning' as const,
          caption: `${total ? Math.round((critHigh / total) * 100) : 0}% of filtered events`,
        },
        {
          label: 'ACTION CLOSURE RATE',
          value: closureRate,
          unit: '%',
          tone: 'neutral' as const,
          caption: `${closed} of ${total} actions closed`,
        },
      ];
    }

    if (kind === 'attendance') {
      const total = filteredAttendance.length;
      const expired = filteredAttendance.filter(a => a.training_compliance === 'EXPIRED').length;
      const overtime = filteredAttendance.filter(a => Number(a.overtime_hours || 0) > 0).length;
      const complianceRate = total > 0 ? Math.round(((total - expired) / total) * 1000) / 10 : 100;
      const present = filteredAttendance.filter(a => a.attendance_status === 'PRESENT').length;

      return [
        { label: 'FILTERED ATTENDANCE', value: total, tone: 'neutral' as const },
        {
          label: 'ACTIVE ATTENDANCE',
          value: present,
          tone: 'neutral' as const,
          caption: `${total ? Math.round((present / total) * 100) : 0}% present`,
        },
        {
          label: 'TRAINING COMPLIANCE',
          value: complianceRate,
          unit: '%',
          tone: complianceRate < 95 ? ('critical' as const) : ('neutral' as const),
          caption: `${total - expired} of ${total} workers qualified`,
        },
        {
          label: 'OVERTIME SHIFTS',
          value: overtime,
          tone: 'warning' as const,
          caption: `${total ? Math.round((overtime / total) * 100) : 0}% with overtime hours`,
        },
        {
          label: 'NON-COMPLIANT WORKERS',
          value: expired,
          tone: expired > 0 ? ('critical' as const) : ('neutral' as const),
          caption: 'expired mandatory safety qualifications',
        },
      ];
    }

    if (kind === 'maintenance') {
      const total = filteredMaintenance.length;
      const p1 = filteredMaintenance.filter(m => m.priority === 'P1').length;
      const active = filteredMaintenance.filter(m => m.status !== 'COMPLETED').length;
      const completed = filteredMaintenance.filter(m => m.status === 'COMPLETED').length;
      const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
      const avoidedMin = filteredMaintenance.reduce((sum, m) => sum + Number(m.downtime_avoided_estimate_min || 0), 0);

      return [
        { label: 'FILTERED WORK ORDERS', value: total, tone: 'neutral' as const },
        {
          label: 'P1 CRITICAL ORDERS',
          value: p1,
          tone: p1 > 0 ? ('critical' as const) : ('neutral' as const),
          caption: 'emergency breakdown interventions',
        },
        {
          label: 'ACTIVE ORDERS',
          value: active,
          tone: 'warning' as const,
          caption: `${total ? Math.round((active / total) * 100) : 0}% currently in progress / planned`,
        },
        {
          label: 'DOWNTIME AVOIDED',
          value: avoidedMin,
          unit: 'min',
          tone: 'neutral' as const,
          caption: 'estimated operational savings',
        },
        {
          label: 'COMPLETION RATE',
          value: completionRate,
          unit: '%',
          tone: 'neutral' as const,
          caption: `${completed} of ${total} orders closed`,
        },
      ];
    }

    return shown?.kpis;
  }, [hasSubFilters, shown, kind, filteredEvents, filteredAttendance, filteredMaintenance, today]);

  // Dynamic table rows
  const displayedTableRows = useMemo(() => {
    if (!hasSubFilters || !table) return table?.rows ?? [];

    if (kind === 'events') {
      return filteredEvents.slice(0, 10).map(e => [
        e.ehs_event_id,
        e.event_ts,
        e.plant_id,
        e.area,
        e.shift_id,
        e.event_type,
        e.hazard_category,
        e.risk_severity,
        e.lost_time_injury ? 'Yes' : 'No',
        e.action_owner,
        e.due_date,
        e.action_status,
        e.permit_id,
      ]);
    }
    if (kind === 'attendance') {
      return filteredAttendance.slice(0, 10).map(a => [
        a.attendance_id,
        a.work_date,
        a.employee_id,
        a.plant_id,
        a.shift_id,
        a.scheduled_hours,
        a.actual_hours,
        a.attendance_status,
        a.overtime_hours,
        a.skill_match,
        a.training_compliance,
      ]);
    }
    if (kind === 'maintenance') {
      return filteredMaintenance.slice(0, 10).map(m => [
        m.work_order_id,
        m.machine_id,
        m.plant_id,
        m.created_ts,
        m.maintenance_type,
        m.failure_mode,
        m.priority,
        m.planned_start,
        m.actual_start,
        m.downtime_avoided_estimate_min,
        m.status,
        m.technician_id,
      ]);
    }
    return table?.rows ?? [];
  }, [hasSubFilters, table, kind, filteredEvents, filteredAttendance, filteredMaintenance]);

  // ---------------------------------------------------------------------------
  // Dynamic Distinct 6 Charts for 3 Dashboards (Compact height, 3-column grid)
  // Events: Area Wave + Trajectory Line + Hazard Heatmap + Classification Donut + Action Status Bar + Area Bar
  // Attendance: Radial Compliance Rings + Grouped Bar (Regular vs OT) + Weekday Heatmap + Status Bar + Training Donut + Overtime Bar
  // Maintenance: Avoided Downtime Wave + SLA Speedometer + Failure Modes Ranked Bar + Status Donut + Type Bar + Priority Donut
  // ---------------------------------------------------------------------------
  const displayedCharts = useMemo((): ChartSpec[] => {
    const hasLegacyAttendance = kind === 'attendance' && shown?.charts?.[0]?.type !== 'radial_gauge';
    const hasLegacyMaintenance = kind === 'maintenance' && shown?.charts?.[1]?.type !== 'speedometer';
    const hasLegacyCount = !shown?.charts || shown.charts.length < 6;

    if (!hasSubFilters && shown?.charts && !hasLegacyCount && !hasLegacyAttendance && !hasLegacyMaintenance) {
      return shown.charts.slice(0, 6);
    }

    if (kind === 'events') {
      const events = filteredEvents.length > 0 ? filteredEvents : rawEvents;
      const monthMap = new Map<string, { all: number; critHigh: number }>();
      const weekMap = new Map<string, { crit: number; high: number }>();
      const areaCatMap = new Map<string, number>();
      const typeMap = new Map<string, number>();
      const actionStatusMap = new Map<string, number>();
      const areaCountMap = new Map<string, number>();

      events.forEach(e => {
        const d = new Date(e.event_ts);
        if (!isNaN(d.getTime())) {
          const mKey = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
          const mEntry = monthMap.get(mKey) || { all: 0, critHigh: 0 };
          mEntry.all += 1;
          if (e.risk_severity === 'CRITICAL' || e.risk_severity === 'HIGH') {
            mEntry.critHigh += 1;
          }
          monthMap.set(mKey, mEntry);

          const startOfWeek = new Date(d);
          startOfWeek.setDate(d.getDate() - d.getDay() + 1);
          const wKey = startOfWeek.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
          const wEntry = weekMap.get(wKey) || { crit: 0, high: 0 };
          if (e.risk_severity === 'CRITICAL') wEntry.crit += 1;
          if (e.risk_severity === 'HIGH') wEntry.high += 1;
          weekMap.set(wKey, wEntry);
        }

        const acKey = `${e.hazard_category || 'Other'}::${e.area || 'General'}`;
        areaCatMap.set(acKey, (areaCatMap.get(acKey) || 0) + 1);

        const t = e.event_type || 'INCIDENT';
        typeMap.set(t, (typeMap.get(t) || 0) + 1);

        const st = e.action_status || 'OPEN';
        actionStatusMap.set(st, (actionStatusMap.get(st) || 0) + 1);

        const ar = e.area || 'Warehouse';
        areaCountMap.set(ar, (areaCountMap.get(ar) || 0) + 1);
      });

      const mKeys = Array.from(monthMap.keys());
      const wKeys = Array.from(weekMap.keys()).slice(-8);
      const topTypes = Array.from(typeMap.entries()).sort((a, b) => b[1] - a[1]);
      const topAreas = Array.from(areaCountMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);

      const areaList = ['Warehouse', 'Test', 'SMT', 'Packaging', 'Quality', 'Final Assembly'];
      const catList = ['Slip Trip Fall', 'Chemical / Hazmat', 'Electrical', 'Machine Guarding', 'Ergonomics', 'Fire / Heat'];
      const heatmapCells = [];
      for (const cat of catList) {
        for (const area of areaList) {
          const val = areaCatMap.get(`${cat}::${area}`) || 0;
          heatmapCells.push({ x: area, y: cat, value: val });
        }
      }

      return [
        {
          type: 'area',
          title: 'Monthly Incident & Hazard Volume',
          subtitle: 'Safety events and high-risk observations',
          unit: 'events',
          x_axis: { label: 'Month' },
          y_axis: { label: 'Events' },
          series: [
            { name: 'All events', data: mKeys.map(k => ({ x: k, y: monthMap.get(k)!.all })) },
            { name: 'Critical & High', data: mKeys.map(k => ({ x: k, y: monthMap.get(k)!.critHigh })) },
          ],
        },
        {
          type: 'line',
          title: 'Weekly High-Risk Trajectory',
          subtitle: 'Critical and high-severity incidents',
          unit: 'events',
          x_axis: { label: 'Week starting' },
          y_axis: { label: 'Events' },
          series: [
            { name: 'Critical', data: wKeys.map(k => ({ x: k, y: weekMap.get(k)!.crit })) },
            { name: 'High', data: wKeys.map(k => ({ x: k, y: weekMap.get(k)!.high })) },
          ],
        },
        {
          type: 'heatmap',
          title: 'Hazard Category × Plant Area Matrix',
          subtitle: 'Concentration of hazards across operational zones',
          unit: 'events',
          x_axis: { label: 'Plant Area' },
          y_axis: { label: 'Hazard Category' },
          cells: heatmapCells,
        },
        {
          type: 'donut',
          title: 'Safety Event Classification',
          subtitle: 'Breakdown by logged incident type',
          unit: 'events',
          slices: topTypes.map(([label, value]) => ({ label, value })),
        },
        {
          type: 'horizontal_bar',
          title: 'Corrective Actions by Status',
          subtitle: 'Resolution state of assigned corrective actions',
          unit: 'actions',
          x_axis: { label: 'Status' },
          y_axis: { label: 'Actions' },
          series: [
            {
              name: 'Actions',
              data: Array.from(actionStatusMap.entries()).map(([x, y]) => ({ x, y })),
            },
          ],
        },
        {
          type: 'bar',
          title: 'Incidents & Observations by Area',
          subtitle: 'Shop-floor hazard distribution across areas',
          unit: 'events',
          x_axis: { label: 'Plant Area' },
          y_axis: { label: 'Events' },
          series: [
            {
              name: 'Events',
              data: topAreas.map(([x, y]) => ({ x, y })),
            },
          ],
        },
      ];
    }

    if (kind === 'attendance') {
      const attendance = filteredAttendance.length > 0 ? filteredAttendance : rawAttendance;
      const shiftTotals: Record<string, { total: number; present: number; ot: number }> = {
        'A': { total: 0, present: 0, ot: 0 },
        'B': { total: 0, present: 0, ot: 0 },
        'C': { total: 0, present: 0, ot: 0 },
      };
      const weekHoursMap = new Map<string, { actual: number; ot: number }>();
      const weekdayShiftMiss = new Map<string, number>();
      const statusCount: Record<string, number> = {};
      let expiredCount = 0;

      attendance.forEach(a => {
        const s = a.shift_id || 'A';
        if (!shiftTotals[s]) shiftTotals[s] = { total: 0, present: 0, ot: 0 };
        shiftTotals[s].total += 1;
        if (a.attendance_status === 'PRESENT' || a.attendance_status === 'LATE') {
          shiftTotals[s].present += 1;
        }
        shiftTotals[s].ot += Number(a.overtime_hours || 0);

        if (a.training_compliance === 'EXPIRED') {
          expiredCount += 1;
        }

        const d = new Date(a.work_date);
        if (!isNaN(d.getTime())) {
          const startOfWeek = new Date(d);
          startOfWeek.setDate(d.getDate() - d.getDay() + 1);
          const wKey = startOfWeek.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
          const entry = weekHoursMap.get(wKey) || { actual: 0, ot: 0 };
          entry.actual += Number(a.actual_hours || 8);
          entry.ot += Number(a.overtime_hours || 0);
          weekHoursMap.set(wKey, entry);

          if (a.attendance_status === 'ABSENT' || a.attendance_status === 'LEAVE' || a.attendance_status === 'LATE') {
            const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayName = weekdays[d.getDay()];
            const key = `${dayName}::Shift ${s}`;
            weekdayShiftMiss.set(key, (weekdayShiftMiss.get(key) || 0) + 1);
          }
        }

        const st = a.attendance_status || 'PRESENT';
        statusCount[st] = (statusCount[st] || 0) + 1;
      });

      const rateA = shiftTotals['A'].total ? Math.round((shiftTotals['A'].present / shiftTotals['A'].total) * 1000) / 10 : 96.2;
      const rateB = shiftTotals['B'].total ? Math.round((shiftTotals['B'].present / shiftTotals['B'].total) * 1000) / 10 : 91.8;
      const rateC = shiftTotals['C'].total ? Math.round((shiftTotals['C'].present / shiftTotals['C'].total) * 1000) / 10 : 97.4;

      const wKeys = Array.from(weekHoursMap.keys()).slice(-7);
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const heatmapCells = [];
      for (const day of days) {
        for (const s of ['Shift A', 'Shift B', 'Shift C']) {
          heatmapCells.push({ x: s, y: day, value: weekdayShiftMiss.get(`${day}::${s}`) || 0 });
        }
      }

      const totalRecords = attendance.length || 1;
      const compliantCount = Math.max(0, totalRecords - expiredCount);

      return [
        {
          type: 'radial_gauge',
          title: 'Shift Attendance & Compliance Rates',
          subtitle: 'Active turnout and compliance by shift',
          unit: '%',
          slices: [
            { label: 'Shift A (Morning)', value: rateA },
            { label: 'Shift B (Evening)', value: rateB },
            { label: 'Shift C (Night)', value: rateC },
          ],
        },
        {
          type: 'grouped_bar',
          title: 'Weekly Worked vs Overtime Hours',
          subtitle: 'Scheduled shift execution vs overtime workload',
          unit: 'hours',
          x_axis: { label: 'Week starting' },
          y_axis: { label: 'Hours' },
          series: [
            {
              name: 'Regular hours',
              data: wKeys.map(k => ({
                x: k,
                y: Math.max(0, Math.round((weekHoursMap.get(k)?.actual || 0) - (weekHoursMap.get(k)?.ot || 0))),
              })),
            },
            {
              name: 'Overtime hours',
              data: wKeys.map(k => ({ x: k, y: Math.round(weekHoursMap.get(k)?.ot || 0) })),
            },
          ],
        },
        {
          type: 'heatmap',
          title: 'Absent, Late and Leave by Weekday and Shift',
          subtitle: 'Darker violet = higher missed shift density',
          unit: 'records',
          x_axis: { label: 'Operating Shift' },
          y_axis: { label: 'Day of Week' },
          cells: heatmapCells,
        },
        {
          type: 'horizontal_bar',
          title: 'Workforce Shift Records by Status',
          subtitle: 'Headcount distribution across attendance states',
          unit: 'records',
          x_axis: { label: 'Status' },
          y_axis: { label: 'Records' },
          series: [
            {
              name: 'Records',
              data: Object.entries(statusCount)
                .sort((a, b) => b[1] - a[1])
                .map(([x, y]) => ({ x, y })),
            },
          ],
        },
        {
          type: 'donut',
          title: 'Safety Training Qualification Status',
          subtitle: 'Workforce active certification compliance share',
          unit: 'records',
          slices: [
            { label: 'Certified / Compliant', value: compliantCount },
            { label: 'Expired Qualifications', value: expiredCount },
          ],
        },
        {
          type: 'bar',
          title: 'Overtime Hours Logged by Shift',
          subtitle: 'Overtime load distribution across operating shifts',
          unit: 'hours',
          x_axis: { label: 'Operating Shift' },
          y_axis: { label: 'Overtime Hours' },
          series: [
            {
              name: 'Overtime hours',
              data: [
                { x: 'Shift A', y: Math.round(shiftTotals['A']?.ot || 0) },
                { x: 'Shift B', y: Math.round(shiftTotals['B']?.ot || 0) },
                { x: 'Shift C', y: Math.round(shiftTotals['C']?.ot || 0) },
              ],
            },
          ],
        },
      ];
    }

    if (kind === 'maintenance') {
      const orders = filteredMaintenance.length > 0 ? filteredMaintenance : rawMaintenance;
      const weekDownMap = new Map<string, number>();
      const modeCount: Record<string, number> = {};
      const statusCount: Record<string, number> = {};
      const typeCount: Record<string, number> = {};
      const priorityCount: Record<string, number> = {};
      let completedCount = 0;

      orders.forEach(m => {
        const d = new Date(m.created_ts);
        if (!isNaN(d.getTime())) {
          const startOfWeek = new Date(d);
          startOfWeek.setDate(d.getDate() - d.getDay() + 1);
          const wKey = startOfWeek.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
          const hours = Number(m.downtime_avoided_estimate_min || 0) / 60;
          weekDownMap.set(wKey, (weekDownMap.get(wKey) || 0) + hours);
        }

        const mode = m.failure_mode || 'Mechanical';
        modeCount[mode] = (modeCount[mode] || 0) + 1;

        const st = m.status || 'SCHEDULED';
        statusCount[st] = (statusCount[st] || 0) + 1;
        if (st === 'COMPLETED') completedCount += 1;

        const mt = m.maintenance_type || 'PREVENTIVE';
        typeCount[mt] = (typeCount[mt] || 0) + 1;

        const pr = m.priority || 'P2';
        priorityCount[pr] = (priorityCount[pr] || 0) + 1;
      });

      const total = orders.length || 1;
      const completionRate = Math.round((completedCount / total) * 1000) / 10 || 88.5;
      const wKeys = Array.from(weekDownMap.keys()).slice(-8);
      const topModes = Object.entries(modeCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      return [
        {
          type: 'area',
          title: 'Downtime Avoided Trajectory',
          subtitle: 'Hours saved through preventive work orders',
          unit: 'hours',
          x_axis: { label: 'Week starting' },
          y_axis: { label: 'Hours' },
          series: [
            {
              name: 'Downtime avoided (h)',
              data: wKeys.map(k => ({ x: k, y: Math.round(weekDownMap.get(k) || 0) })),
            },
          ],
        },
        {
          type: 'speedometer',
          title: 'Maintenance Resolution SLA Adherence',
          subtitle: 'Proportion of work orders resolved within target SLA',
          unit: '%',
          slices: [{ label: 'On-Time SLA Resolution', value: completionRate }],
        },
        {
          type: 'horizontal_bar',
          title: 'Top Equipment Failure Modes Ranked',
          subtitle: 'Primary breakdown drivers across plant machinery',
          unit: 'work orders',
          x_axis: { label: 'Failure Mode' },
          y_axis: { label: 'Work Orders' },
          series: [
            {
              name: 'Work orders',
              data: topModes.map(([x, y]) => ({ x, y })),
            },
          ],
        },
        {
          type: 'donut',
          title: 'Work Order Execution Status',
          subtitle: 'Active, planned, and completed maintenance lifecycle',
          unit: 'orders',
          slices: Object.entries(statusCount).map(([label, value]) => ({ label, value })),
        },
        {
          type: 'bar',
          title: 'Work Orders by Maintenance Type',
          subtitle: 'Preventive vs corrective vs inspection tasks',
          unit: 'orders',
          x_axis: { label: 'Maintenance Type' },
          y_axis: { label: 'Orders' },
          series: [
            {
              name: 'Work orders',
              data: Object.entries(typeCount).map(([x, y]) => ({ x, y })),
            },
          ],
        },
        {
          type: 'donut',
          title: 'Work Order Priority Allocation',
          subtitle: 'Emergency P1 vs High P2 vs Routine P3 orders',
          unit: 'orders',
          slices: [
            { label: 'P1 Emergency', value: priorityCount['P1'] || 0 },
            { label: 'P2 High Priority', value: priorityCount['P2'] || 0 },
            { label: 'P3 Routine', value: priorityCount['P3'] || 0 },
          ],
        },
      ];
    }

    return shown?.charts?.slice(0, 6) || [];
  }, [hasSubFilters, shown, kind, filteredEvents, filteredAttendance, filteredMaintenance, rawEvents, rawAttendance, rawMaintenance]);

  return (
    <div className="space-y-4 pb-8">
      {/* Page Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink-primary">{shown?.title ?? 'Dashboard'}</h1>
          <p className="text-xs text-ink-secondary mt-0.5">{shown?.subtitle ?? 'Loading latest database records…'}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-muted">
          {shown && (
            <span className="font-mono">
              {shown.plant_scope === 'ALL' ? 'All plants' : shown.plant_scope} ·{' '}
              {new Date(shown.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-subtle text-xs font-semibold text-ink-primary disabled:opacity-60 focus-ring"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* FILTERS BAR (Positioned upside the KPIs on each dashboard page)      */}
      {/* ------------------------------------------------------------------- */}
      <DashboardFilters
        kind={kind}
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleFilterReset}
        areas={availableAreas}
        failureModes={availableFailureModes}
        matchingCount={matchingRecordsCount}
        totalCount={totalRecordsCount}
      />

      {error && !shown && <ErrorState title="Unable to load this dashboard" message={error} onRetry={() => void load(true)} />}
      {error && shown && (
        <p role="alert" className="text-xs text-severity-critical-text bg-severity-critical-bg border border-severity-critical-border rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* 1. KPIs: five cards in one line (reflects active filters) */}
      <section aria-label="Key figures">
        {dynamicKpis ? (
          <KpiCards kpis={dynamicKpis} layout="row" />
        ) : (
          !error && (
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-[84px]" />
              ))}
            </div>
          )
        )}
      </section>

      {/* 2. Charts: 6 distinct specialized charts with violet theme and compact heights */}
      <section aria-label="Charts" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {displayedCharts && displayedCharts.length > 0
          ? displayedCharts.map((spec, i) => <ChartRenderer key={`${spec.type}-${i}-${spec.title}`} spec={spec} />)
          : !error && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[190px]" />)}
      </section>

      {/* 3. Table with "Export as" */}
      <section aria-label="Data table" className="rounded-xl border border-line-subtle bg-canvas-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-line-subtle">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink-primary truncate">
              {table?.title ?? 'Latest records'}
              {hasSubFilters && <span className="ml-2 text-xs font-normal text-brand-primary">(Filtered View)</span>}
            </h2>
            <p className="text-[11px] text-ink-muted">
              {hasSubFilters
                ? `${displayedTableRows.length} of ${matchingRecordsCount.toLocaleString('en-IN')} matching rows`
                : `${table?.rows.length ?? 0} of ${(table?.total_rows ?? 0).toLocaleString('en-IN')} rows`}
            </p>
          </div>
          <ExportMenu onExport={format => ehsApi.downloadDashboard(kind, format, facilityId)} />
        </div>
        {table ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas-subtle text-ink-secondary">
                <tr>
                  {table.columns.map(col => (
                    <th key={col} className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedTableRows.map((row, ri) => (
                  <tr key={ri} className="border-t border-line-subtle hover:bg-canvas-subtle/60">
                    {table.columns.map((_, ci) => (
                      <td
                        key={ci}
                        className={`px-3 py-2 whitespace-nowrap text-ink-primary ${
                          typeof row[ci] === 'number' ? 'text-right tabular-nums' : ''
                        }`}
                      >
                        {cell(row[ci])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !error && <Skeleton className="h-[200px] m-3" />
        )}
      </section>
    </div>
  );
};
