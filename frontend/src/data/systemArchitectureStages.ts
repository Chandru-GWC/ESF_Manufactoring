import { LIST_OF_ALL_AGENTS } from './agentArchitectureRegistry';

export type StageId =
  | 'data-sources'
  | 'data-ingestion'
  | 'data-processing'
  | 'ai-intelligence'
  | 'dashboards-alerts'
  | 'human-decision';

export interface ArchitectureStageInfo {
  id: StageId;
  stepNumber: string;
  name: string;
  shortName: string;
  subtitle: string;
  summary: string;
  colorTheme: {
    borderTop: string;
    badgeBg: string;
    badgeText: string;
    activeRing: string;
    accentText: string;
    iconBg: string;
  };
  metrics: { label: string; value: string }[];
  statusTag: { label: string; verified: boolean };
  flowContract: {
    inputs: string[];
    processing: string[];
    outputs: string[];
  };
}

export const SYSTEM_STAGES: ArchitectureStageInfo[] = [
  {
    id: 'data-sources',
    stepNumber: '01',
    name: 'DATA SOURCES',
    shortName: 'Sources',
    subtitle: 'Connected Systems & Ground Truth Data',
    summary:
      'Verified production databases, shop floor camera feeds, IoT telemetry, and maintenance records feeding the EHS platform.',
    colorTheme: {
      borderTop: 'border-t-slate-700',
      badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
      badgeText: 'text-slate-700',
      activeRing: 'ring-slate-700',
      accentText: 'text-slate-800',
      iconBg: 'bg-slate-100 text-slate-700',
    },
    metrics: [
      { label: 'Verified Neon Tables', value: '4 Tables' },
      { label: 'Ground Records', value: '17,460+' },
      { label: 'External Ingest Feeds', value: '5 Feeds' },
    ],
    statusTag: { label: 'Verified Read-Only', verified: true },
    flowContract: {
      inputs: [
        'Shop floor CCTV RTSP/MP4 streams (7 library verification videos)',
        'EHS safety observation & incident reports',
        'Shift attendance & punch clock logs (IN-KA-01 & IN-TN-01 plants)',
        'CMMS maintenance work orders & machine breakdown logs',
        'Zone 1–4 perimeter IoT proximity sensors',
      ],
      processing: [
        'SSL-encrypted connection pool establishment (sslmode=require)',
        'Read-only credential enforcement (zero frontend DB write credentials)',
        'Schema introspection & foreign key reference verification',
      ],
      outputs: [
        'Raw relational rows from ehs_core schema',
        'Decoded RGB video frames (15–30 FPS)',
        'Sensor telemetry streams for downstream ingestion',
      ],
    },
  },
  {
    id: 'data-ingestion',
    stepNumber: '02',
    name: 'DATA INGESTION',
    shortName: 'Ingestion',
    subtitle: 'Pipelines, Validation & Protocols',
    summary:
      'High-throughput asynchronous ingest gateways, Pydantic contract validation, SHA-256 deduplication, and streaming decoders.',
    colorTheme: {
      borderTop: 'border-t-indigo-600',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      badgeText: 'text-indigo-700',
      activeRing: 'ring-indigo-600',
      accentText: 'text-indigo-600',
      iconBg: 'bg-indigo-50 text-indigo-600',
    },
    metrics: [
      { label: 'Ingest Gateways', value: '4 Active' },
      { label: 'SQL Query Latency', value: '<50ms' },
      { label: 'Video Frame Capture', value: '15-30 FPS' },
    ],
    statusTag: { label: 'Sub-Second Ingest', verified: true },
    flowContract: {
      inputs: [
        'Incoming FastAPI HTTP payloads and query parameters',
        'Raw multipart/form-data CSV files from Ingestion Modal',
        'Continuous industrial video streams via OpenCV VideoCapture',
      ],
      processing: [
        'Pydantic v2 strict schema validation and type coercion',
        'Timestamp normalization to standardized UTC ISO 8601 strings',
        'SHA-256 event fingerprinting to deduplicate repetitive shift events',
        'Perimeter coordinate boundary checks for plant manufacturing zones',
      ],
      outputs: [
        'Sanitized typed records ready for analytics processing',
        'Buffered video frames for computer vision model inference',
        'Structured event queues with idempotency keys',
      ],
    },
  },
  {
    id: 'data-processing',
    stepNumber: '03',
    name: 'DATA PROCESSING & BI',
    shortName: 'Processing',
    subtitle: 'Feature Engineering, Formulas & SLAs',
    summary:
      'Deterministic business logic, OSHA/ISO rate computations, shift fatigue indexes, hazard clustering, and SLA countdown monitors.',
    colorTheme: {
      borderTop: 'border-t-blue-600',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      badgeText: 'text-blue-700',
      activeRing: 'ring-blue-600',
      accentText: 'text-blue-600',
      iconBg: 'bg-blue-50 text-blue-600',
    },
    metrics: [
      { label: 'OSHA / ISO Formulas', value: '6 Verified' },
      { label: 'Active SLAs Monitored', value: '15m / 4h' },
      { label: 'Calculated Aggregations', value: 'Shift & Plant' },
    ],
    statusTag: { label: 'Audit-Grade Logic', verified: true },
    flowContract: {
      inputs: [
        'Sanitized incident records, attendance rows, and machine maintenance records',
        'Real-time clock ticks for SLA deadline calculations',
        'Historical rolling 30-day baseline safety datasets',
      ],
      processing: [
        'TRIR calculation: (Total Recordable Incidents × 200,000) / Actual Hours',
        'LTIFR calculation: (Lost Time Injuries × 1,000,000) / Actual Hours',
        'Shift Fatigue Index: Evaluation of shifts > 10h, overtime > 4h, and night shifts',
        'Hazard Concentration Index (HCI) per manufacturing zone',
        'SLA countdown enforcement: 15-minute response & 4-hour resolution thresholds',
      ],
      outputs: [
        'Aggregated executive KPI datasets',
        'Zone-level risk density heatmaps',
        'Deterministic SLA breach escalation triggers',
        'Structured context payloads for multi-agent reasoning',
      ],
    },
  },
  {
    id: 'ai-intelligence',
    stepNumber: '04',
    name: 'AI AGENTS & INTELLIGENCE',
    shortName: 'Intelligence',
    subtitle: 'Multi-Agent Reasoning & Vision ML',
    summary:
      'A single SQL-driven safety agent, MediaPipe pose detection, YOLOv8 vision models, and strict zero-unauthorized-write guardrails.',
    colorTheme: {
      borderTop: 'border-t-brand-orange',
      badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
      badgeText: 'text-brand-orange',
      activeRing: 'ring-brand-orange',
      accentText: 'text-brand-orange',
      iconBg: 'bg-orange-50 text-brand-orange',
    },
    metrics: [
      { label: 'SQL Agent + 2 Tools', value: '1 Agent' },
      { label: 'Computer Vision ML', value: '3 Models' },
      { label: 'Rule Engine + Twin', value: '2 Systems' },
    ],
    statusTag: { label: 'Grounded & Guarded', verified: true },
    flowContract: {
      inputs: [
        'Operator natural language queries from AI Safety Assistant Studio',
        'High-speed video frames decoded from shop floor surveillance streams',
        'Read-only SQL results from the inspect_schema and run_query tools',
      ],
      processing: [
        'Agent loop: DomoGPT picks inspect_schema or run_query, reads the result and repeats (max 6 steps)',
        'SQL validation: one SELECT, three approved tables, max 50 rows, plant scope enforced',
        'MediaPipe 33-landmark pose extraction and torso angle biomechanics calculation',
        'YOLOv8 smoke/fire detection and exit corridor bounding box tracking',
        'Hallucination filtering: all claims checked against verified Neon primary keys',
      ],
      outputs: [
        'Grounded safety answers with record IDs and the SQL behind each figure',
        'Real-time Life-Safety alert payloads with confidence scores',
        'Annotated video frames with bounding boxes and posture status',
        'Corrective and Preventive Action (CAPA) recommendations',
      ],
    },
  },
  {
    id: 'dashboards-alerts',
    stepNumber: '05',
    name: 'DASHBOARDS & ALERTS',
    shortName: 'Dashboards',
    subtitle: 'Operational Views & Life-Safety Dispatches',
    summary:
      'Executive command center, real-time video monitoring feeds, 3D facility digital twin, incident registers, and proactive alert banners.',
    colorTheme: {
      borderTop: 'border-t-purple-600',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      badgeText: 'text-purple-600',
      activeRing: 'ring-purple-600',
      accentText: 'text-purple-600',
      iconBg: 'bg-purple-50 text-purple-600',
    },
    metrics: [
      { label: 'Core Dashboard Views', value: '6 Views' },
      { label: 'Alert Severity Levels', value: '4 Tiers' },
      { label: 'Dispatch Latency', value: '<200ms' },
    ],
    statusTag: { label: 'Live Operational UI', verified: true },
    flowContract: {
      inputs: [
        'Synthesized agent findings, CV model predictions, and calculated KPI metrics',
        'Triggered SLA alert records from ehs_core.safety_alerts',
        'Spatial hazard coordinates for 3D digital twin rendering',
      ],
      processing: [
        'Reactive React 19 UI state binding and cached query caching',
        'Top-bar alert badge increment and slide-out alert drawer dispatch',
        '3D Three.js WebGL spatial coordinate mapping with pulse beacons',
        'Filterable tabular rendering with sortable headers and pagination',
      ],
      outputs: [
        'Executive Command Center (/overview) with real-time safety KPIs',
        'Dedicated Video Monitoring View (/monitoring) with player controls',
        'Hazard & Incident registers (/events/*) with audit details',
        'AI Assistant Chat Studio (/ehs-agent) with citation pills',
      ],
    },
  },
  {
    id: 'human-decision',
    stepNumber: '06',
    name: 'HUMAN DECISION & ACTION',
    shortName: 'Decisions',
    subtitle: 'Review, CAPA & Governance Sign-Off',
    summary:
      'Mandatory human-in-the-loop verification, operator alert triage, CAPA assignment, four-eyes approval on critical events, and audit logs.',
    colorTheme: {
      borderTop: 'border-t-emerald-600',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeText: 'text-emerald-700',
      activeRing: 'ring-emerald-600',
      accentText: 'text-emerald-700',
      iconBg: 'bg-emerald-50 text-emerald-700',
    },
    metrics: [
      { label: 'Mandatory Human Review', value: '100% Policy' },
      { label: 'Four-Eyes Sign-Off', value: 'Critical / LTI' },
      { label: 'Immutable Audit Trail', value: 'OSHA / ISO' },
    ],
    statusTag: { label: 'Strict Human-in-the-Loop', verified: true },
    flowContract: {
      inputs: [
        'Computer vision alert flags (falls, smoke/fire, exit obstruction)',
        'AI agent root-cause diagnoses and proposed corrective actions',
        'SLA breach warnings requiring immediate supervisor intervention',
      ],
      processing: [
        'Safety Officer visual verification of incident clips (confirm or dismiss)',
        'CAPA assignment: designated action owner and target completion date',
        'Four-eyes management approval for high-risk incident sign-off',
        'Model feedback logging to calibrate vision thresholds and reduce false positives',
      ],
      outputs: [
        'Verified incident records closed with signed resolution timestamps',
        'Legally defensible audit trail for OSHA and regulatory compliance',
        'Calibrated false-positive flags improving ongoing model precision',
      ],
    },
  },
];

/** Helper to retrieve stage metadata */
export const getStageById = (id: StageId): ArchitectureStageInfo => {
  const found = SYSTEM_STAGES.find(s => s.id === id);
  return found || SYSTEM_STAGES[0];
};

/** Categorized list of agents for Stage 4 directory */
export const CATEGORIZED_SYSTEM_DIRECTORY = {
  agents: LIST_OF_ALL_AGENTS.filter(a => a.category === 'agent'),
  models: LIST_OF_ALL_AGENTS.filter(a => a.category === 'model'),
  engines: LIST_OF_ALL_AGENTS.filter(a => a.category === 'engine'),
  simulations: LIST_OF_ALL_AGENTS.filter(a => a.category === 'simulation'),
};
