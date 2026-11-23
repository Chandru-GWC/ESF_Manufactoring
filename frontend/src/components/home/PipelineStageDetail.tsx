import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Eye,
  Factory,
  FileText,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Video,
  Zap,
} from 'lucide-react';
import { PipelineStageId } from './ArchitecturePipeline';
import { SourceTableDetail } from './SourceTableDetail';

interface PipelineStageDetailProps {
  stage: PipelineStageId;
  tableCounts: { events: number; attendance: number; maintenance: number };
  tableRows: {
    events: Record<string, unknown>[];
    attendance: Record<string, unknown>[];
    maintenance: Record<string, unknown>[];
  };
  isLoading: boolean;
}

export const PipelineStageDetail: React.FC<PipelineStageDetailProps> = ({
  stage,
  tableCounts,
  tableRows,
  isLoading,
}) => {
  // Determine selected table tab if inside Card 1
  const initialTable =
    stage === 'source-attendance'
      ? 'attendance'
      : stage === 'source-maintenance'
      ? 'maintenance'
      : 'events';

  const [selectedTableId, setSelectedTableId] = useState<'events' | 'attendance' | 'maintenance'>(initialTable);

  // Sync selectedTableId when specific table node stage is clicked
  React.useEffect(() => {
    if (stage === 'source-events') setSelectedTableId('events');
    else if (stage === 'source-attendance') setSelectedTableId('attendance');
    else if (stage === 'source-maintenance') setSelectedTableId('maintenance');
  }, [stage]);

  /* =========================================================================
     CARD 1: SOURCE SYSTEM (GROUNDED DATA)
     ========================================================================= */
  if (
    stage === 'source' ||
    stage === 'source-events' ||
    stage === 'source-attendance' ||
    stage === 'source-maintenance'
  ) {
    const isSpecificNode = stage !== 'source';

    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-red-100 text-red-700">
              <Factory className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                1. Source System &amp; Grounded Data Sources
              </h3>
              <p className="text-xs text-ink-muted">
                {isSpecificNode
                  ? stage === 'source-events'
                    ? 'fact_ehs_event: Complete incident logs, hazard observations, and corrective actions'
                    : stage === 'source-attendance'
                    ? 'fact_workforce_attendance: Shift rosters, overtime hours, and worker safety certifications'
                    : 'fact_maintenance_work_order: P1 critical repair jobs, equipment tags, and failure modes'
                  : 'Enterprise multi-site ingestion across 7 manufacturing facilities grounded in Neon PostgreSQL.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-red-300 bg-red-50 text-red-700 uppercase">
            CARD 1 · DATA INGESTION
          </span>
        </div>

        {/* Source Table Selector Tabs */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-ink-secondary">Connected Grounded Tables (Neon PostgreSQL):</span>
            <span className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Verified Live Data
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedTableId('events')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                selectedTableId === 'events'
                  ? 'border-red-600 bg-red-50/80 shadow-sm ring-1 ring-red-400'
                  : 'border-line-subtle bg-canvas-subtle hover:border-line-default'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-primary">fact_ehs_event</span>
                <span className="text-[10px] font-mono font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                  {tableCounts.events.toLocaleString('en-IN')} rows
                </span>
              </div>
              <p className="text-[10px] text-ink-muted truncate mt-0.5">Hazards, near-misses, first aid, audits</p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTableId('attendance')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                selectedTableId === 'attendance'
                  ? 'border-emerald-600 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-400'
                  : 'border-line-subtle bg-canvas-subtle hover:border-line-default'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-primary">fact_workforce_attendance</span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                  {tableCounts.attendance.toLocaleString('en-IN')} rows
                </span>
              </div>
              <p className="text-[10px] text-ink-muted truncate mt-0.5">Shift rosters, hours, training status</p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTableId('maintenance')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                selectedTableId === 'maintenance'
                  ? 'border-sky-600 bg-sky-50/80 shadow-sm ring-1 ring-sky-400'
                  : 'border-line-subtle bg-canvas-subtle hover:border-line-default'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-primary">fact_maintenance_work_order</span>
                <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                  {tableCounts.maintenance.toLocaleString('en-IN')} rows
                </span>
              </div>
              <p className="text-[10px] text-ink-muted truncate mt-0.5">P1 jobs, failure modes, avoided downtime</p>
            </button>
          </div>
        </div>

        {/* Selected Table Live Records Preview */}
        <SourceTableDetail
          id={selectedTableId}
          rowCount={tableCounts[selectedTableId]}
          rows={tableRows[selectedTableId]}
          loading={isLoading}
        />
      </div>
    );
  }

  /* =========================================================================
     CARD 2: FASTAPI GATEWAY (API & ROUTING LAYER)
     ========================================================================= */
  if (stage === 'fastapi' || stage === 'agent-route' || stage === 'detection-route') {
    const isAgentRoute = stage === 'agent-route';
    const isDetectionRoute = stage === 'detection-route';

    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Server className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                2. FastAPI High-Performance Gateway &amp; Routing Layer
              </h3>
              <p className="text-xs text-ink-muted">
                {isAgentRoute
                  ? 'Agent Route: Handles natural language queries, schema grounding, and SQL synthesis'
                  : isDetectionRoute
                  ? 'Detection Route: Ingests video streams, invokes Computer Vision pipelines, and outputs bounding boxes'
                  : 'High-throughput async ASGI gateway orchestrating agent reasoning and computer vision streaming.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-blue-300 bg-blue-50 text-blue-700 uppercase">
            CARD 2 · FASTAPI ENGINE
          </span>
        </div>

        {/* Two Nodes Detail Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Node 1: Agent Calling Route */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isAgentRoute
                ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500/20 shadow-sm'
                : 'border-blue-200 bg-blue-50/40 hover:bg-blue-50/70'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-black text-blue-950">Node 1: Agent Calling Route</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                POST /api/v1/ai/query
              </span>
            </div>
            <p className="text-xs text-blue-900 leading-relaxed mb-2.5">
              Receives natural language safety queries from executives and safety officers. Validates input schema via Pydantic v2, passes context to the DomoGPT Text-to-SQL engine, runs verified read-only queries with transaction rollback against Neon PostgreSQL, and formats grounded replies.
            </p>
            <div className="rounded-lg bg-slate-900 p-2.5 font-mono text-[11px] text-slate-200 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold">// Request Payload</div>
              <div className="text-emerald-400">POST /api/v1/ai/query</div>
              <div className="text-slate-300">
                {`{ "question": "Which corrective actions are overdue by plant?", "context": { "user_role": "safety_lead" } }`}
              </div>
            </div>
          </div>

          {/* Node 2: Detection Calling Route */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isDetectionRoute
                ? 'border-indigo-600 bg-indigo-50/90 ring-2 ring-indigo-500/20 shadow-sm'
                : 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/70'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-indigo-700" />
                <span className="text-xs font-black text-indigo-950">Node 2: Detection Calling Route</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
                POST /api/v1/detection/upload
              </span>
            </div>
            <p className="text-xs text-indigo-900 leading-relaxed mb-2.5">
              Receives surveillance video feeds and uploaded camera clips. Streams chunks to temporary fast storage, invokes the scenario model worker (OpenFall, YOLOv8, OWLv2), generates annotated video files with spatial bounding boxes, and broadcasts real-time hazard alerts to connected clients.
            </p>
            <div className="rounded-lg bg-slate-900 p-2.5 font-mono text-[11px] text-slate-200 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold">// Multipart Ingestion</div>
              <div className="text-indigo-400">POST /api/v1/detection/upload</div>
              <div className="text-slate-300">
                {`form-data: file=[surveillance_cam04.mp4], scenario="fall_detection"`}
              </div>
            </div>
          </div>
        </div>

        {/* Gateway Architecture Spec */}
        <div className="rounded-xl border border-line-subtle bg-canvas-subtle p-3 space-y-2">
          <h4 className="text-xs font-bold text-ink-primary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            FastAPI Technical Architecture Features:
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-canvas-surface border border-line-subtle">
              <span className="block font-bold text-ink-primary">ASGI Coroutine Engine</span>
              <span className="text-[10px] text-ink-muted">Uvicorn non-blocking event loop</span>
            </div>
            <div className="p-2 rounded-lg bg-canvas-surface border border-line-subtle">
              <span className="block font-bold text-ink-primary">Pydantic v2 Schema</span>
              <span className="text-[10px] text-ink-muted">Strict type validation &amp; serialization</span>
            </div>
            <div className="p-2 rounded-lg bg-canvas-surface border border-line-subtle">
              <span className="block font-bold text-ink-primary">Swagger / OpenAPI</span>
              <span className="text-[10px] text-ink-muted">Interactive live documentation at /docs</span>
            </div>
            <div className="p-2 rounded-lg bg-canvas-surface border border-line-subtle">
              <span className="block font-bold text-ink-primary">CORS &amp; Rate Limiting</span>
              <span className="text-[10px] text-ink-muted">Origin whitelisting &amp; pool safety</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
     CARD 3: AI & DETECTION ENGINES (INTELLIGENCE CORE)
     ========================================================================= */
  if (stage === 'engines' || stage === 'agent-engine' || stage === 'detection-engine') {
    const isAgentEngine = stage === 'agent-engine';
    const isDetectionEngine = stage === 'detection-engine';

    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Cpu className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                3. AI &amp; Detection Core Intelligence Engines
              </h3>
              <p className="text-xs text-ink-muted">
                {isAgentEngine
                  ? 'EHS Safety Agent: DomoGPT Text-to-SQL engine with verified schema knowledge and citation grounding'
                  : isDetectionEngine
                  ? 'Safety Detection Node: Computer Vision suite spanning 6 specialized factory safety models'
                  : 'Dual intelligence backbone powering natural language reasoning and computer vision hazard detection.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-purple-300 bg-purple-50 text-purple-700 uppercase">
            CARD 3 · INTELLIGENCE CORE
          </span>
        </div>

        {/* Dual Engines Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Engine 1: DomoGPT Agent Core */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isAgentEngine
                ? 'border-purple-600 bg-purple-50/90 ring-2 ring-purple-500/20 shadow-sm'
                : 'border-purple-200 bg-purple-50/40 hover:bg-purple-50/70'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-700" />
                <span className="text-xs font-black text-purple-950">Engine 1: EHS Safety Agent Core</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-700 text-white">
                DomoGPT Large v2.2
              </span>
            </div>
            <p className="text-xs text-purple-900 leading-relaxed mb-2.5">
              Text-to-SQL agent with complete understanding of the Neon PostgreSQL database schema (`fact_ehs_event`, `fact_workforce_attendance`, `fact_maintenance_work_order`). Employs multi-turn planning, AST security isolation to prevent harmful modifications, and precise record citations.
            </p>
            <div className="space-y-1.5 text-xs text-purple-950 mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
                <span>Zero Hallucinations: All metrics verified by executed SQL</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
                <span>Transparent Citations: Every claim links to live table records</span>
              </div>
            </div>
            <Link
              to="/ehs-agent"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-800 hover:text-purple-950 hover:underline"
            >
              Open EHS Agent Console <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Engine 2: Safety Detection Node */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isDetectionEngine
                ? 'border-fuchsia-600 bg-fuchsia-50/90 ring-2 ring-fuchsia-500/20 shadow-sm'
                : 'border-fuchsia-200 bg-fuchsia-50/40 hover:bg-fuchsia-50/70'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-fuchsia-700" />
                <span className="text-xs font-black text-fuchsia-950">Engine 2: Safety Detection Node</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-fuchsia-700 text-white">
                6 CV MODELS
              </span>
            </div>
            <p className="text-xs text-fuchsia-900 leading-relaxed mb-2.5">
              Automated computer vision pipeline utilizing OpenFall, YOLOv8 object detection, and OWLv2 zero-shot detection. Continuously evaluates camera frames for life-safety hazards, drawing color-coded bounding boxes and generating instant alert telemetry.
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[10.5px] font-semibold text-fuchsia-950 mb-3">
              <span className="bg-white/80 px-2 py-1 rounded border border-fuchsia-200">1. Fall &amp; Posture Detection</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-fuchsia-200">2. Smoke &amp; Fire Monitoring</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-fuchsia-200">3. Exit Obstruction Fencing</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-fuchsia-200">4. Forklift Near Miss Hull</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-fuchsia-200">5. Machine Proximity Zones</span>
              <span className="bg-white/80 px-2 py-1 rounded border border-fuchsia-200">6. Unsafe Height Climbing</span>
            </div>
            <Link
              to="/monitoring"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-fuchsia-800 hover:text-fuchsia-950 hover:underline"
            >
              Open Safety Video Intelligence <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
     CARD 4: CLOSED-LOOP OUTCOMES (INSIGHTS & ACTIONS)
     ========================================================================= */
  const isAgentOutcomes = stage === 'agent-outcomes';
  const isDetectionOutcomes = stage === 'detection-outcomes';

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-red-100 text-red-700">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-ink-primary leading-tight">
              4. Closed-Loop Safety Outcomes &amp; Action Dispatch
            </h3>
            <p className="text-xs text-ink-muted">
              {isAgentOutcomes
                ? 'Agent Outcomes: Verified SQL analytical audits, regulatory compliance reports, and KPI drilldowns'
                : isDetectionOutcomes
                ? 'Detection Outcomes: Annotated surveillance streams, bounding boxes, instant alarms, and ticket creation'
                : 'Zero-blindspot enterprise safety governance linking audited data insights to real-time incident prevention.'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-red-300 bg-red-50 text-red-700 uppercase">
          CARD 4 · CLOSED-LOOP IMPACT
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Node 1: Agent Outcomes */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isAgentOutcomes
              ? 'border-amber-600 bg-amber-50/90 ring-2 ring-amber-500/20 shadow-sm'
              : 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-black text-amber-950">Node 1: Agent Audited Outcomes</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-600 text-white">
              ANALYTICS &amp; AUDITS
            </span>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed mb-3">
            Translates complex safety metrics into clear, actionable executive summaries. Highlights overdue corrective actions, calculates plant-by-plant OSHA TRIR/DART rates, cross-references worker training certifications with shift rosters, and exports audit workbooks.
          </p>
          <div className="space-y-1.5 text-xs text-amber-950 mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Overdue CAPA alerts with owner accountability</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Equipment maintenance risk prioritization</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
              <span>OSHA &amp; ISO compliance gap detection</span>
            </div>
          </div>
          <Link
            to="/overview"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 hover:underline"
          >
            Open Executive Analytics <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Node 2: Detection Outcomes */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isDetectionOutcomes
              ? 'border-rose-600 bg-rose-50/90 ring-2 ring-rose-500/20 shadow-sm'
              : 'border-rose-200 bg-rose-50/40 hover:bg-rose-50/70'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-700" />
              <span className="text-xs font-black text-rose-950">Node 2: Detection Real-Time Outcomes</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-600 text-white">
              EVIDENCE &amp; INTERVENTION
            </span>
          </div>
          <p className="text-xs text-rose-900 leading-relaxed mb-3">
            Delivers visual proof of dangerous conditions. Highlights slip/fall keypoints, fire/smoke bounding boxes, and emergency exit clutter in high-definition video frames. Automatically logs incident records into the database with timestamp and camera ID.
          </p>
          <div className="space-y-1.5 text-xs text-rose-950 mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Annotated bounding-box MP4 video playback</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Instant floor siren and supervisor mobile alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Automated CAPA ticket logging to fact_ehs_event</span>
            </div>
          </div>
          <Link
            to="/monitoring"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 hover:text-rose-950 hover:underline"
          >
            Review Detection Library <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-line-subtle bg-canvas-subtle p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <p className="text-ink-secondary">
          <strong className="text-ink-primary">Closed-Loop Resolution Gate: </strong>
          Safety Officers verify incident mitigations, ensuring no action is closed without sign-off.
        </p>
        <Link
          to="/monitoring"
          className="inline-flex items-center gap-1.5 font-bold text-brand-primary hover:underline"
        >
          View Live Video Monitoring <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
