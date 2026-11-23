/**
 * EHS Safety AI API Service Layer
 * Connects directly to FastAPI backend running on Neon PostgreSQL.
 */
import {
  EhsEventRecord,
  EventAggregationSummary,
  WorkforceAttendanceRecord,
  WorkforceSummary,
  MaintenanceWorkOrderRecord,
  MaintenanceSummary,
  OperationsOverviewSummary,
  AIQueryResponse,
  DashboardData,
  DashboardExportFormat,
  DashboardKind,
  AgentMetadata,
  DomoConnectivityStatus,
  VideoModelAvailability,
  VideoAnalysisResult,
  VideoLibraryResponse,
  AlertListResponse,
  AlertSummary,
  AlertActivityFeedItem,
  AlertStatus,
  CapaOverdueResponse,
  NotificationListResponse,
  SafetyAlertDetail,
  DriverStatusResponse,
  ConnectorDBHealthItem,
  ConnectorResponse,
  ConnectorCreateRequest,
  PrimaryDatabaseInfo,
  ConnectorUpdateRequest,
  ConnectionTestRequest,
  ConnectionTestResult,
  ConnectorTestHistoryItem,
  DatabaseMetadata,
  TableMetadata,
  CollectionMetadata,
  DataPreviewRequest,
  DataPreviewResponse,
  ConnectorOverviewStats,
  ConnectorModuleMappingItem,
  ConnectorAgentMappingItem,
  ConnectorAuditLogItem,
} from '../types/ehs';

/**
 * API base URL. Empty string (default) = same-origin requests like `/api/v1/...`,
 * which the Vite dev/preview proxy forwards to the backend (see vite.config.ts).
 * Set VITE_API_URL (e.g. https://api.example.com) to target a remote backend directly;
 * that backend must then allow this origin in CORS_ORIGINS.
 */
export const API_BASE_URL: string = (
  ((import.meta as any).env?.VITE_API_URL as string | undefined) ?? ''
).replace(/\/+$/, '');

/** URL for media (`<video>` / `<img>`) served by the backend. */
export function mediaUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

async function fetchJson<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, init);
  if (!res.ok) {
    let detailMsg = `API ${endpoint} responded with HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      const detail = errJson?.detail;
      if (typeof detail === 'string') {
        detailMsg = detail;
      } else if (detail && typeof detail.message === 'string') {
        detailMsg = detail.message;
      }
    } catch {
      // Fallback to HTTP status message
    }
    const httpErr: Error & { status?: number } = new Error(detailMsg);
    httpErr.status = res.status;
    throw httpErr;
  }
  return (await res.json()) as T;
}

export const ehsApi = {
  // Global Operational Overview from Neon
  getGlobalOverview: async (plantId?: string): Promise<OperationsOverviewSummary> => {
    const url =
      plantId && plantId !== 'ALL'
        ? `/api/v1/analytics/overview?plant_id=${encodeURIComponent(plantId)}`
        : `/api/v1/analytics/overview`;
    return fetchJson<OperationsOverviewSummary>(url);
  },

  // EHS Events & Summary
  getEvents: async (params?: Record<string, string | number>): Promise<EhsEventRecord[]> => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchJson<EhsEventRecord[]>(`/api/v1/events${query}`);
  },

  getEventSummary: async (plantId?: string): Promise<EventAggregationSummary> => {
    const url =
      plantId && plantId !== 'ALL'
        ? `/api/v1/events/summary?plant_id=${encodeURIComponent(plantId)}`
        : `/api/v1/events/summary`;
    return fetchJson<EventAggregationSummary>(url);
  },

  getEventById: async (eventId: string): Promise<EhsEventRecord> => {
    return fetchJson<EhsEventRecord>(`/api/v1/events/${encodeURIComponent(eventId)}`);
  },

  // Workforce Attendance & Summary
  getWorkforceRecords: async (params?: Record<string, string | number>): Promise<WorkforceAttendanceRecord[]> => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchJson<WorkforceAttendanceRecord[]>(`/api/v1/analytics/workforce${query}`);
  },

  getWorkforceSummary: async (plantId?: string): Promise<WorkforceSummary> => {
    const url =
      plantId && plantId !== 'ALL'
        ? `/api/v1/analytics/workforce/summary?plant_id=${encodeURIComponent(plantId)}`
        : `/api/v1/analytics/workforce/summary`;
    return fetchJson<WorkforceSummary>(url);
  },

  // Maintenance Work Orders & Summary
  getMaintenanceWorkOrders: async (params?: Record<string, string | number>): Promise<MaintenanceWorkOrderRecord[]> => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return fetchJson<MaintenanceWorkOrderRecord[]>(`/api/v1/analytics/maintenance${query}`);
  },

  getMaintenanceSummary: async (plantId?: string): Promise<MaintenanceSummary> => {
    const url =
      plantId && plantId !== 'ALL'
        ? `/api/v1/analytics/maintenance/summary?plant_id=${encodeURIComponent(plantId)}`
        : `/api/v1/analytics/maintenance/summary`;
    return fetchJson<MaintenanceSummary>(url);
  },

  // EHS Agent (DomoGPT + read-only SQL tools over Neon PostgreSQL ehs_core)
  getAiAgents: async (): Promise<AgentMetadata[]> => {
    return fetchJson<AgentMetadata[]>('/api/v1/ai/agents');
  },

  // Overview dashboards (events / attendance / maintenance)
  getDashboard: async (kind: DashboardKind, plantId?: string): Promise<DashboardData> => {
    const qs = new URLSearchParams({ plant_id: plantId && plantId !== '' ? plantId : 'ALL' });
    return fetchJson<DashboardData>(`/api/v1/dashboards/${kind}?${qs.toString()}`);
  },

  /** Downloads the dashboard as an Excel or PDF file (fetched as a Blob so a failure can be shown to the user). */
  downloadDashboard: async (kind: DashboardKind, format: DashboardExportFormat, plantId?: string): Promise<string> => {
    const qs = new URLSearchParams({ format, plant_id: plantId && plantId !== '' ? plantId : 'ALL' });
    const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${kind}/export?${qs.toString()}`);
    if (!res.ok) {
      let message = `The ${format === 'xlsx' ? 'Excel' : 'PDF'} file could not be created (HTTP ${res.status}).`;
      try {
        const body = await res.json();
        const detail = body?.detail;
        if (typeof detail === 'string') message = detail;
        else if (detail && typeof detail.message === 'string') message = detail.message;
      } catch {
        // keep the default message
      }
      throw new Error(message);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const filename = match ? decodeURIComponent(match[1]) : `${kind}_dashboard.${format}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    return filename;
  },

  getAiHealth: async (probe = false): Promise<DomoConnectivityStatus> => {
    return fetchJson<DomoConnectivityStatus>(`/api/v1/ai/health${probe ? '?probe=true' : ''}`);
  },

  queryAssistant: async (
    prompt: string,
    options?: { plantId?: string }
  ): Promise<AIQueryResponse> => {
    const body: { prompt: string; plant_id?: string } = { prompt };

    if (options?.plantId) {
      body.plant_id = options.plantId;
    }

    // Client-side timeout (120s per attempt) and one automatic retry for transient upstream
    // failures (502/503/504). Failures surface a clear message instead of hanging forever.
    const AI_TIMEOUT_MS = 120_000;
    const attempt = async (): Promise<AIQueryResponse> => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      try {
        return await fetchJson<AIQueryResponse>('/api/v1/ai/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          const timeoutErr: Error & { status?: number } = new Error(
            `The EHS Agent timed out after ${AI_TIMEOUT_MS / 1000}s. Please try again.`
          );
          timeoutErr.status = 408;
          throw timeoutErr;
        }
        throw err;
      } finally {
        window.clearTimeout(timer);
      }
    };

    try {
      return await attempt();
    } catch (err: any) {
      if ([502, 503, 504].includes(err?.status)) {
        try {
          return await attempt();
        } catch (retryErr: any) {
          throw new Error(
            `The AI service is temporarily unavailable (retried once): ${retryErr?.message || 'upstream failure'}`
          );
        }
      }
      throw err;
    }
  },

  // Safety alerts, workflow and notification centre
  getAlerts: async (params: Record<string, string | number | boolean | undefined> = {}): Promise<AlertListResponse> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== 'ALL') qs.set(k, String(v));
    });
    return fetchJson<AlertListResponse>(`/api/v1/alerts${qs.toString() ? `?${qs}` : ''}`);
  },
  getAlertSummary: async (plantId?: string): Promise<AlertSummary> => {
    return fetchJson<AlertSummary>(`/api/v1/alerts/summary${plantId && plantId !== 'ALL' ? `?plant_id=${encodeURIComponent(plantId)}` : ''}`);
  },
  getAlertActivity: async (limit = 8): Promise<AlertActivityFeedItem[]> => {
    return fetchJson<AlertActivityFeedItem[]>(`/api/v1/alerts/activity?limit=${limit}`);
  },
  getAlert: async (alertId: string): Promise<SafetyAlertDetail> => {
    return fetchJson<SafetyAlertDetail>(`/api/v1/alerts/${encodeURIComponent(alertId)}`);
  },
  transitionAlert: async (alertId: string, status: Exclude<AlertStatus, 'NEW'>, note?: string): Promise<SafetyAlertDetail> => {
    return fetchJson<SafetyAlertDetail>(`/api/v1/alerts/${encodeURIComponent(alertId)}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note: note || null }),
    });
  },
  getCapaOverdue: async (plantId?: string, limit = 50): Promise<CapaOverdueResponse> => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (plantId && plantId !== 'ALL') qs.set('plant_id', plantId);
    return fetchJson<CapaOverdueResponse>(`/api/v1/alerts/capa-overdue?${qs}`);
  },
  getNotifications: async (limit = 30): Promise<NotificationListResponse> => {
    return fetchJson<NotificationListResponse>(`/api/v1/notifications?limit=${limit}`);
  },
  markNotificationsRead: async (ids: string[]): Promise<{ marked: number }> => {
    return fetchJson<{ marked: number }>('/api/v1/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
  },
  markAllNotificationsRead: async (): Promise<{ marked: number }> => {
    return fetchJson<{ marked: number }>('/api/v1/notifications/read-all', { method: 'POST' });
  },

  // Video Library & CV Safety Analysis
  getVideoModelsStatus: async (): Promise<VideoModelAvailability[]> => {
    return fetchJson<VideoModelAvailability[]>('/api/v1/detection/models/status');
  },

  getVideoLibrary: async (): Promise<VideoLibraryResponse> => {
    return fetchJson<VideoLibraryResponse>('/api/v1/detection/library');
  },

  getVideoAnalyses: async (plantId?: string, limit = 25): Promise<VideoAnalysisResult[]> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (plantId && plantId !== 'ALL') {
      params.set('plant_id', plantId);
    }
    return fetchJson<VideoAnalysisResult[]>(`/api/v1/detection/analyses?${params.toString()}`);
  },

  getVideoAnalysisById: async (analysisId: string): Promise<VideoAnalysisResult> => {
    return fetchJson<VideoAnalysisResult>(`/api/v1/detection/analyses/${encodeURIComponent(analysisId)}`);
  },

  analyzeLibraryVideo: async (videoId: string, plantId = 'ALL'): Promise<VideoAnalysisResult> => {
    return fetchJson<VideoAnalysisResult>(`/api/v1/detection/library/${encodeURIComponent(videoId)}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: plantId }),
    });
  },

  /** Send a video to the detection backend. Returns at once with status PROCESSING; poll getVideoAnalysisById. */
  uploadVideoForDetection: async (useCase: string, file: File, plantId = 'ALL'): Promise<VideoAnalysisResult> => {
    const form = new FormData();
    form.append('use_case', useCase);
    form.append('plant_id', plantId);
    form.append('file', file);
    // No Content-Type header: the browser sets the multipart boundary itself.
    return fetchJson<VideoAnalysisResult>('/api/v1/detection/upload', { method: 'POST', body: form });
  },

  updateVideoReview: async (
    analysisId: string,
    reviewStatus: 'CONFIRMED' | 'DISMISSED',
    comment?: string
  ): Promise<VideoAnalysisResult> => {
    return fetchJson<VideoAnalysisResult>(
      `/api/v1/detection/analyses/${encodeURIComponent(analysisId)}/review`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          human_review_status: reviewStatus,
          comment: comment?.trim() ? comment.trim() : null,
        }),
      }
    );
  },

  // -------------------------------------------------------------------------
  // Enterprise Database & Resource Connectors
  // -------------------------------------------------------------------------
  getConnectorDatabaseHealth: async (): Promise<ConnectorDBHealthItem> => {
    return fetchJson<ConnectorDBHealthItem>('/api/v1/connectors/health');
  },

  getConnectorDriversStatus: async (): Promise<DriverStatusResponse> => {
    return fetchJson<DriverStatusResponse>('/api/v1/connectors/drivers/status');
  },

  getPrimaryDatabase: async (): Promise<PrimaryDatabaseInfo> => {
    return fetchJson<PrimaryDatabaseInfo>('/api/v1/connectors/primary');
  },

  getConnectorsOverview: async (): Promise<ConnectorOverviewStats> => {
    return fetchJson<ConnectorOverviewStats>('/api/v1/connectors/overview');
  },

  listConnectors: async (): Promise<ConnectorResponse[]> => {
    return fetchJson<ConnectorResponse[]>('/api/v1/connectors');
  },

  getConnector: async (connectorId: string): Promise<ConnectorResponse> => {
    return fetchJson<ConnectorResponse>(`/api/v1/connectors/${encodeURIComponent(connectorId)}`);
  },

  createConnector: async (data: ConnectorCreateRequest): Promise<ConnectorResponse> => {
    return fetchJson<ConnectorResponse>('/api/v1/connectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateConnector: async (connectorId: string, data: ConnectorUpdateRequest): Promise<ConnectorResponse> => {
    return fetchJson<ConnectorResponse>(`/api/v1/connectors/${encodeURIComponent(connectorId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteConnector: async (connectorId: string): Promise<{ status: string; deleted: boolean; message: string }> => {
    return fetchJson<{ status: string; deleted: boolean; message: string }>(
      `/api/v1/connectors/${encodeURIComponent(connectorId)}`,
      { method: 'DELETE' }
    );
  },

  testTransientConnection: async (data: ConnectionTestRequest): Promise<ConnectionTestResult> => {
    return fetchJson<ConnectionTestResult>('/api/v1/connectors/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  testSavedConnector: async (connectorId: string): Promise<ConnectionTestResult> => {
    return fetchJson<ConnectionTestResult>(`/api/v1/connectors/${encodeURIComponent(connectorId)}/test`, {
      method: 'POST',
    });
  },

  getConnectorTestHistory: async (connectorId: string, limit = 20): Promise<ConnectorTestHistoryItem[]> => {
    return fetchJson<ConnectorTestHistoryItem[]>(
      `/api/v1/connectors/${encodeURIComponent(connectorId)}/history?limit=${limit}`
    );
  },

  disconnectConnector: async (connectorId: string): Promise<{ status: string; message: string }> => {
    return fetchJson<{ status: string; message: string }>(
      `/api/v1/connectors/${encodeURIComponent(connectorId)}/disconnect`,
      { method: 'POST' }
    );
  },

  getConnectorMetadata: async (connectorId: string, refresh = false): Promise<DatabaseMetadata> => {
    return fetchJson<DatabaseMetadata>(
      `/api/v1/connectors/${encodeURIComponent(connectorId)}/metadata?refresh=${refresh}`
    );
  },

  listConnectorDatabases: async (connectorId: string): Promise<string[]> => {
    return fetchJson<string[]>(`/api/v1/connectors/${encodeURIComponent(connectorId)}/databases`);
  },

  listConnectorSchemas: async (connectorId: string): Promise<string[]> => {
    return fetchJson<string[]>(`/api/v1/connectors/${encodeURIComponent(connectorId)}/schemas`);
  },

  listConnectorTables: async (connectorId: string, schema?: string): Promise<TableMetadata[]> => {
    const query = schema ? `?schema=${encodeURIComponent(schema)}` : '';
    return fetchJson<TableMetadata[]>(`/api/v1/connectors/${encodeURIComponent(connectorId)}/tables${query}`);
  },

  listConnectorCollections: async (connectorId: string, database?: string): Promise<CollectionMetadata[]> => {
    const query = database ? `?database=${encodeURIComponent(database)}` : '';
    return fetchJson<CollectionMetadata[]>(
      `/api/v1/connectors/${encodeURIComponent(connectorId)}/collections${query}`
    );
  },

  previewConnectorData: async (connectorId: string, req: DataPreviewRequest): Promise<DataPreviewResponse> => {
    return fetchJson<DataPreviewResponse>(`/api/v1/connectors/${encodeURIComponent(connectorId)}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  },

  getConnectorModuleMappings: async (connectorId: string): Promise<ConnectorModuleMappingItem[]> => {
    return fetchJson<ConnectorModuleMappingItem[]>(
      `/api/v1/connectors/${encodeURIComponent(connectorId)}/modules`
    );
  },

  upsertConnectorModuleMapping: async (
    connectorId: string,
    data: { ehs_module: string; allowed_tables?: string[]; access_level?: string; enabled?: boolean; description?: string }
  ): Promise<ConnectorModuleMappingItem> => {
    return fetchJson<ConnectorModuleMappingItem>(
      `/api/v1/connectors/${encodeURIComponent(connectorId)}/modules`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
  },

  getConnectorAgentMappings: async (connectorId: string): Promise<ConnectorAgentMappingItem[]> => {
    return fetchJson<ConnectorAgentMappingItem[]>(
      `/api/v1/connectors/${encodeURIComponent(connectorId)}/agents`
    );
  },

  upsertConnectorAgentMapping: async (
    connectorId: string,
    data: { agent_name: string; allowed_tables?: string[]; allowed_collections?: string[]; plant_scope?: string; max_query_limit?: number; enabled?: boolean }
  ): Promise<ConnectorAgentMappingItem> => {
    return fetchJson<ConnectorAgentMappingItem>(
      `/api/v1/connectors/${encodeURIComponent(connectorId)}/agents`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
  },

  getConnectorAuditLogs: async (connectorId: string, limit = 50): Promise<ConnectorAuditLogItem[]> => {
    return fetchJson<ConnectorAuditLogItem[]>(
      `/api/v1/connectors/${encodeURIComponent(connectorId)}/audit-logs?limit=${limit}`
    );
  },

  getRecentAuditLogs: async (limit = 50): Promise<ConnectorAuditLogItem[]> => {
    return fetchJson<ConnectorAuditLogItem[]>(`/api/v1/connectors/audit-logs/recent?limit=${limit}`);
  },
};

export const api = ehsApi;
