export type AgentCategory = 'agent' | 'model' | 'engine' | 'simulation';
export type ImplementationStatus = 'operational' | 'partial' | 'planned';

export interface ArchitectureNode {
  id: string;
  label: string;
  sublabel?: string;
  tier: 'input' | 'ingestion' | 'processing' | 'storage' | 'bi' | 'intelligence' | 'alerts' | 'presentation';
  status: 'verified' | 'partial' | 'proposed' | 'unavailable';
  details: {
    purpose: string;
    inputs: string[];
    outputs: string[];
    techOrTable?: string;
    codeRef?: string;
  };
}

export interface ArchitectureEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

export interface AgentArchitectureRecord {
  id: string;
  name: string;
  category: AgentCategory;
  categoryLabel: string;
  status: ImplementationStatus;
  statusLabel: string;
  role: string;
  businessObjective: string;
  intelligenceCapability: string;
  processingSummary: string;
  outputDestination: string;

  // 1. INPUT LAYER
  inputLayer: {
    sourceApplication: string;
    database: string;
    schema: string;
    sourceTables: {
      table: string;
      verified: boolean;
      primaryKey: string;
      requiredColumns: string[];
      description: string;
    }[];
    apiEndpoints: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      endpoint: string;
      purpose: string;
      authRequired: boolean;
    }[];
    dataFormat: string;
    ingestionMechanism: string;
    refreshFrequency: string;
    validationRequirements: string[];
    ownership: string;
  };

  // 2. PROCESSING LAYER
  processingLayer: {
    pipelineSteps: {
      stage: string;
      description: string;
      componentLocation: string;
    }[];
    businessRulesAndFormulas: {
      name: string;
      formulaOrRule: string;
      context: string;
    }[];
    errorHandlingAndLogging: string[];
  };

  // 3. PRESENTATION LAYER
  presentationLayer: {
    viewsAndRoutes: {
      viewName: string;
      route: string;
      purpose: string;
    }[];
    kpiMetrics: {
      name: string;
      businessDefinition: string;
      calculation: string;
      sourceData: string;
      refreshTrigger: string;
    }[];
    chartsAndDisplays: string[];
    exportCapabilities: string[];
  };

  // 4. AI INTELLIGENCE LAYER
  intelligenceLayer: {
    analyse: string;
    detect: string;
    predict: string;
    recommend: string;
    automate: string;
    modelDetails: {
      name: string;
      versionOrFramework: string;
      inferenceApi: string;
      confidenceThreshold?: string;
      latencyTarget?: string;
    };
    guardrailsAndSafety: {
      humanReviewRequirement: string;
      falsePositiveHandling: string;
      escalationWorkflow: string;
      auditLogging: string;
    };
  };

  // Interactive Diagram Specification
  diagram: {
    nodes: ArchitectureNode[];
    edges: ArchitectureEdge[];
  };
}

export const AGENT_ARCHITECTURE_REGISTRY: Record<string, AgentArchitectureRecord> = {
  ehs_safety_agent: {
    id: 'ehs_safety_agent',
    name: 'EHS Agent',
    category: 'agent',
    categoryLabel: 'AI Agent (Single SQL Agent)',
    status: 'operational',
    statusLabel: 'Operational',
    role: 'Single agent that answers EHS questions by reading the three approved tables with two read-only tools',
    businessObjective:
      'Answers plant safety questions about incidents, hazards, corrective actions, workforce attendance and maintenance by inspecting the table schemas, running read-only SQL and writing an answer grounded in the results.',
    intelligenceCapability:
      'Schema inspection, read-only SQL analysis across the three tables, evidence citation with record IDs, and human-in-the-loop guardrails.',
    processingSummary:
      'User question → DomoGPT picks a tool → inspect_schema(table) or run_query(sql) → result returned to DomoGPT → repeat (max 6 steps) → final answer with evidence.',
    outputDestination: 'AI Safety Assistant View',
    inputLayer: {
      sourceApplication: 'EHS Safety AI Management System',
      database: 'Neon PostgreSQL 18.6 (Serverless)',
      schema: 'ehs_core',
      sourceTables: [
        {
          table: 'fact_ehs_event',
          verified: true,
          primaryKey: 'ehs_event_id',
          requiredColumns: [
            'ehs_event_id',
            'event_ts',
            'plant_id',
            'area',
            'shift_id',
            'event_type',
            'hazard_category',
            'risk_severity',
            'lost_time_injury',
            'action_owner',
            'due_date',
            'action_status',
            'permit_id',
          ],
          description: 'Master recorded safety events, hazards, near-misses, first-aid logs, and CAPA ownership.',
        },
        {
          table: 'fact_workforce_attendance',
          verified: true,
          primaryKey: 'attendance_id',
          requiredColumns: [
            'attendance_id',
            'work_date',
            'employee_id',
            'plant_id',
            'shift_id',
            'scheduled_hours',
            'actual_hours',
            'attendance_status',
            'overtime_hours',
            'skill_match',
            'training_compliance',
          ],
          description: 'Shift workforce attendance, actual hours, overtime hours, and training certification compliance.',
        },
        {
          table: 'fact_maintenance_work_order',
          verified: true,
          primaryKey: 'work_order_id',
          requiredColumns: [
            'work_order_id',
            'machine_id',
            'plant_id',
            'created_ts',
            'maintenance_type',
            'failure_mode',
            'priority',
            'planned_start',
            'actual_start',
            'downtime_avoided_estimate_min',
            'status',
            'technician_id',
          ],
          description: 'Industrial maintenance work orders, machine failure modes, P1 priorities, and downtime metrics.',
        },
      ],
      apiEndpoints: [
        {
          method: 'POST',
          endpoint: '/api/v1/ai/query',
          purpose: 'Sends a natural-language EHS question to the EHS Agent',
          authRequired: false,
        },
        {
          method: 'GET',
          endpoint: '/api/v1/ai/agents',
          purpose: 'Fetches metadata and limits of the EHS Agent',
          authRequired: false,
        },
        {
          method: 'GET',
          endpoint: '/api/v1/ai/health',
          purpose: 'Probes upstream DomoGPT LLM connectivity and active runtime models',
          authRequired: false,
        },
      ],
      dataFormat: 'JSON payload with typed Pydantic models (AIQueryRequest / AIQueryResponse)',
      ingestionMechanism: 'Direct REST API invoke triggering asynchronous SQLAlchemy ORM read queries',
      refreshFrequency: 'On demand per user inquiry / cached connectivity probe every 120s',
      validationRequirements: [
        'Mandatory tenant plant_id check (prevents cross-plant data leakage for non-fleet users)',
        'run_query accepts one SELECT only, on the three approved tables, max 50 rows, 8 s timeout',
        'Plant-scoped users only ever see rows of their own plant (tables are shadowed by plant-filtered CTEs)',
      ],
      ownership: 'Enterprise EHS Operations & AI Systems Engineering',
    },
    processingLayer: {
      pipelineSteps: [
        {
          stage: '1. Instructions & question',
          description: 'The prompt lists the three tables and their columns, the tool protocol and the integrity rules, plus today\'s date and the plant scope.',
          componentLocation: 'backend/app/agents/instruction.py',
        },
        {
          stage: '2. inspect_schema(table)',
          description: 'Returns columns, meanings, row count and the live allowed values of a table so the agent uses real column names and values.',
          componentLocation: 'backend/app/agents/tools/inspect_schema.py',
        },
        {
          stage: '3. run_query(sql)',
          description: 'Validates and runs one read-only SELECT (read-only transaction, timeout, 50-row cap, plant scope) and returns the rows.',
          componentLocation: 'backend/app/agents/tools/run_query.py, sql_guard.py',
        },
        {
          stage: '4. Final answer',
          description: 'After at most 6 steps the agent returns a summary, key findings, recommendations and follow-up questions with record IDs as evidence.',
          componentLocation: 'backend/app/agents/agent.py',
        },
      ],
      businessRulesAndFormulas: [
        {
          name: 'Zero-Mock Evidence Invariant',
          formulaOrRule: 'Every number in an answer must come from a tool result; record IDs are returned as evidence.',
          context: 'Prevents hallucination of safety metrics or incident rates.',
        },
        {
          name: 'Overdue corrective action',
          formulaOrRule: "due_date < today AND action_status <> 'CLOSED'",
          context: 'Applied to fact_ehs_event.',
        },
        {
          name: 'Human Review Mandatory',
          formulaOrRule: 'AI suggestions are advisory; the agent is read-only and cannot change action_status.',
          context: 'Regulatory OSHA/ISO 45001 compliance mandate.',
        },
      ],
      errorHandlingAndLogging: [
        'A rejected or failed query is returned to the agent as an error message so it can correct the SQL.',
        'DomoGPT timeout / rate-limit errors are returned to the user with a clear error code.',
      ],
    },
    presentationLayer: {
      viewsAndRoutes: [
        { viewName: 'EHS Agent', route: '/ehs-agent', purpose: 'Interactive chat with the EHS Agent' },
        { viewName: 'Executive Overview', route: '/overview', purpose: 'Surfaces AI safety briefings and alert summaries' },
      ],
      kpiMetrics: [
        {
          name: 'Tool Calls per Answer',
          businessDefinition: 'Number of inspect_schema / run_query calls used to answer a question',
          calculation: 'COUNT(execution_trace)',
          sourceData: 'AIQueryResponse.execution_trace',
          refreshTrigger: 'Per query request',
        },
      ],
      chartsAndDisplays: ['Interactive conversation stream with tool-call trace', 'Evidence citation accordion drawer'],
      exportCapabilities: ['Markdown safety briefing copy to clipboard', 'Audit-ready EHS summary export'],
    },
    intelligenceLayer: {
      analyse: 'Examines safety questions across incidents, hazards, shifts, workforce attendance and maintenance orders.',
      detect: 'Detects patterns by plant, area and shift (e.g. repeated hazards or overdue corrective actions).',
      predict: 'Flags areas at risk of escalation based on recurring patterns and overdue action velocity.',
      recommend: 'Synthesizes concrete next steps for plant safety coordinators and supervisors.',
      automate: 'Automates evidence retrieval and draft report generation; zero write automation without approval.',
      modelDetails: {
        name: 'DomoGPT Service / Claude / GPT-4o backend',
        versionOrFramework: 'Single agent loop + two SQL tools + REST LLM proxy',
        inferenceApi: 'https://api.domo.com/ai/v1/chat/completions',
        confidenceThreshold: 'Strict schema conformity & evidence grounding',
        latencyTarget: '< 2.5 seconds total end-to-end turnaround',
      },
      guardrailsAndSafety: {
        humanReviewRequirement: 'Strictly required for all recommendations before field implementation.',
        falsePositiveHandling: 'Evidence citations display raw database record IDs for instant human verification.',
        escalationWorkflow: 'The agent only reports; escalation is done by humans and the alert engine.',
        auditLogging: 'Each response lists every tool call (execution trace) with its SQL.',
      },
    },
    diagram: {
      nodes: [
        {
          id: 'user_inquiry',
          label: 'User Safety Inquiry',
          sublabel: 'UI Prompt or API Request',
          tier: 'input',
          status: 'verified',
          details: {
            purpose: 'Captures operator or plant manager questions regarding safety status',
            inputs: ['User text', 'Plant Scope', 'Auth Principal'],
            outputs: ['Validated AIQueryRequest'],
            codeRef: 'src/views/EhsAgentView.tsx',
          },
        },
        {
          id: 'agent_loop',
          label: 'EHS Agent',
          sublabel: 'Tool loop (max 6 steps)',
          tier: 'processing',
          status: 'verified',
          details: {
            purpose: 'Asks DomoGPT for the next action, runs the chosen tool and feeds the result back until the final answer',
            inputs: ['Question', 'Instructions', 'Tool results'],
            outputs: ['Final answer', 'Execution trace'],
            codeRef: 'backend/app/agents/agent.py',
          },
        },
        {
          id: 'domogpt_service',
          label: 'DomoGPT',
          sublabel: 'LLM Reasoning',
          tier: 'intelligence',
          status: 'verified',
          details: {
            purpose: 'Decides which tool to call next and writes the grounded final answer',
            inputs: ['Instructions', 'Question', 'Tool history'],
            outputs: ['JSON action: inspect_schema, run_query or final'],
            techOrTable: 'DomoGPT REST API',
            codeRef: 'backend/app/services/domogpt_service.py',
          },
        },
        {
          id: 'sql_tools',
          label: 'inspect_schema + run_query',
          sublabel: 'Read-Only SQL Tools',
          tier: 'storage',
          status: 'verified',
          details: {
            purpose: 'Shows table schemas and runs validated read-only SELECT queries without modifying state',
            inputs: ['Table name', 'SQL text', 'Plant scope'],
            outputs: ['Schema info', 'Result rows (max 50)'],
            techOrTable: 'ehs_core.fact_ehs_event, fact_workforce_attendance, fact_maintenance_work_order',
            codeRef: 'backend/app/agents/tools/',
          },
        },
        {
          id: 'assistant_ui',
          label: 'AI Safety Assistant View',
          sublabel: 'Interactive Presentation',
          tier: 'presentation',
          status: 'verified',
          details: {
            purpose: 'Displays the answer, evidence citations, tool-call trace and suggestion pills',
            inputs: ['AIQueryResponse'],
            outputs: ['User UI View / Clipboard'],
            codeRef: 'src/views/EhsAgentView.tsx',
          },
        },
      ],
      edges: [
        { id: 'e1', from: 'user_inquiry', to: 'agent_loop', label: 'POST /api/v1/ai/query' },
        { id: 'e2', from: 'agent_loop', to: 'domogpt_service', label: 'Prompt + tool history' },
        { id: 'e3', from: 'agent_loop', to: 'sql_tools', label: 'Tool call' },
        { id: 'e4', from: 'sql_tools', to: 'agent_loop', label: 'Rows / schema' },
        { id: 'e5', from: 'agent_loop', to: 'assistant_ui', label: 'Answer with evidence' },
      ],
    },
  },

  fall_detection: {
    id: 'fall_detection',
    name: 'Fall & Posture Detection Model',
    category: 'model',
    categoryLabel: 'Computer Vision Inference Model',
    status: 'operational',
    statusLabel: 'Operational (Live ML Pipeline)',
    role: 'Real-time worker biomechanics and slip/fall detection',
    businessObjective:
      'Monitors shop floor CCTV cameras to detect worker slips, pre-fall instability, ground-level falls, and post-fall inactivity, generating immediate life-safety alerts.',
    intelligenceCapability:
      '2D body pose estimation, torso inclination angle tracking, bounding box aspect-ratio collapse detection, and velocity thresholding.',
    processingSummary:
      'Video stream / file → Frame extraction via OpenCV → MediaPipe OpenFall pose landmark inference → Center-of-mass velocity & torso angle computation → Threshold check (>65° tilt + floor contact) → Alert generation in ehs_core.safety_alerts.',
    outputDestination: 'Video Monitoring View, Safety Alerts Drawer, and Active Alerts Strip',
    inputLayer: {
      sourceApplication: 'Fixed Industrial Security / IP CCTV Cameras',
      database: 'Neon PostgreSQL 18.6 (Alerts) & Local Storage (Video Library)',
      schema: 'ehs_core',
      sourceTables: [
        {
          table: 'safety_alerts',
          verified: true,
          primaryKey: 'alert_id',
          requiredColumns: ['alert_id', 'scenario', 'category', 'severity', 'confidence', 'facts_json', 'evidence_json'],
          description: 'Persists generated fall alerts with confidence and annotated evidence frames.',
        },
      ],
      apiEndpoints: [
        {
          method: 'GET',
          endpoint: '/api/v1/detection/library',
          purpose: 'Lists available CCTV clips partitioned by scenario',
          authRequired: false,
        },
        {
          method: 'POST',
          endpoint: '/api/v1/detection/analyze',
          purpose: 'Executes OpenFall pose detection worker on chosen clip',
          authRequired: false,
        },
      ],
      dataFormat: 'MP4 / H.264 video streams at 15–30 FPS; frame resolution 720p / 1080p',
      ingestionMechanism: 'Direct video file decode via OpenCV VideoCapture',
      refreshFrequency: 'Frame-by-frame inference at 15 FPS',
      validationRequirements: [
        'Frame dimensions minimum 640x480 for reliable keypoint extraction',
        'Camera angle tilted at 15°–45° looking down at walkway',
      ],
      ownership: 'Plant Security & EHS Video Intelligence',
    },
    processingLayer: {
      pipelineSteps: [
        {
          stage: '1. Frame Preprocessing',
          description: 'Resizes frame to model input dimensions and converts BGR to RGB.',
          componentLocation: 'OpenFall/src/detector.py',
        },
        {
          stage: '2. Pose Landmark Extraction',
          description: 'Extracts 33 2D pose landmarks using MediaPipe Pose Landmarker Lite.',
          componentLocation: 'OpenFall/data/pose_landmarker_lite.task',
        },
        {
          stage: '3. Biomechanical Feature Evaluation',
          description: 'Computes torso angle relative to vertical and tracks vertical velocity (dy/dt).',
          componentLocation: 'backend/app/detection/workers/fall_worker.py',
        },
        {
          stage: '4. Fall State Machine',
          description: 'Transitions through NORMAL → UNSTABLE → FALLING → ON_GROUND → INACTIVE.',
          componentLocation: 'backend/app/detection/workers/fall_worker.py',
        },
      ],
      businessRulesAndFormulas: [
        {
          name: 'Fall Trigger Rule',
          formulaOrRule: 'Torso Angle > 65° AND Height Aspect Ratio < 0.8 AND vertical velocity > 1.8 m/s',
          context: 'Distinguishes genuine falls from intentional bending or sitting.',
        },
        {
          name: 'Prolonged Inactivity Rule',
          formulaOrRule: 'Worker remains on ground with zero major limb movement for > 5 seconds → CRITICAL Alert.',
          context: 'Indicates potential unconsciousness or severe injury.',
        },
      ],
      errorHandlingAndLogging: ['Frames with low landmark visibility confidence (<0.5) skipped to prevent false alarms.'],
    },
    presentationLayer: {
      viewsAndRoutes: [
        { viewName: 'Safety Monitoring', route: '/monitoring', purpose: 'Live video player with bounding box overlay and timeline' },
      ],
      kpiMetrics: [
        {
          name: 'Detection Confidence',
          businessDefinition: 'Model confidence score for the detected fall event',
          calculation: 'Pose keypoint visibility average (0.00–1.00)',
          sourceData: 'Inference result payload',
          refreshTrigger: 'On video analysis completion',
        },
      ],
      chartsAndDisplays: ['Video canvas with skeleton overlay', 'Detection event timeline bar'],
      exportCapabilities: ['Annotated video playback and thumbnail evidence download'],
    },
    intelligenceLayer: {
      analyse: 'Tracks temporal keypoint trajectories of shoulder, hip, knee, and ankle joints across frames.',
      detect: 'Detects sudden uncontrolled descent, rapid impact deceleration, and horizontal posture.',
      predict: 'Estimates high slip risk in areas where micro-instabilities recur frequently.',
      recommend: 'Dispatches first responder to exact plant zone and recommends floor grip inspection.',
      automate: 'Generates CRITICAL safety alert and pushes notification to on-duty safety officer.',
      modelDetails: {
        name: 'OpenFall MediaPipe Pose Landmarker Lite',
        versionOrFramework: 'MediaPipe Task / PyTorch',
        inferenceApi: 'backend/app/detection/workers/fall_worker.py',
        confidenceThreshold: '0.65 landmark visibility',
        latencyTarget: '< 45 ms per frame inference',
      },
      guardrailsAndSafety: {
        humanReviewRequirement: 'Safety officer must review video evidence snapshot to confirm alert.',
        falsePositiveHandling: 'Sitting/crouching poses filtered out by vertical velocity check.',
        escalationWorkflow: 'Unacknowledged CRITICAL fall alert escalates after 5 minutes.',
        auditLogging: 'Detection timestamp, video filename, and frame index stored permanently.',
      },
    },
    diagram: {
      nodes: [
        {
          id: 'cctv_stream',
          label: 'Industrial CCTV Stream',
          sublabel: 'RTSP / MP4 Video (15-30 FPS)',
          tier: 'input',
          status: 'verified',
          details: {
            purpose: 'Captures continuous shop floor surveillance video',
            inputs: ['CCTV Camera Feed'],
            outputs: ['Raw video frames'],
            techOrTable: 'OpenCV VideoCapture',
          },
        },
        {
          id: 'pose_extractor',
          label: 'OpenFall Pose Extractor',
          sublabel: 'MediaPipe 33 Landmark Model',
          tier: 'processing',
          status: 'verified',
          details: {
            purpose: 'Extracts 33 anatomical landmark coordinates per person',
            inputs: ['RGB Video Frame'],
            outputs: ['Keypoint coordinates and visibility scores'],
            codeRef: 'OpenFall/src/detector.py',
          },
        },
        {
          id: 'fall_classifier',
          label: 'Biomechanics State Machine',
          sublabel: 'Angle & Velocity Evaluator',
          tier: 'intelligence',
          status: 'verified',
          details: {
            purpose: 'Calculates torso inclination, velocity, and inactivity duration',
            inputs: ['Landmark coordinates'],
            outputs: ['Fall event classification, confidence, bounding boxes'],
            codeRef: 'backend/app/detection/workers/fall_worker.py',
          },
        },
        {
          id: 'alert_generator',
          label: 'Safety Alert Dispatcher',
          sublabel: 'ehs_core.safety_alerts',
          tier: 'alerts',
          status: 'verified',
          details: {
            purpose: 'Persists alert record with thumbnail and notifies on-call safety officer',
            inputs: ['Fall event classification'],
            outputs: ['SafetyAlert row in Neon DB'],
            techOrTable: 'ehs_core.safety_alerts',
          },
        },
        {
          id: 'video_ui',
          label: 'Safety Video Player',
          sublabel: 'UI Presentation',
          tier: 'presentation',
          status: 'verified',
          details: {
            purpose: 'Renders video with bounding boxes, event timeline, and one-click alert triage',
            inputs: ['Analysis payload'],
            outputs: ['Live interactive player'],
            codeRef: 'src/views/VideoMonitoringView.tsx',
          },
        },
      ],
      edges: [
        { id: 'fe1', from: 'cctv_stream', to: 'pose_extractor', label: 'Frame decoding' },
        { id: 'fe2', from: 'pose_extractor', to: 'fall_classifier', label: '33 2D landmarks' },
        { id: 'fe3', from: 'fall_classifier', to: 'alert_generator', label: 'Fall detected (>0.65 conf)' },
        { id: 'fe4', from: 'alert_generator', to: 'video_ui', label: 'Annotated video + alert payload' },
      ],
    },
  },

  smoke_fire: {
    id: 'smoke_fire',
    name: 'Smoke & Fire Monitoring Model',
    category: 'model',
    categoryLabel: 'Computer Vision Inference Model',
    status: 'operational',
    statusLabel: 'Operational (Live ML Pipeline)',
    role: 'Optical flame and industrial smoke plume detection',
    businessObjective:
      'Monitors manufacturing plant bays, welding cells, and chemical storage areas to detect visible ignition flames and thermal smoke plumes before conventional heat sensors trigger.',
    intelligenceCapability:
      'Convolutional object detection, multi-scale feature pyramids, bounding box regression for flame and smoke classes, and temporal confirmation.',
    processingSummary:
      'Video frames → YOLOv8 inference with fine-tuned fire/smoke weights → Bounding box & class confidence extraction → Multi-frame persistence filter (>=3 consecutive frames) → CRITICAL Alert creation.',
    outputDestination: 'Video Monitoring View and Emergency Notification Dispatch',
    inputLayer: {
      sourceApplication: 'Plant Facility Surveillance System',
      database: 'Neon PostgreSQL 18.6 (Alerts)',
      schema: 'ehs_core',
      sourceTables: [
        {
          table: 'safety_alerts',
          verified: true,
          primaryKey: 'alert_id',
          requiredColumns: ['alert_id', 'scenario', 'severity', 'confidence', 'location'],
          description: 'Persists critical smoke and fire alarms.',
        },
      ],
      apiEndpoints: [
        {
          method: 'POST',
          endpoint: '/api/v1/detection/analyze',
          purpose: 'Executes YOLOv8 fire/smoke worker on selected video',
          authRequired: false,
        },
      ],
      dataFormat: 'RGB video frames at 640x640 resolution',
      ingestionMechanism: 'OpenCV frame grabber with YOLOv8 preprocessing',
      refreshFrequency: 'Continuous frame inference (10–15 FPS)',
      validationRequirements: ['Validation of model weights fire_smoke_yolov8.pt in models_cache/'],
      ownership: 'Plant Fire Safety & Facilities',
    },
    processingLayer: {
      pipelineSteps: [
        {
          stage: '1. Frame Normalization',
          description: 'Letterbox resizing to 640x640 and channel normalization.',
          componentLocation: 'backend/app/detection/workers/smoke_fire_worker.py',
        },
        {
          stage: '2. YOLOv8 Inference',
          description: 'Predicts bounding boxes and class logits for "fire" and "smoke".',
          componentLocation: 'backend/models_cache/fire_smoke_yolov8.pt',
        },
        {
          stage: '3. Temporal Persistence Filter',
          description: 'Requires detection across >= 3 consecutive frames to eliminate transient welding sparks.',
          componentLocation: 'backend/app/detection/workers/smoke_fire_worker.py',
        },
      ],
      businessRulesAndFormulas: [
        {
          name: 'Fire Severity Invariant',
          formulaOrRule: 'Any verified flame detection with confidence > 0.40 is classified as CRITICAL severity.',
          context: 'Zero-tolerance plant fire safety.',
        },
      ],
      errorHandlingAndLogging: ['Automatic fallback to heuristic detection if PyTorch CUDA context fails.'],
    },
    presentationLayer: {
      viewsAndRoutes: [
        { viewName: 'Safety Monitoring', route: '/monitoring', purpose: 'Scenario video analysis and flame bounding boxes' },
      ],
      kpiMetrics: [
        {
          name: 'Flame Confidence Score',
          businessDefinition: 'YOLOv8 prediction confidence for detected flame',
          calculation: 'Sigmoid class probability (0.00–1.00)',
          sourceData: 'Model inference output',
          refreshTrigger: 'Per analyzed frame',
        },
      ],
      chartsAndDisplays: ['Video bounding boxes in orange/red', 'Alert incident summary'],
      exportCapabilities: ['Download annotated evidence frame as JPEG'],
    },
    intelligenceLayer: {
      analyse: 'Evaluates color chrominance, flicker frequency, and expanding boundary geometries of smoke clouds.',
      detect: 'Detects visible flames and smoke plumes in unmonitored plant corners.',
      predict: 'Anticipates rapid flame spread if flammable solvent storage is in close proximity.',
      recommend: 'Prompts immediate plant evacuation alarm and dispatches emergency response team.',
      automate: 'Generates CRITICAL alert in safety_alerts with audio/visual notification broadcast.',
      modelDetails: {
        name: 'YOLOv8 Fire & Smoke Detector',
        versionOrFramework: 'Ultralytics YOLOv8 / PyTorch',
        inferenceApi: 'backend/app/detection/smoke_fire_service.py',
        confidenceThreshold: '0.40 confidence score',
        latencyTarget: '< 30 ms per frame inference',
      },
      guardrailsAndSafety: {
        humanReviewRequirement: 'Safety officer confirms alert before triggering municipal fire department call.',
        falsePositiveHandling: 'Transient sparks filtered by temporal 3-frame persistence filter.',
        escalationWorkflow: 'CRITICAL severity with immediate SMS / push notification to emergency response lead.',
        auditLogging: 'Full inference logs stored with frame bounding box coordinates.',
      },
    },
    diagram: {
      nodes: [
        {
          id: 'thermal_cam',
          label: 'Plant Facility Camera Feed',
          sublabel: 'RTSP Stream / Video File',
          tier: 'input',
          status: 'verified',
          details: {
            purpose: 'Captures high-hazard manufacturing area video',
            inputs: ['CCTV camera'],
            outputs: ['RGB frames'],
            techOrTable: 'OpenCV VideoCapture',
          },
        },
        {
          id: 'yolo_fire',
          label: 'YOLOv8 Smoke & Fire Model',
          sublabel: 'fire_smoke_yolov8.pt',
          tier: 'intelligence',
          status: 'verified',
          details: {
            purpose: 'Detects bounding boxes for active flame and expanding smoke plumes',
            inputs: ['640x640 normalized frames'],
            outputs: ['Bounding boxes, class labels, confidence scores'],
            codeRef: 'backend/app/detection/workers/smoke_fire_worker.py',
          },
        },
        {
          id: 'persistence_filter',
          label: 'Temporal Filter & Deduplicator',
          sublabel: '3-Frame Window',
          tier: 'processing',
          status: 'verified',
          details: {
            purpose: 'Filters out single-frame welding flash and transient specular reflections',
            inputs: ['Frame detections'],
            outputs: ['Confirmed fire event'],
            codeRef: 'backend/app/detection/workers/smoke_fire_worker.py',
          },
        },
        {
          id: 'fire_alert',
          label: 'Emergency Alert Creator',
          sublabel: 'ehs_core.safety_alerts',
          tier: 'alerts',
          status: 'verified',
          details: {
            purpose: 'Creates CRITICAL alert row and notifies emergency response team',
            inputs: ['Confirmed fire event'],
            outputs: ['SafetyAlert record'],
            techOrTable: 'ehs_core.safety_alerts',
          },
        },
      ],
      edges: [
        { id: 'sfe1', from: 'thermal_cam', to: 'yolo_fire', label: 'Frame stream' },
        { id: 'sfe2', from: 'yolo_fire', to: 'persistence_filter', label: 'Raw detections' },
        { id: 'sfe3', from: 'persistence_filter', to: 'fire_alert', label: 'Persistent fire (>3 frames)' },
      ],
    },
  },

  exit_obstruction: {
    id: 'exit_obstruction',
    name: 'Emergency Exit Obstruction Model',
    category: 'model',
    categoryLabel: 'Computer Vision Inference Model',
    status: 'operational',
    statusLabel: 'Operational (Live ML Pipeline)',
    role: 'Egress corridor and emergency fire door clear-path monitoring',
    businessObjective:
      'Monitors designated emergency exit pathways, fire doors, and evacuation routes to identify stationary pallets, stalled machinery, or debris blocking egress routes.',
    intelligenceCapability:
      'ROI polygon intersection, stationary object tracking, COCO object classification (box, pallet, cart, vehicle), and obstruction duration thresholding.',
    processingSummary:
      'Video stream → YOLOv8n object detection → Bounding box intersection with calibrated Exit ROI polygon → Stationary tracker (>30 seconds in egress zone) → HIGH severity Safety Alert generated.',
    outputDestination: 'Video Monitoring View, Hazard Register',
    inputLayer: {
      sourceApplication: 'Facility Egress CCTV Network',
      database: 'Neon PostgreSQL 18.6',
      schema: 'ehs_core',
      sourceTables: [
        {
          table: 'safety_alerts',
          verified: true,
          primaryKey: 'alert_id',
          requiredColumns: ['alert_id', 'scenario', 'location', 'severity', 'facts_json'],
          description: 'Persists emergency exit obstruction alerts.',
        },
      ],
      apiEndpoints: [
        {
          method: 'POST',
          endpoint: '/api/v1/detection/analyze',
          purpose: 'Analyzes video for exit door pathway blockage',
          authRequired: false,
        },
      ],
      dataFormat: 'Video frames with calibrated 4-point exit zone polygon',
      ingestionMechanism: 'OpenCV VideoCapture + ROI mask intersection',
      refreshFrequency: 'Continuous monitoring (10 FPS)',
      validationRequirements: ['ROI polygon coordinates defined for monitored doorway'],
      ownership: 'EHS Life Safety & Plant Operations',
    },
    processingLayer: {
      pipelineSteps: [
        {
          stage: '1. Object Detection',
          description: 'YOLOv8n identifies objects (boxes, pallets, chairs, carts).',
          componentLocation: 'backend/models_cache/yolov8n.pt',
        },
        {
          stage: '2. Polygon Intersection',
          description: 'Computes geometric overlap between object bounding box and egress zone.',
          componentLocation: 'backend/app/detection/workers/exit_obstruction_worker.py',
        },
        {
          stage: '3. Stationary Time Tracking',
          description: 'Verifies object remains stationary in exit zone for >30 seconds.',
          componentLocation: 'backend/app/detection/workers/exit_obstruction_worker.py',
        },
      ],
      businessRulesAndFormulas: [
        {
          name: 'OSHA 1910.36 Egress Rule',
          formulaOrRule: 'Any obstruction reducing exit passage width below 28 inches for > 30 seconds triggers an alert.',
          context: 'Mandatory continuous clear exit width standard.',
        },
      ],
      errorHandlingAndLogging: ['Moving personnel walking through doorway do not trigger obstruction alerts.'],
    },
    presentationLayer: {
      viewsAndRoutes: [
        { viewName: 'Safety Monitoring', route: '/monitoring', purpose: 'Displays exit corridor overlay and obstruction bounding boxes' },
      ],
      kpiMetrics: [
        {
          name: 'Blocked Doorways',
          businessDefinition: 'Count of monitored exit doors currently flagged with active obstructions',
          calculation: 'COUNT(Active Obstruction Alerts)',
          sourceData: 'ehs_core.safety_alerts',
          refreshTrigger: 'Alert state update',
        },
      ],
      chartsAndDisplays: ['Corridor Zone Overlay', 'Obstruction Duration Clock'],
      exportCapabilities: ['Export egress compliance snapshot to audit report'],
    },
    intelligenceLayer: {
      analyse: 'Tracks object centroid displacement across time inside calibrated exit zone.',
      detect: 'Detects stationary obstructions left in fire escape corridors.',
      predict: 'Flags loading dock staging areas likely to spill into fire exit pathways during shift changes.',
      recommend: 'Prompts area supervisor to immediately remove pallets from emergency doors.',
      automate: 'Generates HIGH severity safety alert with photo evidence of blocked doorway.',
      modelDetails: {
        name: 'YOLOv8n + Stationary ROI Spatial Tracker',
        versionOrFramework: 'Ultralytics YOLOv8n / PyTorch',
        inferenceApi: 'backend/app/detection/exit_obstruction_service.py',
        confidenceThreshold: '0.45 detection confidence',
        latencyTarget: '< 25 ms per frame inference',
      },
      guardrailsAndSafety: {
        humanReviewRequirement: 'Floor team must clear obstruction and log visual confirmation.',
        falsePositiveHandling: 'Personnel passing through exit do not register due to continuous motion tracking.',
        escalationWorkflow: 'Escalates to HIGH severity after 5 minutes of continuous blockage.',
        auditLogging: 'Doorway ID, obstruction duration, and clearance timestamp stored.',
      },
    },
    diagram: {
      nodes: [
        {
          id: 'exit_cam',
          label: 'Egress CCTV Feed',
          sublabel: 'Corridor Camera',
          tier: 'input',
          status: 'verified',
          details: {
            purpose: 'Monitors designated fire exit door and egress pathway',
            inputs: ['CCTV Video Feed'],
            outputs: ['Video frames'],
            techOrTable: 'OpenCV',
          },
        },
        {
          id: 'yolo_exit',
          label: 'YOLOv8n Object Detector',
          sublabel: 'COCO Weights',
          tier: 'processing',
          status: 'verified',
          details: {
            purpose: 'Detects physical obstacles (pallets, boxes, containers, carts)',
            inputs: ['Video frames'],
            outputs: ['Detected object bounding boxes'],
            codeRef: 'backend/app/detection/workers/exit_obstruction_worker.py',
          },
        },
        {
          id: 'roi_tracker',
          label: 'ROI Polygon & Stationary Tracker',
          sublabel: 'Egress Spatial Analyzer',
          tier: 'intelligence',
          status: 'verified',
          details: {
            purpose: 'Tests polygon overlap and tracks stationary dwell time (>30s)',
            inputs: ['Bounding boxes + ROI Mask'],
            outputs: ['Confirmed exit obstruction event'],
            codeRef: 'backend/app/detection/workers/exit_obstruction_worker.py',
          },
        },
        {
          id: 'exit_alert',
          label: 'Egress Safety Alert',
          sublabel: 'ehs_core.safety_alerts',
          tier: 'alerts',
          status: 'verified',
          details: {
            purpose: 'Stores HIGH severity alert and alerts facility operations',
            inputs: ['Confirmed exit obstruction event'],
            outputs: ['SafetyAlert record in Neon DB'],
            techOrTable: 'ehs_core.safety_alerts',
          },
        },
      ],
      edges: [
        { id: 'ee1', from: 'exit_cam', to: 'yolo_exit', label: 'Frame stream' },
        { id: 'ee2', from: 'yolo_exit', to: 'roi_tracker', label: 'Object bounding boxes' },
        { id: 'ee3', from: 'roi_tracker', to: 'exit_alert', label: 'Stationary obstacle in exit ROI' },
      ],
    },
  },

  alert_engine: {
    id: 'alert_engine',
    name: 'Real-Time Alert Triage & Escalation Engine',
    category: 'engine',
    categoryLabel: 'Automated Rule Engine',
    status: 'operational',
    statusLabel: 'Operational (Background Scheduler)',
    role: 'Automated safety alert generation, deduplication, and escalation scheduler',
    businessObjective:
      'Executes scheduled 15-second background cycles to sync CRITICAL/HIGH EHS events into actionable alerts, calculate response due dates, enforce escalation reminders, and record audit activity trails.',
    intelligenceCapability:
      'Deduplication key hashing, rule-based escalation scheduling, automatic response due date computation, and multi-tier notification dispatch.',
    processingSummary:
      'Background async loop → Queries unacknowledged critical/high events & CV alerts → Generates unique dedupe_key (source_type:source_ref) → Computes response_due_at & resolution_due_at → Dispatches in-app notifications.',
    outputDestination: 'Notification Center, Active Alerts Strip, and Safety Alerts Table',
    inputLayer: {
      sourceApplication: 'EHS Backend Background Scheduler',
      database: 'Neon PostgreSQL 18.6',
      schema: 'ehs_core',
      sourceTables: [
        {
          table: 'fact_ehs_event',
          verified: true,
          primaryKey: 'ehs_event_id',
          requiredColumns: ['ehs_event_id', 'plant_id', 'risk_severity', 'action_status', 'event_ts'],
          description: 'Source events polled for alert generation.',
        },
        {
          table: 'safety_alerts',
          verified: true,
          primaryKey: 'alert_id',
          requiredColumns: ['alert_id', 'dedupe_key', 'status', 'severity', 'response_due_at', 'resolution_due_at'],
          description: 'Target alert table storing active and resolved alerts.',
        },
        {
          table: 'alert_activities',
          verified: true,
          primaryKey: 'activity_id',
          requiredColumns: ['activity_id', 'alert_id', 'actor', 'action', 'notes', 'created_at'],
          description: 'Audit log of all acknowledgments, notes, and resolutions.',
        },
      ],
      apiEndpoints: [
        {
          method: 'GET',
          endpoint: '/api/v1/alerts?active_only=true',
          purpose: 'Fetches currently active unacknowledged and in-progress alerts',
          authRequired: false,
        },
        {
          method: 'POST',
          endpoint: '/api/v1/alerts/{id}/acknowledge',
          purpose: 'Human safety officer acknowledgment of alert receipt',
          authRequired: false,
        },
        {
          method: 'POST',
          endpoint: '/api/v1/alerts/{id}/resolve',
          purpose: 'Closes alert with verified corrective action documentation',
          authRequired: false,
        },
      ],
      dataFormat: 'Relational rows with ISO 8601 timestamps',
      ingestionMechanism: 'Asyncio background scheduler running in Uvicorn thread',
      refreshFrequency: 'Continuous cycle every 15–30 seconds',
      validationRequirements: [
        'dedupe_key uniqueness constraint prevents duplicate alerts for the same physical event',
      ],
      ownership: 'EHS Digital Operations Platform',
    },
    processingLayer: {
      pipelineSteps: [
        {
          stage: '1. Event Alert Synchronization',
          description: 'Scans fact_ehs_event for new CRITICAL/HIGH records and upserts alerts.',
          componentLocation: 'backend/app/services/alerts/service.py:sync_event_alerts',
        },
        {
          stage: '2. SLA Due Date Calculation',
          description: 'Calculates response_due_at: 15 min for CRITICAL, 60 min for HIGH.',
          componentLocation: 'backend/app/services/alerts/rules.py',
        },
        {
          stage: '3. Escalation Reminder Pass',
          description: 'Evaluates unacknowledged alerts past due date and dispatches escalation notifications.',
          componentLocation: 'backend/app/services/alerts/service.py:run_reminder_cycle',
        },
      ],
      businessRulesAndFormulas: [
        {
          name: 'Critical SLA Escalation Rule',
          formulaOrRule: 'CRITICAL alert unacknowledged after 15 minutes auto-escalates to Plant Director notification queue.',
          context: 'Emergency escalation policy.',
        },
      ],
      errorHandlingAndLogging: ['Transient DB connection exceptions caught without killing background loop.'],
    },
    presentationLayer: {
      viewsAndRoutes: [
        { viewName: 'Notification Panel', route: 'Header Bell Icon', purpose: 'Slide-out drawer with unread alerts and counters' },
        { viewName: 'Active Alerts Card', route: '/overview', purpose: 'Prominent executive alert ribbon on Command Center' },
      ],
      kpiMetrics: [
        {
          name: 'Mean Time to Acknowledge (MTTA)',
          businessDefinition: 'Average duration between alert creation and human officer acknowledgment',
          calculation: 'AVG(acknowledged_at - detected_at)',
          sourceData: 'ehs_core.safety_alerts',
          refreshTrigger: 'On alert acknowledge',
        },
      ],
      chartsAndDisplays: ['Active Alert Ticker', 'Severity Color-coded Pill Badges'],
      exportCapabilities: ['Export alert audit log to compliance archive'],
    },
    intelligenceLayer: {
      analyse: 'Tracks alert recurrence across specific machines and manufacturing areas.',
      detect: 'Detects chronic repeat incidents triggering alerts within 7 days.',
      predict: 'Flags plants with rising alert frequencies as at-risk of major safety breach.',
      recommend: 'Suggests immediate area shutdown or safety stand-down meeting for high recurrence.',
      automate: 'Automates alert generation, SLA timer tracking, and notification queuing.',
      modelDetails: {
        name: 'Deterministic SLA & Triage Scheduler',
        versionOrFramework: 'Python Asyncio Worker Loop',
        inferenceApi: 'backend/app/services/alerts/service.py',
      },
      guardrailsAndSafety: {
        humanReviewRequirement: 'Mandatory human acknowledgment and verified closure notes.',
        falsePositiveHandling: 'Officer can dismiss false alerts with mandatory audit note.',
        escalationWorkflow: 'Multi-level timeout escalation: Operator → Supervisor → Plant Manager.',
        auditLogging: 'Every status transition recorded with user identity in alert_activities.',
      },
    },
    diagram: {
      nodes: [
        {
          id: 'events_source',
          label: 'EHS Events & CV Detection',
          sublabel: 'Detection Sources',
          tier: 'input',
          status: 'verified',
          details: {
            purpose: 'Source of raw safety hazards and computer vision inference alarms',
            inputs: ['CCTV detections & field reports'],
            outputs: ['Event records'],
            techOrTable: 'fact_ehs_event & video_analyses',
          },
        },
        {
          id: 'alert_scheduler',
          label: 'Alert Engine Scheduler',
          sublabel: '15-Second Asyncio Loop',
          tier: 'processing',
          status: 'verified',
          details: {
            purpose: 'Deduplicates incoming signals, calculates SLAs, and evaluates escalation rules',
            inputs: ['Event records'],
            outputs: ['Deduplicated alerts with SLA timestamps'],
            codeRef: 'backend/app/services/alerts/service.py',
          },
        },
        {
          id: 'alerts_db',
          label: 'ehs_core.safety_alerts',
          sublabel: 'Neon PostgreSQL',
          tier: 'storage',
          status: 'verified',
          details: {
            purpose: 'Persistent store for active alerts, SLAs, and resolution history',
            inputs: ['Alert records'],
            outputs: ['Alert queries'],
            techOrTable: 'ehs_core.safety_alerts',
          },
        },
        {
          id: 'notification_ui',
          label: 'Notification Center & Alerts Card',
          sublabel: 'UI Presentation',
          tier: 'presentation',
          status: 'verified',
          details: {
            purpose: 'Displays active alerts, audio/visual badges, and allows one-click triage',
            inputs: ['Active alerts'],
            outputs: ['Human acknowledgment & resolution actions'],
            codeRef: 'src/components/alerts/ActiveAlertsCard.tsx',
          },
        },
      ],
      edges: [
        { id: 'ae1', from: 'events_source', to: 'alert_scheduler', label: 'Event streams & CV alarms' },
        { id: 'ae2', from: 'alert_scheduler', to: 'alerts_db', label: 'Upsert with dedupe_key' },
        { id: 'ae3', from: 'alerts_db', to: 'notification_ui', label: 'Polling & notifications' },
      ],
    },
  },

  digital_twin_spatial: {
    id: 'digital_twin_spatial',
    name: '3D Facility Twin Spatial Intelligence',
    category: 'simulation',
    categoryLabel: 'Spatial Simulation & Digital Twin',
    status: 'partial',
    statusLabel: 'Partial (Conceptual 3D Simulation)',
    role: 'Shop floor spatial safety visualization and hotspot mapping',
    businessObjective:
      'Provides a 3D digital twin of manufacturing plant bays (Stamping, Welding, Assembly, Chemical Storage, Warehouse, Machining) to project event concentrations and vehicle routes into physical 3D space.',
    intelligenceCapability:
      'Spatial coordinate mapping, Three.js 3D rendering, zone risk weighting, animated robot/forklift simulation, and camera view transitions.',
    processingSummary:
      'Plant selection → Queries area hazard counts from fact_ehs_event → Maps counts to 6 3D bounding zones in Three.js scene → Colorizes zones by composite risk severity → Allows interactive camera orbit and zone inspection.',
    outputDestination: '3D Facility Twin View (/monitoring/digital-twin)',
    inputLayer: {
      sourceApplication: 'Three.js 3D Canvas + EHS Area Event Counts',
      database: 'Neon PostgreSQL 18.6',
      schema: 'ehs_core',
      sourceTables: [
        {
          table: 'fact_ehs_event',
          verified: true,
          primaryKey: 'ehs_event_id',
          requiredColumns: ['ehs_event_id', 'plant_id', 'area', 'risk_severity', 'hazard_category'],
          description: 'Provides real area counts mapped onto the 6 simulated zones.',
        },
      ],
      apiEndpoints: [
        {
          method: 'GET',
          endpoint: '/api/v1/events?limit=500',
          purpose: 'Provides area-level hazard counts for zone risk colorization',
          authRequired: false,
        },
      ],
      dataFormat: '3D mesh geometry + JSON area event aggregates',
      ingestionMechanism: 'Client-side WebGL Three.js render pipeline',
      refreshFrequency: 'Render loop at 60 FPS; data refreshed on plant selection',
      validationRequirements: [
        'WebGL 2.0 GPU support in client browser',
        'Strict label: Conceptual 3D shop floor representation',
      ],
      ownership: 'Facilities & Advanced Manufacturing Technology',
    },
    processingLayer: {
      pipelineSteps: [
        {
          stage: '1. Area Aggregation',
          description: 'Aggregates event counts across the 6 physical zones in active plant.',
          componentLocation: 'src/views/DigitalTwinView.tsx',
        },
        {
          stage: '2. Risk Colorization',
          description: 'Calculates zone risk level (Normal, Elevated, High, Critical) and applies shader materials.',
          componentLocation: 'src/components/digital-twin/FactoryDigitalTwinCanvas.tsx',
        },
      ],
      businessRulesAndFormulas: [
        {
          name: 'Zone Risk Calculation',
          formulaOrRule: 'Zone Risk = (Critical Count * 3) + (High Count * 2) + Medium Count',
          context: 'Determines 3D zone mesh color and glow.',
        },
      ],
      errorHandlingAndLogging: ['WebGL context loss caught with HTML fallback card.'],
    },
    presentationLayer: {
      viewsAndRoutes: [
        { viewName: '3D Facility Twin', route: '/monitoring/digital-twin', purpose: 'Interactive 3D model with camera controls and zone details' },
      ],
      kpiMetrics: [
        {
          name: 'Zone Risk Index',
          businessDefinition: 'Composite risk score for active selected plant zone',
          calculation: 'Sum of weighted hazards in zone',
          sourceData: 'ehs_core.fact_ehs_event',
          refreshTrigger: 'Zone selection',
        },
      ],
      chartsAndDisplays: ['Three.js 3D Viewport with OrbitControls', 'Zone Telemetry Drawer'],
      exportCapabilities: ['Camera view reset & perspective lock'],
    },
    intelligenceLayer: {
      analyse: 'Examines spatial clustering of hazards in physical space.',
      detect: 'Detects overlapping spatial hazards near high-traffic material handling aisles.',
      predict: 'Proposed: Spatial heat propagation and evacuation bottleneck modeling.',
      recommend: 'Recommends repositioning physical staging areas away from high-density zones.',
      automate: 'Camera flies to zone upon clicking active hazard alert.',
      modelDetails: {
        name: 'Three.js Spatial Simulation Canvas',
        versionOrFramework: 'Three.js r187 WebGL Renderer',
        inferenceApi: 'Client-side render loop',
      },
      guardrailsAndSafety: {
        humanReviewRequirement: 'Digital twin is a decision support simulation; field walk is required.',
        falsePositiveHandling: 'Clearly labeled as conceptual representation.',
        escalationWorkflow: 'Clicking zone links directly to filtered Hazard Register.',
        auditLogging: 'Client-side telemetry inspection.',
      },
    },
    diagram: {
      nodes: [
        {
          id: 'spatial_events',
          label: 'Area Event Counts',
          sublabel: 'ehs_core.fact_ehs_event',
          tier: 'input',
          status: 'verified',
          details: {
            purpose: 'Provides event volume by plant zone',
            inputs: ['Event rows'],
            outputs: ['Zone counts'],
            techOrTable: 'fact_ehs_event',
          },
        },
        {
          id: 'threejs_engine',
          label: 'Three.js 3D Scene Graph',
          sublabel: 'Factory Floor Simulation',
          tier: 'processing',
          status: 'partial',
          details: {
            purpose: 'Renders 3D bays, equipment meshes, animated bots, and risk heat shaders',
            inputs: ['Zone counts & plant ID'],
            outputs: ['Interactive WebGL viewport'],
            codeRef: 'src/components/digital-twin/FactoryDigitalTwinCanvas.tsx',
          },
        },
        {
          id: 'twin_ui',
          label: '3D Digital Twin View',
          sublabel: 'UI Presentation',
          tier: 'presentation',
          status: 'verified',
          details: {
            purpose: 'Full-screen 3D spatial interface with zone inspector and camera controls',
            inputs: ['3D canvas'],
            outputs: ['Interactive user controls'],
            codeRef: 'src/views/DigitalTwinView.tsx',
          },
        },
      ],
      edges: [
        { id: 'dte1', from: 'spatial_events', to: 'threejs_engine', label: 'Area hazard counts' },
        { id: 'dte2', from: 'threejs_engine', to: 'twin_ui', label: 'Rendered 3D scene' },
      ],
    },
  },
};

export const LIST_OF_ALL_AGENTS = Object.values(AGENT_ARCHITECTURE_REGISTRY);

