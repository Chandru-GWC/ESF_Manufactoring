import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  ExternalLink,
  Factory,
  Layers,
  LineChart,
  ShieldCheck,
  Table,
  Users,
  Workflow,
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
  const [selectedTableId, setSelectedTableId] = useState<'events' | 'attendance' | 'maintenance'>('events');

  // Stage 1: SOURCE SYSTEM
  if (stage === 'source' || stage === 'erp-mes' || stage === 'excel-files' || stage === 'apis-etl') {
    const isSpecificCard = stage !== 'source';
    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-red-100 text-red-700">
              <Factory className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                1. Source System &amp; Data Integration
              </h3>
              <p className="text-xs text-ink-muted">
                {isSpecificCard
                  ? stage === 'erp-mes'
                    ? 'ERP & MES Integration: SAP Plant Maintenance, Oracle MES, and real-time telemetry'
                    : stage === 'excel-files'
                    ? 'Files & Audits: Historical OSHA CSV logs, equipment inspection sheets, and offline checklists'
                    : 'APIs & ETL: REST & OData endpoints streaming plant events and shift attendances'
                  : 'Enterprise multi-site data ingestion across 7 manufacturing plants.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-red-300 bg-red-50 text-red-700 uppercase">
            STAGE 1 · DATA INGESTION
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
                  ? 'border-red-600 bg-red-50/70 shadow-sm'
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
                  ? 'border-red-600 bg-red-50/70 shadow-sm'
                  : 'border-line-subtle bg-canvas-subtle hover:border-line-default'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-primary">fact_workforce_attendance</span>
                <span className="text-[10px] font-mono font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
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
                  ? 'border-red-600 bg-red-50/70 shadow-sm'
                  : 'border-line-subtle bg-canvas-subtle hover:border-line-default'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-primary">fact_maintenance_work_order</span>
                <span className="text-[10px] font-mono font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                  {tableCounts.maintenance.toLocaleString('en-IN')} rows
                </span>
              </div>
              <p className="text-[10px] text-ink-muted truncate mt-0.5">P1 jobs, failure modes, avoided downtime</p>
            </button>
          </div>
        </div>

        {/* Selected Table Preview */}
        <SourceTableDetail
          id={selectedTableId}
          rowCount={tableCounts[selectedTableId]}
          rows={tableRows[selectedTableId]}
          loading={isLoading}
        />
      </div>
    );
  }

  // Stage 2: DATA PREPARATION
  if (stage === 'preparation' || stage === 'prepare-load') {
    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Database className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                2. Data Preparation &amp; Automated Pipeline
              </h3>
              <p className="text-xs text-ink-muted">
                Extract, Transform, and Load (ETL) pipeline with strict schema validation and normalization.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-blue-300 bg-blue-50 text-blue-700 uppercase">
            STAGE 2 · ETL / PIPELINE
          </span>
        </div>

        {/* 3 Step ETL Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-teal-200 bg-teal-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-900">1. EXTRACT</span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-teal-200 text-teal-800">CONNECTORS</span>
            </div>
            <p className="text-xs text-teal-800 leading-snug">
              Continuous CDC change stream from manufacturing floor sources: SAP PM, Oracle MES, HR rosters, and CSV logs.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-cyan-200 bg-cyan-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-900">2. TRANSFORM</span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-200 text-cyan-800">PYDANTIC</span>
            </div>
            <p className="text-xs text-cyan-800 leading-snug">
              Automated data hygiene: ISO/OSHA risk categorization, plant code harmonization, timestamp normalization, and severity weighting.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-fuchsia-900">3. LOAD</span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-fuchsia-200 text-fuchsia-800">ACID POOL</span>
            </div>
            <p className="text-xs text-fuchsia-800 leading-snug">
              High-throughput SQLAlchemy batch inserts into the Neon PostgreSQL star schema with complete transaction rollback isolation.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line-subtle bg-canvas-subtle p-3 space-y-2">
          <h4 className="text-xs font-bold text-ink-primary">Supported Automation &amp; Pipeline Frameworks:</h4>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg border border-line-default bg-canvas-surface font-semibold text-ink-primary">
              SQL Server Integration Services (SSIS)
            </span>
            <span className="px-2.5 py-1 rounded-lg border border-line-default bg-canvas-surface font-semibold text-ink-primary">
              Azure Data Factory (ADF)
            </span>
            <span className="px-2.5 py-1 rounded-lg border border-line-default bg-canvas-surface font-semibold text-ink-primary">
              FastAPI Async Normalizer Engine
            </span>
            <span className="px-2.5 py-1 rounded-lg border border-line-default bg-canvas-surface font-semibold text-ink-primary">
              Robotic Process Automation (RPA)
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Stage 3: DATA & BUSINESS LAYER
  if (stage === 'warehouse' || stage === 'cleaned-data' || stage === 'semantic-model' || stage === 'aggregated-data') {
    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Layers className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                3. Data &amp; Business Layer (Single Source of Truth)
              </h3>
              <p className="text-xs text-ink-muted">
                Neon PostgreSQL 16 Enterprise Star Schema with verified ACID compliance and grounded semantic KPIs.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-purple-300 bg-purple-50 text-purple-700 uppercase">
            STAGE 3 · SEMANTIC WAREHOUSE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900">Cleaned &amp; Integrated Data</span>
              <ShieldCheck className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-xs text-purple-800 leading-snug">
              Single Source of Truth: eliminates departmental silos by synchronizing plant safety, shift rosters, and maintenance work orders.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-cyan-200 bg-cyan-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-900">Business / Semantic Model</span>
              <Workflow className="w-4 h-4 text-cyan-600" />
            </div>
            <p className="text-xs text-cyan-800 leading-snug">
              Formally standardized safety KPIs: OSHA TRIR, DART, Lost Time Injury Rate (LTIR), Training Compliance Rate, and Overdue CAPA ratios.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">Aggregated &amp; Optimized</span>
              <Table className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xs text-emerald-800 leading-snug">
              Dimensional facts, indexed lookups (`dim_plant`, `dim_area`), and sub-second summary aggregations over 1,200+ enterprise records.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line-subtle bg-canvas-subtle p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-ink-primary">Star Schema Tables: </span>
            <span className="font-mono text-ink-secondary">ehs_core.fact_ehs_event · fact_workforce_attendance · fact_maintenance_work_order</span>
          </div>
          <span className="font-bold text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Zero Synthetic Mock Data
          </span>
        </div>
      </div>
    );
  }

  // Stage 4: CONSUMPTION
  if (stage === 'consumption' || stage === 'reports-bi') {
    return (
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <BarChart3 className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-ink-primary leading-tight">
                4. Consumption (BI / Reporting / AI Apps)
              </h3>
              <p className="text-xs text-ink-muted">
                Executive dashboards, Power BI / Tableau reporting, and the DomoGPT Natural Language Multi-Agent SQL core.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-blue-300 bg-blue-50 text-blue-700 uppercase">
            STAGE 4 · CONSUMPTION
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
            <span className="text-xs font-bold text-blue-900 block">Reports &amp; Dashboards</span>
            <p className="text-xs text-blue-800 leading-snug">
              Full interactive analytics with KPI cards, monthly trends, severity heatmaps, and action closure breakdowns.
            </p>
            <Link
              to="/overview"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline pt-1"
            >
              Open Overview Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
            <span className="text-xs font-bold text-amber-900 block">DomoGPT Multi-Agent AI</span>
            <p className="text-xs text-amber-800 leading-snug">
              Natural language text-to-SQL agent with schema grounding, self-correction, and grounded citations for every metric.
            </p>
            <Link
              to="/ehs-agent"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 hover:underline pt-1"
            >
              Ask Safety Agent <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
            <span className="text-xs font-bold text-indigo-900 block">Export &amp; Connectors</span>
            <p className="text-xs text-indigo-800 leading-snug">
              Instant PDF reports, formatted Excel workbooks, and direct SQL connectivity for Power BI &amp; Tableau.
            </p>
            <Link
              to="/connectors"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:underline pt-1"
            >
              Explore Connectors <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Stage 5: BUSINESS OUTCOME
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-red-100 text-red-700">
            <Users className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-ink-primary leading-tight">
              5. Business Outcome (Insights &amp; Closed-Loop Actions)
            </h3>
            <p className="text-xs text-ink-muted">
              Data-driven decisions, automated alert dispatch, and measurable operational impact across all facilities.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-red-300 bg-red-50 text-red-700 uppercase">
          STAGE 5 · BUSINESS OUTCOME
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">Data-Driven Decisions</span>
            <LineChart className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xs text-amber-800 leading-snug">
            Real-time &amp; historical incident trend prioritization enables Plant Managers to target hazard containment before injury occurs.
          </p>
        </div>

        <div className="p-3 rounded-xl border border-lime-200 bg-lime-50/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-lime-900">Alerts &amp; Early Actions</span>
            <Zap className="w-4 h-4 text-lime-600" />
          </div>
          <p className="text-xs text-lime-800 leading-snug">
            Automated alerts for overdue CAPAs, expiring worker qualifications, and live Computer Vision triggers (falls, fire, blocked exits).
          </p>
        </div>

        <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-900">Operational &amp; Business Impact</span>
            <CheckCircle2 className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-xs text-sky-800 leading-snug">
            Zero lost-time injuries, 100% regulatory compliance, and maximized production uptime through predictive maintenance.
          </p>
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
