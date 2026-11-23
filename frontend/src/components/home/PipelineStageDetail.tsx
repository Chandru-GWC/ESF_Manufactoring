import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  Factory,
  FileText,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Video,
  Wrench,
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
  /* =========================================================================
     CARD 1: SOURCE SYSTEM (GROUNDED DATA)
     ========================================================================= */

  // 1A. User clicked the CARD 1 HEADER ("1. SOURCE SYSTEM")
  if (stage === 'source') {
    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-red-100 text-red-700">
              <Factory className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                1. Source System &amp; Data Ingestion Architecture
              </h3>
              <p className="text-xs text-ink-muted">
                Enterprise multi-site data ingestion across 7 manufacturing facilities grounded in Neon PostgreSQL.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-red-300 bg-red-50 text-red-700 uppercase">
            CARD 1 · DATA INGESTION
          </span>
        </div>

        {/* Card Purpose & Explanation */}
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/50 space-y-2">
          <h4 className="text-xs font-bold text-red-950 uppercase tracking-wide">
            What is the Source System?
          </h4>
          <p className="text-xs text-red-900 leading-relaxed">
            The Source System represents the enterprise data ingestion foundation of the EHS platform. It continuously aggregates shop-floor telemetry, OSHA safety logs, shift rosters, and maintenance work orders from legacy systems (SAP Plant Maintenance, Oracle MES, HR databases, and offline inspection logs) into three strictly normalized Neon PostgreSQL tables.
          </p>
        </div>

        {/* 3 Source Tables Breakdown (Informational Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-line-subtle bg-canvas-subtle space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-primary flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                fact_ehs_event
              </span>
              <span className="text-[10px] font-mono font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                {tableCounts.events.toLocaleString('en-IN')} rows
              </span>
            </div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Logs near-misses, injuries, hazard observations, and corrective actions with risk severities and due dates.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-line-subtle bg-canvas-subtle space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-primary flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-600" />
                fact_workforce_attendance
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                {tableCounts.attendance.toLocaleString('en-IN')} rows
              </span>
            </div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Captures worker shift attendance, overtime hours, and mandatory safety certifications across all plant lines.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-line-subtle bg-canvas-subtle space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-primary flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-sky-600" />
                fact_maintenance_work_order
              </span>
              <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                {tableCounts.maintenance.toLocaleString('en-IN')} rows
              </span>
            </div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Tracks machine maintenance work orders, P1 priority repairs, failure modes, and avoided downtime hours.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line-subtle bg-canvas-subtle p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-ink-secondary">
            Tip: Click any of the 3 table nodes in Card 1 above to inspect its live records, column schema, and data fields.
          </span>
          <span className="text-[11px] text-green-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Grounded in Neon PostgreSQL
          </span>
        </div>
      </div>
    );
  }

  // 1B. User clicked a SPECIFIC TABLE NODE in Card 1
  if (
    stage === 'source-events' ||
    stage === 'source-attendance' ||
    stage === 'source-maintenance'
  ) {
    const tableId: 'events' | 'attendance' | 'maintenance' =
      stage === 'source-events'
        ? 'events'
        : stage === 'source-attendance'
        ? 'attendance'
        : 'maintenance';

    const tableTitle =
      tableId === 'events'
        ? 'fact_ehs_event'
        : tableId === 'attendance'
        ? 'fact_workforce_attendance'
        : 'fact_maintenance_work_order';

    const tableDesc =
      tableId === 'events'
        ? 'Incident reports, hazard observations, risk levels (LOW to CRITICAL), and action statuses.'
        : tableId === 'attendance'
        ? 'Daily shift attendance, overtime records, training qualifications, and roster assignments.'
        : 'Equipment maintenance work orders, machine asset IDs, failure modes, and avoided downtime.';

    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-red-100 text-red-700">
              <Database className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-ink-primary leading-tight font-mono">
                  {tableTitle}
                </h3>
                <span className="text-[10px] font-mono font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                  {tableCounts[tableId].toLocaleString('en-IN')} rows
                </span>
              </div>
              <p className="text-xs text-ink-muted">{tableDesc}</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-red-300 bg-red-50 text-red-700 uppercase">
            GROUNDED TABLE NODE
          </span>
        </div>

        {/* Live records table preview for this specific node */}
        <SourceTableDetail
          id={tableId}
          rowCount={tableCounts[tableId]}
          rows={tableRows[tableId]}
          loading={isLoading}
        />
      </div>
    );
  }

  /* =========================================================================
     CARD 2: FASTAPI GATEWAY (API & ROUTING LAYER)
     ========================================================================= */

  // 2A. User clicked CARD 2 HEADER ("2. FASTAPI GATEWAY")
  if (stage === 'fastapi') {
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
                Async ASGI gateway dispatching natural language analytical queries and live computer vision streams.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-blue-300 bg-blue-50 text-blue-700 uppercase">
            CARD 2 · FASTAPI ENGINE
          </span>
        </div>

        {/* Card Purpose & Explanation */}
        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
          <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide">
            What is the FastAPI Gateway?
          </h4>
          <p className="text-xs text-blue-900 leading-relaxed">
            The FastAPI Gateway acts as the central API router and ingestion orchestrator for the entire application. Powered by Uvicorn and an asynchronous non-blocking event loop, it routes incoming frontend client requests into two specialized pipelines: the Natural Language Text-to-SQL Agent route and the Computer Vision video detection upload route.
          </p>
        </div>

        {/* Gateway Architecture Features */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-canvas-subtle border border-line-subtle space-y-1">
            <span className="block font-bold text-ink-primary">ASGI Event Loop</span>
            <span className="text-[10px] text-ink-muted">Non-blocking high-throughput concurrency</span>
          </div>
          <div className="p-3 rounded-xl bg-canvas-subtle border border-line-subtle space-y-1">
            <span className="block font-bold text-ink-primary">Pydantic v2 Schema</span>
            <span className="text-[10px] text-ink-muted">Strict compile-time type validation</span>
          </div>
          <div className="p-3 rounded-xl bg-canvas-subtle border border-line-subtle space-y-1">
            <span className="block font-bold text-ink-primary">Swagger / OpenAPI</span>
            <span className="text-[10px] text-ink-muted">Interactive live docs available at /docs</span>
          </div>
          <div className="p-3 rounded-xl bg-canvas-subtle border border-line-subtle space-y-1">
            <span className="block font-bold text-ink-primary">CORS &amp; Rate Limiter</span>
            <span className="text-[10px] text-ink-muted">Secure cross-origin dispatch &amp; pooling</span>
          </div>
        </div>

        <div className="rounded-xl border border-line-subtle bg-canvas-subtle p-3 text-xs text-ink-secondary">
          Tip: Click either the <strong>Agent Calling Route</strong> node or the <strong>Detection Calling Route</strong> node above to inspect its exact API payload, endpoint path, and response schemas.
        </div>
      </div>
    );
  }

  // 2B. User clicked NODE 1 in Card 2 ("Agent Calling Route")
  if (stage === 'agent-route') {
    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Terminal className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                  Agent Calling Route
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                  POST /api/v1/ai/query
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Accepts user questions in plain text, validates intent, and dispatches to DomoGPT Agent.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-blue-300 bg-blue-50 text-blue-700 uppercase">
            ROUTE NODE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
            <h4 className="text-xs font-bold text-blue-950 uppercase">Route Pipeline Flow</h4>
            <ol className="text-xs text-blue-900 space-y-1.5 list-decimal list-inside">
              <li>Receives user prompt and role context from client.</li>
              <li>Pydantic validates payload against `AgentQueryRequest`.</li>
              <li>Calls DomoGPT Text-to-SQL Multi-Agent Core.</li>
              <li>Executes synthesized SQL with transaction rollback.</li>
              <li>Returns natural language answer with record citations.</li>
            </ol>
          </div>

          <div className="rounded-xl bg-slate-900 p-3 font-mono text-[11px] text-slate-200 space-y-1.5">
            <div className="text-slate-400 text-[10px] uppercase font-bold">// Sample Request Payload</div>
            <div className="text-emerald-400">POST /api/v1/ai/query</div>
            <pre className="text-slate-300 whitespace-pre-wrap">
{`{
  "question": "Which actions are overdue?",
  "context": { "plant_id": "P01" }
}`}
            </pre>
            <div className="text-slate-400 text-[10px] uppercase font-bold pt-1">// Response Contract</div>
            <pre className="text-sky-300 whitespace-pre-wrap">
{`{
  "answer": "There are 257 overdue actions...",
  "sql_query": "SELECT * FROM fact_ehs_event...",
  "citations": ["fact_ehs_event"]
}`}
            </pre>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            to="/ehs-agent"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline"
          >
            Test this route in EHS Agent Console <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // 2C. User clicked NODE 2 in Card 2 ("Detection Calling Route")
  if (stage === 'detection-route') {
    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <Video className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                  Detection Calling Route
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
                  POST /api/v1/detection/upload
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Streams video files, invokes computer vision models, and outputs annotated bounding-box footage.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-indigo-300 bg-indigo-50 text-indigo-700 uppercase">
            ROUTE NODE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
            <h4 className="text-xs font-bold text-indigo-950 uppercase">Video Ingestion Pipeline</h4>
            <ol className="text-xs text-indigo-900 space-y-1.5 list-decimal list-inside">
              <li>Ingests multipart video file upload (MP4/WebM).</li>
              <li>Dispatches to selected CV scenario model (Fall, Fire, Exit, Forklift, Machinery, Height).</li>
              <li>Draws spatial bounding boxes and pose keypoints.</li>
              <li>Generates web-compatible H.264 annotated video.</li>
              <li>Broadcasts real-time safety alert to supervisor terminals.</li>
            </ol>
          </div>

          <div className="rounded-xl bg-slate-900 p-3 font-mono text-[11px] text-slate-200 space-y-1.5">
            <div className="text-slate-400 text-[10px] uppercase font-bold">// Multipart Upload Format</div>
            <div className="text-indigo-400">POST /api/v1/detection/upload</div>
            <pre className="text-slate-300 whitespace-pre-wrap">
{`Content-Type: multipart/form-data
  file: cam04_loading_bay.mp4
  scenario: "fall_detection"`}
            </pre>
            <div className="text-slate-400 text-[10px] uppercase font-bold pt-1">// Output Payload</div>
            <pre className="text-indigo-300 whitespace-pre-wrap">
{`{
  "job_id": "job_01h8q...",
  "annotated_video_url": "/api/v1/detection/video/...",
  "detections_count": 3,
  "incident_created": true
}`}
            </pre>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            to="/monitoring"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:underline"
          >
            Test this route in Safety Video Intelligence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  /* =========================================================================
     CARD 3: AI & DETECTION ENGINES (INTELLIGENCE CORE)
     ========================================================================= */

  // 3A. User clicked CARD 3 HEADER ("3. AI & DETECTION ENGINES")
  if (stage === 'engines') {
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
                Dual intelligence core powering text-to-SQL analytics and edge computer vision inference.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-purple-300 bg-purple-50 text-purple-700 uppercase">
            CARD 3 · INTELLIGENCE CORE
          </span>
        </div>

        {/* Card Purpose & Explanation */}
        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2">
          <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wide">
            What are the Core Engines?
          </h4>
          <p className="text-xs text-purple-900 leading-relaxed">
            Card 3 contains the analytical brains of the system. Rather than relying on simple rule thresholds, it pairs an LLM-powered natural language reasoning agent (DomoGPT) with an automated Computer Vision processing cluster. Together, they provide both retroactive business audit capabilities and prospective live hazard intervention.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-line-subtle bg-canvas-subtle space-y-1.5">
            <span className="text-xs font-bold text-ink-primary flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Engine 1: DomoGPT Text-to-SQL Core
            </span>
            <p className="text-xs text-ink-muted leading-relaxed">
              Synthesizes ANSI SQL queries from conversational prompts. Grounded with complete schema metadata and AST security parsing to prevent unauthorized data manipulation.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-line-subtle bg-canvas-subtle space-y-1.5">
            <span className="text-xs font-bold text-ink-primary flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-fuchsia-600" />
              Engine 2: Safety Detection Computer Vision Suite
            </span>
            <p className="text-xs text-ink-muted leading-relaxed">
              Cluster of 6 specialized computer vision models evaluating live CCTV camera frames for falls, smoke/fire, blocked exits, forklift near-misses, and machine danger zones.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line-subtle bg-canvas-subtle p-3 text-xs text-ink-secondary">
          Tip: Click either the <strong>EHS Agent Node</strong> or the <strong>Detection Node</strong> above to inspect its deep neural architecture and model specifications.
        </div>
      </div>
    );
  }

  // 3B. User clicked NODE 1 in Card 3 ("EHS Agent Node")
  if (stage === 'agent-engine') {
    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                  EHS Agent Node (DomoGPT Large v2.2)
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-700 text-white">
                  TEXT-TO-SQL
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Enterprise AI agent with verified database schema grounding and zero hallucination guarantee.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-purple-300 bg-purple-50 text-purple-700 uppercase">
            AGENT NODE
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2">
          <h4 className="text-xs font-bold text-purple-950 uppercase">Agent Architecture &amp; Security Isolation</h4>
          <p className="text-xs text-purple-900 leading-relaxed">
            The EHS Safety Agent operates on a multi-turn reasoning loop. It introspects the table catalogs of `fact_ehs_event`, `fact_workforce_attendance`, and `fact_maintenance_work_order`, verifies semantic foreign keys, generates optimized PostgreSQL statements, and executes in read-only sandbox mode with automatic transaction rollback.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-purple-950 font-semibold">
            <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-lg border border-purple-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
              <span>Zero Hallucinations</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-lg border border-purple-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
              <span>Read-Only SQL Safety</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/80 p-2 rounded-lg border border-purple-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
              <span>Table Citations Grounding</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            to="/ehs-agent"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-800 hover:text-purple-950 hover:underline"
          >
            Launch EHS Agent Console <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // 3C. User clicked NODE 2 in Card 3 ("Detection Node")
  if (stage === 'detection-engine') {
    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-fuchsia-100 text-fuchsia-700">
              <Eye className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                  Safety Detection Node
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-fuchsia-700 text-white">
                  6 CV MODELS
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Computer vision models detecting critical physical hazards across plant floor cameras.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 uppercase">
            DETECTION NODE
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 space-y-1">
            <span className="block text-xs font-bold text-fuchsia-950">1. Fall &amp; Posture</span>
            <span className="block text-[10px] font-mono text-fuchsia-700">OpenFall + MediaPipe Pose</span>
            <span className="block text-[10.5px] text-fuchsia-900">33-keypoint body balance analysis</span>
          </div>
          <div className="p-2.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 space-y-1">
            <span className="block text-xs font-bold text-fuchsia-950">2. Smoke &amp; Fire</span>
            <span className="block text-[10px] font-mono text-fuchsia-700">YOLOv8-Fire + Volumetric</span>
            <span className="block text-[10.5px] text-fuchsia-900">Plume and open flame detection</span>
          </div>
          <div className="p-2.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 space-y-1">
            <span className="block text-xs font-bold text-fuchsia-950">3. Exit Obstruction</span>
            <span className="block text-[10px] font-mono text-fuchsia-700">OWLv2 Zero-Shot Fencing</span>
            <span className="block text-[10.5px] text-fuchsia-900">Corridor stay-clear boundary</span>
          </div>
          <div className="p-2.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 space-y-1">
            <span className="block text-xs font-bold text-fuchsia-950">4. Forklift Near Miss</span>
            <span className="block text-[10px] font-mono text-fuchsia-700">YOLOv8 + ByteTrack Hull</span>
            <span className="block text-[10.5px] text-fuchsia-900">&lt;2.5m proximity vector alerts</span>
          </div>
          <div className="p-2.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 space-y-1">
            <span className="block text-xs font-bold text-fuchsia-950">5. Machine Proximity</span>
            <span className="block text-[10px] font-mono text-fuchsia-700">Danger Zone Keypoint Rays</span>
            <span className="block text-[10.5px] text-fuchsia-900">Pinch point optical fences</span>
          </div>
          <div className="p-2.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 space-y-1">
            <span className="block text-xs font-bold text-fuchsia-950">6. Unsafe Climbing</span>
            <span className="block text-[10px] font-mono text-fuchsia-700">Elevation + Harness Classifier</span>
            <span className="block text-[10.5px] text-fuchsia-900">Height safety tethering checks</span>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            to="/monitoring"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-fuchsia-800 hover:text-fuchsia-950 hover:underline"
          >
            Open Safety Video Intelligence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  /* =========================================================================
     CARD 4: CLOSED-LOOP OUTCOMES (INSIGHTS & ACTIONS)
     ========================================================================= */

  // 4A. User clicked CARD 4 HEADER ("4. CLOSED-LOOP OUTCOMES")
  if (stage === 'outcomes') {
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
                Enterprise governance linking audited analytical insights to real-time incident prevention.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-red-300 bg-red-50 text-red-700 uppercase">
            CARD 4 · CLOSED-LOOP IMPACT
          </span>
        </div>

        {/* Card Purpose & Explanation */}
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/50 space-y-2">
          <h4 className="text-xs font-bold text-red-950 uppercase tracking-wide">
            What are Closed-Loop Outcomes?
          </h4>
          <p className="text-xs text-red-900 leading-relaxed">
            Closed-loop outcomes represent the tangible business impact of the safety platform. Detections from computer vision models do not end at an alert—they automatically log structured incident tickets in `fact_ehs_event`, trigger plant supervisor dispatch, and update executive KPIs. Concurrently, the EHS agent tracks corrective action closures to prevent recurring hazards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-line-subtle bg-canvas-subtle space-y-1.5">
            <span className="text-xs font-bold text-ink-primary flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-600" />
              Outcome 1: Agent Audits &amp; Compliance Reporting
            </span>
            <p className="text-xs text-ink-muted leading-relaxed">
              Automates OSHA TRIR and DART calculation, alerts leaders to overdue corrective actions, and verifies training qualifications against shift rosters.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-line-subtle bg-canvas-subtle space-y-1.5">
            <span className="text-xs font-bold text-ink-primary flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-rose-600" />
              Outcome 2: Real-Time Detection Evidence &amp; Siren Dispatch
            </span>
            <p className="text-xs text-ink-muted leading-relaxed">
              Provides timestamped bounding-box video clips, triggers on-floor audio alarms, and dispatches immediate notification to plant safety marshals.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line-subtle bg-canvas-subtle p-3 text-xs text-ink-secondary">
          Tip: Click either the <strong>Agent Outcomes</strong> node or the <strong>Detection Outcomes</strong> node above to inspect its audit workflows and video playback evidence.
        </div>
      </div>
    );
  }

  // 4B. User clicked NODE 1 in Card 4 ("Agent Outcomes")
  if (stage === 'agent-outcomes') {
    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <FileText className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                  Agent Outcomes (Audited Analytics &amp; Citations)
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-600 text-white">
                  AUDITED INSIGHTS
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Executive reports, overdue corrective action escalations, and automated OSHA compliance logs.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-700 uppercase">
            OUTCOME NODE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1.5">
            <span className="text-xs font-bold text-amber-950 block">Overdue Action Tracking</span>
            <p className="text-xs text-amber-900 leading-snug">
              Flags open hazards past their deadline, identifies responsible plant leads, and schedules automated escalation.
            </p>
          </div>
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1.5">
            <span className="text-xs font-bold text-amber-950 block">OSHA / ISO Standards</span>
            <p className="text-xs text-amber-900 leading-snug">
              Calculates Total Recordable Incident Rate (TRIR) and DART with transparent data lineage back to database rows.
            </p>
          </div>
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1.5">
            <span className="text-xs font-bold text-amber-950 block">Exportable Audits</span>
            <p className="text-xs text-amber-900 leading-snug">
              Generates formatted Excel workbooks and executive PDF safety briefings for plant safety committees.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            to="/overview"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 hover:underline"
          >
            Open Executive Analytics Dashboard <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // 4C. User clicked NODE 2 in Card 4 ("Detection Outcomes")
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
            <Zap className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                Detection Outcomes (Real-Time Video Evidence &amp; Alerts)
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-600 text-white">
                VISUAL EVIDENCE
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Annotated video recordings, timestamped bounding box frames, and immediate incident alerting.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-rose-300 bg-rose-50 text-rose-700 uppercase">
          OUTCOME NODE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1.5">
          <span className="text-xs font-bold text-rose-950 block">Annotated MP4 Playback</span>
          <p className="text-xs text-rose-900 leading-snug">
            Streamable video showing precise colored bounding boxes, pose skeleton keypoints, and timestamp overlays.
          </p>
        </div>
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1.5">
          <span className="text-xs font-bold text-rose-950 block">Instant Siren &amp; Alarms</span>
          <p className="text-xs text-rose-900 leading-snug">
            Triggers audible warning sirens and transmits real-time push alerts to floor safety marshals.
          </p>
        </div>
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1.5">
          <span className="text-xs font-bold text-rose-950 block">Auto-Logged CAPA Tickets</span>
          <p className="text-xs text-rose-900 leading-snug">
            Automatically writes a new hazard record into `fact_ehs_event` with camera ID, coordinates, and pending sign-off.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          to="/monitoring"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 hover:text-rose-950 hover:underline"
        >
          Review Video Library &amp; Detections <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
