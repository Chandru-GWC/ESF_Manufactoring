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
  AgentMetadata,
  DomoConnectivityStatus,
  VideoModelAvailability,
  VideoAnalysisResult,
  VideoLibraryResponse,
  LandingMediaStatus,
  AuthLoginResponse,
  AuthUser,
} from '../types/ehs';

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8001';

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
    throw new Error(detailMsg);
  }
  return (await res.json()) as T;
}

export const ehsApi = {
  // Health & Landing Media
  getLandingMediaStatus: async (): Promise<LandingMediaStatus> => {
    return fetchJson<LandingMediaStatus>('/api/v1/health/landing-media');
  },

  // Enterprise Authentication
  login: async (email: string, password: string): Promise<AuthLoginResponse> => {
    return fetchJson<AuthLoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  },

  getMe: async (token: string): Promise<AuthUser> => {
    return fetchJson<AuthUser>('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

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

  // Multi-Agent AI Assistant (DomoGPT + Neon PostgreSQL ehs_core)
  getAiAgents: async (): Promise<AgentMetadata[]> => {
    return fetchJson<AgentMetadata[]>('/api/v1/ai/agents');
  },

  getAiHealth: async (probe = false): Promise<DomoConnectivityStatus> => {
    return fetchJson<DomoConnectivityStatus>(`/api/v1/ai/health${probe ? '?probe=true' : ''}`);
  },

  queryAssistant: async (
    prompt: string,
    options?: { plantId?: string; targetAgent?: string }
  ): Promise<AIQueryResponse> => {
    const body: { prompt: string; plant_id?: string; target_agent?: string } = { prompt };
    if (options?.plantId) {
      body.plant_id = options.plantId;
    }
    if (options?.targetAgent && options.targetAgent !== 'orchestrator') {
      body.target_agent = options.targetAgent;
    }

    return fetchJson<AIQueryResponse>('/api/v1/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  // Video Library & CV Safety Analysis
  getVideoModelsStatus: async (): Promise<VideoModelAvailability[]> => {
    return fetchJson<VideoModelAvailability[]>('/api/v1/video/models/status');
  },

  getVideoLibrary: async (): Promise<VideoLibraryResponse> => {
    return fetchJson<VideoLibraryResponse>('/api/v1/video/library');
  },

  getVideoAnalyses: async (plantId?: string, limit = 25): Promise<VideoAnalysisResult[]> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (plantId && plantId !== 'ALL') {
      params.set('plant_id', plantId);
    }
    return fetchJson<VideoAnalysisResult[]>(`/api/v1/video/analyses?${params.toString()}`);
  },

  getVideoAnalysisById: async (analysisId: string): Promise<VideoAnalysisResult> => {
    return fetchJson<VideoAnalysisResult>(`/api/v1/video/analyses/${encodeURIComponent(analysisId)}`);
  },

  analyzeLibraryVideo: async (videoId: string, plantId = 'ALL'): Promise<VideoAnalysisResult> => {
    return fetchJson<VideoAnalysisResult>(`/api/v1/video/library/${encodeURIComponent(videoId)}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: plantId }),
    });
  },

  updateVideoReview: async (
    analysisId: string,
    reviewStatus: 'CONFIRMED' | 'DISMISSED',
    comment?: string
  ): Promise<VideoAnalysisResult> => {
    return fetchJson<VideoAnalysisResult>(
      `/api/v1/video/analyses/${encodeURIComponent(analysisId)}/review`,
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
};
