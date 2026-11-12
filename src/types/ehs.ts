export type NavSection =
  | 'overview'
  | 'digital-twin'
  | 'hazards'
  | 'incidents'
  | 'workforce-shifts'
  | 'maintenance-safety'
  | 'actions'
  | 'permits'
  | 'inspections'
  | 'risks'
  | 'training'
  | 'video-monitoring'
  | 'ai-assistant'
  | 'reports'
  | 'settings';

export type SeverityLevel = 'critical' | 'high' | 'warning' | 'success' | 'info';

export type RegulatoryFramework =
  | 'ISO_45001'
  | 'OSHA_US'
  | 'EU_DIRECTIVES'
  | 'FACTORIES_ACT_IN'
  | 'CUSTOM';

export interface FrameworkDefinition {
  id: RegulatoryFramework;
  label: string;
  authority: string;
  lotoStandard: string;
  incidentLogStandard: string;
  pelStandard: string;
  trainingStandard: string;
}

export type DatasetConnectionStatus = 'disconnected' | 'ingested' | 'missing_fields' | 'connecting' | 'error';

export interface DatasetStatus {
  id: 'fact_ehs_event' | 'fact_workforce_attendance' | 'fact_maintenance_work_order';
  fileName: string;
  displayName: string;
  description: string;
  status: DatasetConnectionStatus;
  recordCount: number | null;
  lastUpdated?: string;
  missingRequiredColumns?: string[];
}

// Approved Dataset 1: fact_ehs_event (Neon PostgreSQL table ehs_core.fact_ehs_event)
export interface EhsEventRecord {
  ehs_event_id: string;
  event_ts: string;
  plant_id: string;
  area: string;
  shift_id: string;
  event_type: 'FIRST_AID' | 'HAZARD_OBSERVATION' | 'NEAR_MISS' | 'PERMIT_EXCEPTION' | 'AUDIT_FINDING' | string;
  hazard_category: string;
  risk_severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lost_time_injury: boolean;
  action_owner: string;
  due_date: string;
  action_status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  permit_id: string;
}

export interface EventAggregationSummary {
  total_events: number;
  by_event_type: Record<string, number>;
  by_severity: Record<string, number>;
  by_action_status: Record<string, number>;
  by_plant: Record<string, number>;
  by_area: Record<string, number>;
  by_shift: Record<string, number>;
  by_hazard_category: Record<string, number>;
  date_range: {
    start: string | null;
    end: string | null;
  };
}

// Approved Dataset 2: fact_workforce_attendance (Neon table ehs_core.fact_workforce_attendance)
export interface WorkforceAttendanceRecord {
  attendance_id: string;
  work_date: string;
  employee_id: string;
  plant_id: string;
  shift_id: string;
  scheduled_hours: number;
  actual_hours: number | string;
  attendance_status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE' | string;
  overtime_hours: number | string;
  skill_match: 'MATCHED' | 'GAP' | string;
  training_compliance: 'CURRENT' | 'EXPIRED' | string;
}

export interface WorkforceSummary {
  total_records: number;
  total_actual_hours: number;
  total_overtime_hours: number;
  by_status: Record<string, number>;
  by_skill_match: Record<string, number>;
  by_training_compliance: Record<string, number>;
  by_plant: Record<string, number>;
  by_shift: Record<string, number>;
}

// Approved Dataset 3: fact_maintenance_work_order (Neon table ehs_core.fact_maintenance_work_order)
export interface MaintenanceWorkOrderRecord {
  work_order_id: string;
  machine_id: string;
  plant_id: string;
  created_ts: string;
  maintenance_type: 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | string;
  failure_mode: string;
  priority: 'P1' | 'P2' | 'P3' | string;
  planned_start: string;
  actual_start: string | null;
  downtime_avoided_estimate_min: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PLANNED' | string;
  technician_id: string;
}

export interface MaintenanceSummary {
  total_work_orders: number;
  total_downtime_avoided_min: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
  by_failure_mode: Record<string, number>;
  by_plant: Record<string, number>;
}

// Normalized View Records derived strictly from fact_ehs_event
export interface HazardRecord {
  id: string;
  title: string;
  category: string;
  location: string;
  plantId: string;
  shift: string;
  severity: SeverityLevel;
  status: 'Open' | 'In Progress' | 'Controlled';
  assignedOwner: string;
  reportedAt: string;
  permitId: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  incidentType: string;
  category: string;
  severity: SeverityLevel;
  location: string;
  plantId: string;
  shift: string;
  investigationStatus: string;
  responsiblePerson: string;
  reportedDate: string;
  lostTimeInjury: boolean;
  permitId: string;
}

export interface CorrectiveAction {
  id: string;
  title: string;
  sourceRef: string;
  priority: SeverityLevel;
  owner: string;
  dueDate: string;
  status: 'Open' | 'In Progress' | 'Closed';
  progress: number;
  plantId: string;
}

export interface PermitLotoRecord {
  id: string;
  permitType: string;
  title: string;
  zone: string;
  plantId: string;
  shift: string;
  authorizedPerson: string;
  validFrom: string;
  validTo: string;
  status: 'Active' | 'Under Exception' | 'Closed';
  hazardCategory: string;
}

export interface OperationsOverviewSummary {
  total_ehs_events: number;
  total_workforce_records: number;
  total_maintenance_work_orders: number;
  total_actual_work_hours: number;
  hazards_count: number;
  incidents_count: number;
  near_miss_count: number;
  permit_exceptions_count: number;
  open_actions_count: number;
  closed_actions_count: number;
  critical_events_count: number;
  training_compliance_rate: number;
  maintenance_p1_count: number;
  plants: string[];
  shifts: string[];
}

export interface OverviewMetrics {
  totalEvents: number | null;
  totalWorkHours: number | null;
  hazardsCount: number | null;
  nearMissCount: number | null;
  incidentCount: number | null;
  permitExceptionsCount: number | null;
  openActionCount: number | null;
  closedActionCount: number | null;
  criticalCount: number | null;
  trainingComplianceRate: number | null;
  maintenanceP1Count: number | null;
  totalWorkforceRecords: number | null;
  totalMaintenanceOrders: number | null;
  calculatedFromDatasets: string[];
}

export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  reasoning_tokens?: number | null;
}

export interface EvidenceItem {
  id: string;
  label: string;
  dataset_source: string;
  value?: string | null;
  excerpt?: string | null;
}

export interface AgentTraceStep {
  step: number;
  agent_key: string;
  agent_name: string;
  tool_name: string;
  status: 'completed' | 'skipped' | 'error' | string;
  duration_ms: number;
  records_examined: number;
  summary: string;
}

export interface AgentMetadata {
  agent_key: string;
  agent_name: string;
  role: string;
  data_sources: string[];
  capabilities: string[];
  limitations: string[];
}

export interface DomoConnectivityStatus {
  configured: boolean;
  connected: boolean;
  endpoint: string;
  configured_model: string;
  returned_model_id?: string | null;
  session_id?: string | null;
  token_usage?: TokenUsage | null;
  latency_ms: number;
  error_code?: string | null;
  message: string;
}

export interface AIQueryResponse {
  success: boolean;
  agent_key: string;
  agent_name: string;
  user_question: string;
  plant_scope: string;
  routing_reason: string;
  specialist_agents_invoked: string[];
  summary: string;
  key_findings: string[];
  supporting_evidence: EvidenceItem[];
  recommendations: string[];
  data_sources: string[];
  limitations: string[];
  human_review_required: boolean;
  model_id?: string | null;
  session_id?: string | null;
  token_usage?: TokenUsage | null;
  execution_trace: AgentTraceStep[];
  suggested_questions: string[];
  timestamp: string;
  error_code?: string | null;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  agentKey?: string;
  agentName?: string;
  plantScope?: string;
  routingReason?: string;
  specialistsInvoked?: string[];
  keyFindings?: string[];
  supportingEvidence?: EvidenceItem[];
  recommendations?: string[];
  dataSources?: string[];
  limitations?: string[];
  humanReviewRequired?: boolean;
  modelId?: string | null;
  sessionId?: string | null;
  tokenUsage?: TokenUsage | null;
  executionTrace?: AgentTraceStep[];
  citations?: { id: string; label: string; datasetSource: string }[];
  suggestedQuestions?: string[];
  isError?: boolean;
  toolExecution?: {
    toolName: string;
    params: string;
    status: 'executing' | 'completed' | 'verified';
    outputSummary: string;
  };
}

export interface RouteFilterPreset {
  token: number;
  hazardSeverity?: string;
  hazardStatus?: string;
  hazardSearch?: string;
  hazardCategory?: string;
  riskSeverity?: string;
  trainingStatus?: string;
  maintenancePriority?: string;
  actionStatus?: string;
  incidentType?: string;
}

export type VideoUseCase =
  | 'fall_detection'
  | 'smoke_fire'
  | 'exit_obstruction'
  | 'forklift_pedestrian'
  | 'machinery_proximity'
  | 'unsafe_climbing';

export type VideoCardStatus =
  | 'available'
  | 'ready'
  | 'processing'
  | 'completed'
  | 'no_event_detected'
  | 'needs_human_review'
  | 'failed'
  | 'model_not_configured';

export interface VideoModelAvailability {
  use_case: VideoUseCase;
  title: string;
  configured: boolean;
  model_name: string | null;
  backend_runtime: string;
  message: string;
  confidence_supported: boolean;
}

export interface VideoDetectionEvent {
  frame: number;
  timestamp_sec: number;
  state: string;
  label: string | null;
  confidence: number | null;
  summary: string | null;
  metrics?: Record<string, unknown> | null;
}

export interface VideoAnalysisResult {
  analysis_id: string;
  use_case: VideoUseCase;
  video_id: string | null;
  plant_id: string;
  filename: string;
  duration_sec: number | null;
  status: string;
  progress_pct: number;
  frames_processed: number;
  total_frames: number | null;
  current_stage: string | null;
  event_detected: boolean;
  event_label: string | null;
  event_timestamp_sec: number | null;
  detection_events: VideoDetectionEvent[];
  confidence: number | null;
  confidence_note: string | null;
  evidence_frame_url: string | null;
  annotated_video_url: string | null;
  human_review_status: 'PENDING_REVIEW' | 'CONFIRMED' | 'DISMISSED' | 'NOT_REQUIRED' | string;
  human_review_comment: string | null;
  model_used: string | null;
  summary: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface VideoLibraryItem {
  video_id: string;
  use_case: VideoUseCase;
  use_case_title: string;
  title: string;
  filename: string;
  extension: string;
  duration_sec: number | null;
  file_size_bytes: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  available: boolean;
  stream_url: string;
}

export interface VideoLibraryGroup {
  use_case: VideoUseCase;
  title: string;
  description: string;
  model_status: VideoModelAvailability;
  videos: VideoLibraryItem[];
}

export interface VideoLibraryResponse {
  total_videos: number;
  configured_models_count: number;
  total_scenarios_count: number;
  groups: VideoLibraryGroup[];
}

export interface LandingMediaStatus {
  video_available: boolean;
  video_url: string | null;
  poster_available: boolean;
  poster_url: string | null;
}

export interface AuthUser {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  plant_scope: string;
}

export interface AuthLoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}
