import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  EhsEventRecord,
  EventAggregationSummary,
  WorkforceAttendanceRecord,
  WorkforceSummary,
  MaintenanceWorkOrderRecord,
  MaintenanceSummary,
  HazardRecord,
  IncidentRecord,
  CorrectiveAction,
  PermitLotoRecord,
  OverviewMetrics,
  OperationsOverviewSummary,
  RegulatoryFramework,
  FrameworkDefinition,
  DatasetStatus,
  SeverityLevel,
} from '../types/ehs';
import { ehsApi } from '../services/api';
import { NotificationItem } from '../components/ui/NotificationPanel';

export const REGULATORY_FRAMEWORKS: Record<RegulatoryFramework, FrameworkDefinition> = {
  ISO_45001: {
    id: 'ISO_45001',
    label: 'ISO 45001:2018 (Occupational Health & Safety)',
    authority: 'International Organization for Standardization (ISO)',
    lotoStandard: 'Clause 8.1.2 - Eliminating hazards and reducing OH&S risks',
    incidentLogStandard: 'Clause 10.2 - Incident, non-conformity and corrective action',
    pelStandard: 'National/Regional Threshold Limit Values (TLV)',
    trainingStandard: 'Clause 7.2 - Competence and training verification',
  },
  OSHA_US: {
    id: 'OSHA_US',
    label: 'OSHA (United States Federal Standards)',
    authority: 'Occupational Safety and Health Administration (US Dept of Labor)',
    lotoStandard: '29 CFR 1910.147 - Control of Hazardous Energy (Lockout/Tagout)',
    incidentLogStandard: '29 CFR 1904 - Recording and Reporting Occupational Injuries',
    pelStandard: '29 CFR 1910.1000 - Air Contaminants & Permissible Exposure Limits',
    trainingStandard: 'OSHA 1910 / 1926 Safety Training Directives',
  },
  EU_DIRECTIVES: {
    id: 'EU_DIRECTIVES',
    label: 'EU Directives (Framework Directive 89/391/EEC)',
    authority: 'European Agency for Safety and Health at Work (EU-OSHA)',
    lotoStandard: 'Directive 2009/104/EC - Work equipment safety requirements',
    incidentLogStandard: 'National accident reporting laws pursuant to Directive 89/391/EEC',
    pelStandard: 'EU Indicative Occupational Exposure Limit Values (IOELVs)',
    trainingStandard: 'Article 12 - Worker information and training requirements',
  },
  FACTORIES_ACT_IN: {
    id: 'FACTORIES_ACT_IN',
    label: 'The Factories Act 1948 / OSH Code (India)',
    authority: 'Directorate General Factory Advice Service and Labour Institutes (DGFASLI)',
    lotoStandard: 'Section 21 to 24 - Machinery Fencing & Isolation',
    incidentLogStandard: 'Section 88 - Notice of certain accidents in Form 18',
    pelStandard: 'Second Schedule - Permissible Levels of Certain Chemical Substances',
    trainingStandard: 'Section 111A - Right of workers to safety training',
  },
  CUSTOM: {
    id: 'CUSTOM',
    label: 'Custom / Corporate Standard Operating Procedures',
    authority: 'Internal Corporate EHS Governance Board',
    lotoStandard: 'Corporate Standard EHS-SOP-LOTO-001',
    incidentLogStandard: 'Corporate Standard EHS-SOP-INC-004',
    pelStandard: 'Corporate Threshold Matrix',
    trainingStandard: 'Corporate Safety Qualification Policy',
  },
};

export const PLANT_LABELS: Record<string, string> = {
  ALL: 'All Production Plants (Enterprise Fleet)',
  'IN-KA-01': 'IN-KA-01 • Karnataka Manufacturing Plant',
  'IN-TN-01': 'IN-TN-01 • Tamil Nadu Manufacturing Plant',
};

interface EhsContextType {
  theme: 'light';
  toggleTheme: () => void;
  regulatoryFramework: RegulatoryFramework;
  framework: FrameworkDefinition;
  setRegulatoryFramework: (fw: RegulatoryFramework) => void;
  facilityId: string;
  facilityName: string;
  setFacilityId: (id: string) => void;

  // Live API Data & States (Strictly zero mock fallbacks)
  datasetStatuses: Record<string, DatasetStatus>;
  isDataConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  reloadAllData: () => Promise<void>;

  rawEvents: EhsEventRecord[];
  rawAttendance: WorkforceAttendanceRecord[];
  rawMaintenance: MaintenanceWorkOrderRecord[];
  overviewSummary: OperationsOverviewSummary | null;
  eventSummary: EventAggregationSummary | null;
  workforceSummary: WorkforceSummary | null;
  maintenanceSummary: MaintenanceSummary | null;

  // Normalized View Data
  hazards: HazardRecord[];
  incidents: IncidentRecord[];
  actions: CorrectiveAction[];
  permits: PermitLotoRecord[];
  metrics: OverviewMetrics;
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
}

const EhsContext = createContext<EhsContextType | undefined>(undefined);

const mapSeverity = (sev: string): SeverityLevel => {
  const s = (sev || '').toUpperCase();
  if (s === 'CRITICAL') return 'critical';
  if (s === 'HIGH') return 'high';
  if (s === 'MEDIUM') return 'warning';
  if (s === 'LOW') return 'success';
  return 'info';
};

interface CachedSummaries {
  overview: OperationsOverviewSummary;
  event: EventAggregationSummary;
  workforce: WorkforceSummary;
  maintenance: MaintenanceSummary;
  lastSyncedAt: string;
  ts: number;
}

interface CachedRaw {
  events: EhsEventRecord[];
  attendance: WorkforceAttendanceRecord[];
  maintenance: MaintenanceWorkOrderRecord[];
  ts: number;
}

const getSessionSummaries = (facility: string): CachedSummaries | null => {
  try {
    const raw = sessionStorage.getItem(`ehs_sum_${facility}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts < 180000) { // 3 minutes valid
        return parsed;
      }
    }
  } catch {}
  return null;
};

const getSessionRaw = (facility: string): CachedRaw | null => {
  try {
    const raw = sessionStorage.getItem(`ehs_raw_${facility}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts < 180000) {
        return parsed;
      }
    }
  } catch {}
  return null;
};

export const EhsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme: 'light' = 'light';
  const [regulatoryFramework, setRegulatoryFramework] = useState<RegulatoryFramework>('ISO_45001');
  const [facilityId, setFacilityId] = useState<string>('ALL');

  const initialSummaries = useMemo(() => getSessionSummaries(facilityId), [facilityId]);
  const initialRaw = useMemo(() => getSessionRaw(facilityId), [facilityId]);

  const [isLoading, setIsLoading] = useState<boolean>(!initialSummaries);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(initialSummaries?.lastSyncedAt || null);

  const [overviewSummary, setOverviewSummary] = useState<OperationsOverviewSummary | null>(initialSummaries?.overview || null);
  const overviewSummaryRef = useRef<OperationsOverviewSummary | null>(initialSummaries?.overview || null);
  overviewSummaryRef.current = overviewSummary;
  const inFlightRef = useRef(false);
  const [eventSummary, setEventSummary] = useState<EventAggregationSummary | null>(initialSummaries?.event || null);
  const [workforceSummary, setWorkforceSummary] = useState<WorkforceSummary | null>(initialSummaries?.workforce || null);
  const [maintenanceSummary, setMaintenanceSummary] = useState<MaintenanceSummary | null>(initialSummaries?.maintenance || null);

  const [rawEvents, setRawEvents] = useState<EhsEventRecord[]>(initialRaw?.events || []);
  const [rawAttendance, setRawAttendance] = useState<WorkforceAttendanceRecord[]>(initialRaw?.attendance || []);
  const [rawMaintenance, setRawMaintenance] = useState<MaintenanceWorkOrderRecord[]>(initialRaw?.maintenance || []);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());

  // Enforce strict light enterprise theme on root HTML element
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    root.classList.remove('dark');
  }, []);

  const toggleTheme = useCallback(() => {
    // Strict enterprise light theme enforced
  }, []);

  const facilityName = PLANT_LABELS[facilityId] || `Plant ${facilityId}`;

  const [datasetStatuses, setDatasetStatuses] = useState<Record<string, DatasetStatus>>({
    fact_ehs_event: {
      id: 'fact_ehs_event',
      fileName: 'fact_ehs_event.csv',
      displayName: 'EHS Event Master',
      description: 'Hazards, Near Misses, Incidents, Permits, and Corrective Actions',
      status: 'connecting',
      recordCount: null,
    },
    fact_workforce_attendance: {
      id: 'fact_workforce_attendance',
      fileName: 'fact_workforce_attendance.csv',
      displayName: 'Workforce Attendance',
      description: 'Shift rosters, employee attendance, and total hours worked',
      status: 'connecting',
      recordCount: null,
    },
    fact_maintenance_work_order: {
      id: 'fact_maintenance_work_order',
      fileName: 'fact_maintenance_work_order.csv',
      displayName: 'Maintenance Work Orders',
      description: 'Scheduled maintenance, failure modes, and downtime avoided',
      status: 'connecting',
      recordCount: null,
    },
  });

  const loadData = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    // Only show full-screen skeleton if we don't have summaries already displayed
    if (!overviewSummaryRef.current) {
      setIsLoading(true);
    }
    setError(null);
    const plantParam = facilityId !== 'ALL' ? facilityId : undefined;

    try {
      // Stage 1: Fast Parallel Fetch of Aggregated Summaries (typically < 0.8s)
      const [
        overviewRes,
        evtSummaryRes,
        wfSummaryRes,
        mwoSummaryRes,
      ] = await Promise.all([
        ehsApi.getGlobalOverview(plantParam),
        ehsApi.getEventSummary(plantParam),
        ehsApi.getWorkforceSummary(plantParam),
        ehsApi.getMaintenanceSummary(plantParam),
      ]);

      const syncTs = new Date().toISOString();
      setOverviewSummary(overviewRes);
      setEventSummary(evtSummaryRes);
      setWorkforceSummary(wfSummaryRes);
      setMaintenanceSummary(mwoSummaryRes);
      setLastSyncedAt(syncTs);
      setIsLoading(false); // Unblock the UI and render immediately!

      try {
        sessionStorage.setItem(`ehs_sum_${facilityId}`, JSON.stringify({
          overview: overviewRes,
          event: evtSummaryRes,
          workforce: wfSummaryRes,
          maintenance: mwoSummaryRes,
          lastSyncedAt: syncTs,
          ts: Date.now(),
        }));
      } catch {}

      setDatasetStatuses({
        fact_ehs_event: {
          id: 'fact_ehs_event',
          fileName: 'fact_ehs_event.csv',
          displayName: 'EHS Event Master',
          description: 'Hazards, Near Misses, Incidents, Permits, and Corrective Actions',
          status: 'ingested',
          recordCount: overviewRes.total_ehs_events,
          lastUpdated: syncTs,
        },
        fact_workforce_attendance: {
          id: 'fact_workforce_attendance',
          fileName: 'fact_workforce_attendance.csv',
          displayName: 'Workforce Attendance',
          description: 'Shift rosters, employee attendance, and total hours worked',
          status: 'ingested',
          recordCount: overviewRes.total_workforce_records,
          lastUpdated: syncTs,
        },
        fact_maintenance_work_order: {
          id: 'fact_maintenance_work_order',
          fileName: 'fact_maintenance_work_order.csv',
          displayName: 'Maintenance Work Orders',
          description: 'Scheduled maintenance, failure modes, and downtime avoided',
          status: 'ingested',
          recordCount: overviewRes.total_maintenance_work_orders,
          lastUpdated: syncTs,
        },
      });

      // Stage 2: Background Non-blocking Stream of Detailed Records
      void Promise.all([
        ehsApi.getEvents(plantParam ? { plant_id: plantParam, limit: 500 } : { limit: 500 }),
        ehsApi.getWorkforceRecords(plantParam ? { plant_id: plantParam, limit: 500 } : { limit: 500 }),
        ehsApi.getMaintenanceWorkOrders(plantParam ? { plant_id: plantParam, limit: 500 } : { limit: 500 }),
      ]).then(([eventsRes, attendanceRes, maintenanceRes]) => {
        setRawEvents(eventsRes);
        setRawAttendance(attendanceRes);
        setRawMaintenance(maintenanceRes);
        try {
          sessionStorage.setItem(`ehs_raw_${facilityId}`, JSON.stringify({
            events: eventsRes,
            attendance: attendanceRes,
            maintenance: maintenanceRes,
            ts: Date.now(),
          }));
        } catch {}
      }).catch(bgErr => {
        console.warn('Background record fetch warning:', bgErr);
      });

    } catch (err: any) {
      const msg = err?.message || 'Unable to connect to FastAPI / Neon PostgreSQL backend.';
      setError(msg);
      setDatasetStatuses(prev => ({
        fact_ehs_event: { ...prev.fact_ehs_event, status: 'error' },
        fact_workforce_attendance: { ...prev.fact_workforce_attendance, status: 'error' },
        fact_maintenance_work_order: { ...prev.fact_maintenance_work_order, status: 'error' },
      }));
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [facilityId]);

  // Loading all datasets costs network requests. Preload on overview/operations/monitoring pages
  const { pathname } = useLocation();
  const needsData =
    pathname === '/' ||
    pathname.startsWith('/overview') ||
    ['/operations', '/ehs-agent', '/agents', '/monitoring/digital-twin'].some(p => pathname.startsWith(p));
  const [dataWanted, setDataWanted] = useState(needsData);
  useEffect(() => {
    if (needsData) setDataWanted(true);
  }, [needsData]);

  useEffect(() => {
    if (dataWanted) loadData();
  }, [dataWanted, loadData]);

  const isDataConnected = overviewSummary !== null && !error;

  const hazards = useMemo<HazardRecord[]>(() => {
    return rawEvents
      .filter(e => e.event_type === 'HAZARD_OBSERVATION')
      .map(e => ({
        id: e.ehs_event_id,
        title: `${e.hazard_category.replace(/_/g, ' ')} Hazard in ${e.area}`,
        category: e.hazard_category.replace(/_/g, ' '),
        location: `${e.area} (${e.plant_id})`,
        plantId: e.plant_id,
        shift: `Shift ${e.shift_id}`,
        severity: mapSeverity(e.risk_severity),
        status: e.action_status === 'CLOSED' ? 'Controlled' : e.action_status === 'IN_PROGRESS' ? 'In Progress' : 'Open',
        assignedOwner: e.action_owner || 'Unassigned',
        reportedAt: e.event_ts,
        permitId: e.permit_id,
      }));
  }, [rawEvents]);

  const incidents = useMemo<IncidentRecord[]>(() => {
    return rawEvents
      .filter(e => e.event_type === 'FIRST_AID' || e.event_type === 'NEAR_MISS')
      .map(e => ({
        id: e.ehs_event_id,
        title: `${e.event_type.replace(/_/g, ' ')}: ${e.hazard_category.replace(/_/g, ' ')} in ${e.area}`,
        incidentType: e.event_type.replace(/_/g, ' '),
        category: e.hazard_category.replace(/_/g, ' '),
        severity: mapSeverity(e.risk_severity),
        location: `${e.area} (${e.plant_id})`,
        plantId: e.plant_id,
        shift: `Shift ${e.shift_id}`,
        investigationStatus: e.action_status === 'CLOSED' ? 'Closed' : e.action_status === 'IN_PROGRESS' ? 'Under Investigation' : 'Logged',
        responsiblePerson: e.action_owner || 'Unassigned',
        reportedDate: e.event_ts,
        lostTimeInjury: e.lost_time_injury,
        permitId: e.permit_id,
      }));
  }, [rawEvents]);

  const actions = useMemo<CorrectiveAction[]>(() => {
    return rawEvents.map(e => ({
      id: `CAPA-${e.ehs_event_id.replace('EHS-', '')}`,
      title: `Corrective Action for ${e.hazard_category.replace(/_/g, ' ')} (${e.area})`,
      sourceRef: e.ehs_event_id,
      priority: mapSeverity(e.risk_severity),
      owner: e.action_owner || 'Unassigned',
      dueDate: e.due_date || 'Pending Schedule',
      status: e.action_status === 'CLOSED' ? 'Closed' : e.action_status === 'IN_PROGRESS' ? 'In Progress' : 'Open',
      progress: e.action_status === 'CLOSED' ? 100 : e.action_status === 'IN_PROGRESS' ? 60 : 15,
      plantId: e.plant_id,
    }));
  }, [rawEvents]);

  const permits = useMemo<PermitLotoRecord[]>(() => {
    return rawEvents.map(e => ({
      id: e.permit_id,
      permitType: `${e.hazard_category.replace(/_/g, ' ')} PTW`,
      title: `Safe Work Authorization: ${e.area} (${e.plant_id})`,
      zone: e.area,
      plantId: e.plant_id,
      shift: `Shift ${e.shift_id}`,
      authorizedPerson: e.action_owner || 'Unassigned',
      validFrom: e.event_ts.split('T')[0],
      validTo: e.due_date,
      status: e.action_status === 'CLOSED' ? 'Closed' : e.event_type === 'PERMIT_EXCEPTION' ? 'Under Exception' : 'Active',
      hazardCategory: e.hazard_category.replace(/_/g, ' '),
    }));
  }, [rawEvents]);

  // Grounded Overview Metrics — strictly null when API hasn't returned (ZERO hardcoded database counts)
  const metrics = useMemo<OverviewMetrics>(() => {
    if (!overviewSummary) {
      return {
        totalEvents: null,
        totalWorkHours: null,
        hazardsCount: null,
        nearMissCount: null,
        incidentCount: null,
        permitExceptionsCount: null,
        openActionCount: null,
        closedActionCount: null,
        criticalCount: null,
        trainingComplianceRate: null,
        maintenanceP1Count: null,
        totalWorkforceRecords: null,
        totalMaintenanceOrders: null,
        calculatedFromDatasets: [],
      };
    }

    return {
      totalEvents: overviewSummary.total_ehs_events,
      totalWorkHours: overviewSummary.total_actual_work_hours,
      hazardsCount: overviewSummary.hazards_count,
      nearMissCount: overviewSummary.near_miss_count,
      incidentCount: overviewSummary.incidents_count,
      permitExceptionsCount: overviewSummary.permit_exceptions_count,
      openActionCount: overviewSummary.open_actions_count,
      closedActionCount: overviewSummary.closed_actions_count,
      criticalCount: overviewSummary.critical_events_count,
      trainingComplianceRate: overviewSummary.training_compliance_rate,
      maintenanceP1Count: overviewSummary.maintenance_p1_count,
      totalWorkforceRecords: overviewSummary.total_workforce_records,
      totalMaintenanceOrders: overviewSummary.total_maintenance_work_orders,
      calculatedFromDatasets: [
        `ehs_core.fact_ehs_event (${overviewSummary.total_ehs_events.toLocaleString('en-IN')})`,
        `ehs_core.fact_workforce_attendance (${overviewSummary.total_workforce_records.toLocaleString('en-IN')})`,
        `ehs_core.fact_maintenance_work_order (${overviewSummary.total_maintenance_work_orders.toLocaleString('en-IN')})`,
      ],
    };
  }, [overviewSummary]);

  // Derive real operational alerts from verified Neon records
  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    const criticalOpen = rawEvents
      .filter(e => e.risk_severity === 'CRITICAL' && e.action_status === 'OPEN')
      .slice(0, 4);

    criticalOpen.forEach(evt => {
      items.push({
        id: `alert-${evt.ehs_event_id}`,
        title: `${evt.ehs_event_id}: ${evt.hazard_category.replace(/_/g, ' ')}`,
        message: `Open CRITICAL ${evt.event_type.replace(/_/g, ' ').toLowerCase()} in ${evt.area} (${evt.plant_id}, Shift ${evt.shift_id}). Owner: ${evt.action_owner}.`,
        time: evt.event_ts.split('T')[0],
        level: 'critical',
        read: readNotificationIds.has(`alert-${evt.ehs_event_id}`),
      });
    });

    const expiredCount = workforceSummary?.by_training_compliance?.EXPIRED ?? 0;
    if (expiredCount > 0) {
      items.push({
        id: 'alert-training-expired',
        title: 'Safety Qualification Renewal Queue',
        message: `${expiredCount} shift attendance records show EXPIRED safety training compliance in ${facilityId === 'ALL' ? 'fleet scope' : facilityId}.`,
        time: 'Active Roster',
        level: 'warning',
        read: readNotificationIds.has('alert-training-expired'),
      });
    }

    return items;
  }, [rawEvents, workforceSummary, facilityId, readNotificationIds]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const markAllNotificationsRead = useCallback(() => {
    setReadNotificationIds(new Set(notifications.map(n => n.id)));
  }, [notifications]);

  const markNotificationRead = useCallback((id: string) => {
    setReadNotificationIds(prev => new Set([...prev, id]));
  }, []);

  const framework = REGULATORY_FRAMEWORKS[regulatoryFramework];

  return (
    <EhsContext.Provider
      value={{
        theme,
        toggleTheme,
        regulatoryFramework,
        framework,
        setRegulatoryFramework,
        facilityId,
        facilityName,
        setFacilityId,
        datasetStatuses,
        isDataConnected,
        isLoading,
        error,
        lastSyncedAt,
        reloadAllData: loadData,
        rawEvents,
        rawAttendance,
        rawMaintenance,
        overviewSummary,
        eventSummary,
        workforceSummary,
        maintenanceSummary,
        hazards,
        incidents,
        actions,
        permits,
        metrics,
        notifications,
        unreadNotificationsCount,
        markAllNotificationsRead,
        markNotificationRead,
      }}
    >
      {children}
    </EhsContext.Provider>
  );
};

export const useEhs = () => {
  const context = useContext(EhsContext);
  if (!context) {
    throw new Error('useEhs must be used within an EhsProvider');
  }
  return context;
};
