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
  | 'agent-architecture'
  | 'reports'
  | 'settings'
  | 'connectors';

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

export type ChartType =
  | 'line'
  | 'area'
  | 'bar'
  | 'horizontal_bar'
  | 'stacked_bar'
  | 'grouped_bar'
  | 'pie'
  | 'donut'
  | 'heatmap'
  | 'scatter';

export interface ChartPoint {
  x: string | number;
  y: number;
}

export interface ChartSeries {
  name: string;
  data: ChartPoint[];
}

export interface ChartSlice {
  label: string;
  value: number;
}

export interface ChartCell {
  x: string;
  y: string;
  value: number;
}

/** One chart chosen and filled in by the agent. x_axis = categories/dimension, y_axis = the measured value. */
export interface ChartSpec {
  type: ChartType;
  title: string;
  subtitle?: string;
  x_axis?: { label?: string };
  y_axis?: { label?: string };
  unit?: string;
  /** line, area, bar, horizontal_bar, stacked_bar, grouped_bar, scatter */
  series?: ChartSeries[];
  /** pie, donut */
  slices?: ChartSlice[];
  /** heatmap: x = columns, y = rows */
  cells?: ChartCell[];
}

export interface AgentKpi {
  label: string;
  value: string | number;
  unit?: string;
  caption?: string;
  tone?: 'neutral' | 'good' | 'warning' | 'critical';
}

export interface AgentTableData {
  title?: string;
  columns: string[];
  rows: (string | number | null)[][];
}

/** Response of POST /api/v1/ai/query. The agent decides whether kpis, charts and table are needed. */
export interface AIQueryResponse {
  success: boolean;
  agent_key: string;
  agent_name: string;
  user_question: string;
  plant_scope: string;
  routing_reason: string;
  /** The answer text (markdown-like). Always present. */
  content: string;
  kpis: AgentKpi[];
  charts: ChartSpec[];
  table: AgentTableData | null;
  supporting_evidence: EvidenceItem[];
  suggested_questions: string[];
  execution_trace: AgentTraceStep[];
  data_sources: string[];
  limitations: string[];
  human_review_required: boolean;
  model_id?: string | null;
  session_id?: string | null;
  token_usage?: TokenUsage | null;
  timestamp: string;
  error_code?: string | null;
  /** Same text as `content` (kept for compatibility). */
  summary: string;
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
  original_video_url: string | null;
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

// ---------------------------------------------------------------------------
// Safety alerts & notification centre (backend: /api/v1/alerts, /api/v1/notifications)
// ---------------------------------------------------------------------------
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'UNDER_INVESTIGATION' | 'ACTION_REQUIRED' | 'RESOLVED' | 'DISMISSED';

export interface SafetyAlertItem {
  alert_id: string;
  title: string;
  severity: AlertSeverity;
  status: AlertStatus;
  scenario: string;
  category: string;
  source_type: 'video_analysis' | 'ehs_event' | 'recurrence' | string;
  source_ref: string;
  plant_id: string;
  location: string | null;
  detected_at: string | null;
  created_at: string | null;
  detection_source: string;
  description: string;
  confidence: number | null;
  confidence_note: string | null;
  responsible_team: string | null;
  responsible_person: string | null;
  response_due_at: string | null;
  resolution_due_at: string | null;
  response_overdue: boolean;
  resolution_overdue: boolean;
  overdue: boolean;
  escalation_level: number;
  last_reminder_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  dismissed_at: string | null;
  dismissal_reason: string | null;
  is_active: boolean;
  next_statuses: AlertStatus[];
}

export interface AlertActivityEntry {
  ts: string;
  actor: string;
  action: string;
  from_status: AlertStatus | null;
  to_status: AlertStatus | null;
  note: string | null;
}

export interface SafetyAlertDetail extends SafetyAlertItem {
  /** Verified facts (what was detected / recorded). */
  facts: string[];
  evidence: {
    image_url?: string;
    video_url?: string;
    source_video?: string;
    video_id?: string | null;
    timestamp_sec?: number | null;
    analysis_id?: string;
    record_id?: string;
    event_ids?: string[];
    note?: string;
  };
  /** Rule-based standard guidance — NOT a detection result. */
  guidance: {
    label: string;
    why_dangerous: string | null;
    consequences: string | null;
    immediate_action: string | null;
    corrective_action: string | null;
  };
  activity: AlertActivityEntry[];
  notifications: { notification_id: string; kind: string; level: number; recipient: string | null; channel: string; created_at: string; title: string }[];
  delivery_note: string;
}

export interface AlertListResponse {
  total: number;
  items: SafetyAlertItem[];
}

export interface AlertSummary {
  total: number;
  active: number;
  active_by_severity: Record<AlertSeverity, number>;
  by_status: Record<AlertStatus, number>;
  overdue: number;
  unacknowledged_critical: number;
  by_plant: Record<string, Record<AlertSeverity, number>>;
  high_risk_areas: { location: string; plant_id: string; count: number; critical: number }[];
}

export interface AlertActivityFeedItem {
  ts: string;
  actor: string;
  action: string;
  to_status: AlertStatus | null;
  note: string | null;
  alert_id: string;
  alert_title: string;
  severity: AlertSeverity;
}

export interface CapaOverdueItem {
  event_id: string;
  plant_id: string;
  area: string;
  hazard_category: string;
  risk_severity: string;
  action_status: string;
  owner: string;
  due_date: string;
  days_overdue: number;
  escalation_level: number;
  escalated_to: string | null;
}

export interface CapaOverdueResponse {
  total_overdue: number;
  critical_or_high: number;
  by_escalation_level: Record<string, number>;
  items: CapaOverdueItem[];
}

export interface AppNotificationItem {
  notification_id: string;
  kind: 'ALERT' | 'REMINDER' | 'ESCALATION' | 'CAPA_OVERDUE' | string;
  severity: AlertSeverity;
  title: string;
  message: string;
  alert_id: string | null;
  target_type: 'alert' | 'capa' | 'event' | string;
  target_ref: string | null;
  plant_id: string;
  escalation_level: number;
  recipient: string | null;
  channel: string;
  created_at: string;
  read: boolean;
}

export interface NotificationListResponse {
  unread_count: number;
  unread_critical_or_high: number;
  items: AppNotificationItem[];
}

// ---------------------------------------------------------------------------
// Enterprise Database & Resource Connectors (/api/v1/connectors)
// ---------------------------------------------------------------------------
export type DatabaseType = 'postgresql' | 'mysql' | 'mongodb' | 'sqlite' | 'sqlserver' | 'oracle';
export type ConnectorStatus = 'CONNECTED' | 'DISCONNECTED' | 'FAILED' | 'TESTING';

export interface DriverStatusItem {
  db_type: DatabaseType;
  display_name: string;
  driver_name: string;
  installed: boolean;
  version: string | null;
  install_command: string;
}

export interface DriverStatusResponse {
  drivers: DriverStatusItem[];
  total_drivers: number;
  installed_count: number;
}

export interface ConnectorDBHealthItem {
  healthy: boolean;
  status: string;
  database_name: string | null;
  dialect: string;
  latency_ms: number;
  pool: {
    size?: number;
    checked_in?: number;
    checked_out?: number;
    overflow?: number;
  };
}

export interface ConnectorResponse {
  connector_id: string;
  name: string;
  description: string | null;
  db_type: DatabaseType;
  host: string | null;
  port: number | null;
  database_name: string | null;
  username: string | null;
  masked_password: string | null;
  masked_uri: string | null;
  ssl_mode: string;
  read_only: boolean;
  connection_timeout_sec: number;
  pool_size: number;
  schema_filters: string[];
  collection_filters: string[];
  plant_id: string;
  status: ConnectorStatus;
  last_tested_at: string | null;
  last_connected_at: string | null;
  last_failed_at: string | null;
  last_error_message: string | null;
  last_latency_ms: number | null;
  metadata_refreshed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrimaryDatabaseInfo {
  name: string;
  db_type: string;
  host: string | null;
  port: number | null;
  database_name: string | null;
  username: string | null;
  /** Always a mask; the real password is never sent to the browser. */
  password_masked: string | null;
  ssl_mode: string | null;
  schema: string;
  status: 'CONNECTED' | 'DISCONNECTED';
  latency_ms: number | null;
  server_version: string | null;
  tables: { table: string; rows: number }[];
  error: string | null;
}

export interface ConnectorCreateRequest {
  name: string;
  description?: string;
  db_type: DatabaseType;
  host?: string;
  port?: number;
  database_name?: string;
  username?: string;
  password?: string;
  uri?: string;
  ssl_mode?: string;
  ssl_ca_cert?: string;
  read_only?: boolean;
  connection_timeout_sec?: number;
  pool_size?: number;
  schema_filters?: string[];
  collection_filters?: string[];
  plant_id?: string;
  test_before_save?: boolean;
}

export interface ConnectorUpdateRequest {
  name?: string;
  description?: string;
  host?: string;
  port?: number;
  database_name?: string;
  username?: string;
  password?: string;
  uri?: string;
  ssl_mode?: string;
  read_only?: boolean;
  connection_timeout_sec?: number;
  pool_size?: number;
  schema_filters?: string[];
  collection_filters?: string[];
  plant_id?: string;
}

export interface ConnectionTestRequest {
  db_type: DatabaseType;
  host?: string;
  port?: number;
  database_name?: string;
  username?: string;
  password?: string;
  uri?: string;
  ssl_mode?: string;
  connection_timeout_sec?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  status: ConnectorStatus;
  latency_ms: number | null;
  message: string;
  server_version: string | null;
  discovered_databases?: string[] | null;
  discovered_schemas?: string[] | null;
  discovered_collections?: string[] | null;
  error_code?: string | null;
  error_detail?: string | null;
  timestamp: string;
}

export interface ConnectorTestHistoryItem {
  test_id: string;
  connector_id: string | null;
  db_type: string;
  tested_at: string;
  success: boolean;
  latency_ms: number | null;
  status: string;
  server_version: string | null;
  error_code: string | null;
  error_message: string | null;
  discovered_databases?: string[] | null;
  discovered_schemas?: string[] | null;
  discovered_collections?: string[] | null;
  tested_by: string | null;
}

export interface ColumnMetadata {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_key_target?: string | null;
  default_value?: string | null;
  max_length?: number | null;
}

export interface IndexMetadata {
  name: string;
  columns: string[];
  is_unique: boolean;
  is_primary: boolean;
}

export interface TableMetadata {
  name: string;
  schema_name?: string | null;
  columns: ColumnMetadata[];
  indexes: IndexMetadata[];
  estimated_row_count?: number | null;
}

export interface CollectionMetadata {
  name: string;
  database_name: string;
  document_count?: number | null;
  sample_fields: ColumnMetadata[];
  indexes: IndexMetadata[];
}

export interface DatabaseMetadata {
  connector_id: string;
  connector_name: string;
  db_type: DatabaseType;
  databases: string[];
  schemas: string[];
  tables: TableMetadata[];
  collections: CollectionMetadata[];
  refreshed_at: string;
}

export interface DataPreviewRequest {
  target: string;
  schema_name?: string;
  database_name?: string;
  columns?: string[];
  filter_clause?: string;
  limit?: number;
  offset?: number;
}

export interface DataPreviewResponse {
  connector_id: string;
  target: string;
  schema_name?: string | null;
  columns: string[];
  column_types: Record<string, string>;
  rows: Record<string, any>[];
  total_rows_estimate?: number | null;
  limit: number;
  offset: number;
  execution_time_ms: number;
  is_read_only: boolean;
}

export interface ConnectorOverviewStats {
  total_connectors: number;
  active_connections: number;
  failed_connections: number;
  disconnected_sources: number;
  by_type: Record<string, number>;
  average_latency_ms: number;
}

export interface ConnectorModuleMappingItem {
  mapping_id: string;
  connector_id: string;
  ehs_module: string;
  allowed_tables: string[];
  access_level: string;
  enabled: boolean;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectorAgentMappingItem {
  mapping_id: string;
  connector_id: string;
  agent_name: string;
  allowed_tables: string[];
  allowed_collections: string[];
  plant_scope: string;
  max_query_limit: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectorAuditLogItem {
  log_id: string;
  connector_id: string | null;
  action: string;
  user_id: string | null;
  user_email: string | null;
  result: string;
  execution_time_ms?: number | null;
  details?: Record<string, any> | null;
  created_at: string;
}

/* ------------------------------------------------------------------------------------------------
 * Dashboards (Overview tabs): GET /api/v1/dashboards/{kind}
 * ---------------------------------------------------------------------------------------------- */
export type DashboardKind = 'events' | 'attendance' | 'maintenance';
export type DashboardExportFormat = 'xlsx' | 'pdf';

export interface DashboardTable {
  title: string;
  columns: string[];
  /** The first rows only (5); the export has all of them. */
  rows: (string | number | null)[][];
  total_rows: number;
}

export interface DashboardData {
  kind: DashboardKind;
  title: string;
  subtitle: string;
  plant_scope: string;
  generated_at: string;
  source_table: string;
  /** Exactly 5. */
  kpis: AgentKpi[];
  /** Order: area, line, heatmap, donut. */
  charts: ChartSpec[];
  table: DashboardTable;
}
