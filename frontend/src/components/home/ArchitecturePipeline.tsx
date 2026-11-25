import React from 'react';
import { ArrowRight, BrainCircuit, Database, Factory, Server, Target, Eye, FileText, ShieldAlert, Sparkles, Terminal, Video, Wrench, Zap } from 'lucide-react';

export type PipelineStageId =
  // Card 1: Source System & Grounded Tables
  | 'source'
  | 'source-events'
  | 'source-attendance'
  | 'source-maintenance'
  // Card 2: FastAPI Gateway
  | 'fastapi'
  | 'agent-route'
  | 'detection-route'
  // Card 3: AI & Detection Core Engines
  | 'engines'
  | 'agent-engine'
  | 'detection-engine'
  // Card 4: Closed-Loop Outcomes
  | 'outcomes'
  | 'agent-outcomes'
  | 'detection-outcomes';

interface ArchitecturePipelineProps {
  activeStage: PipelineStageId;
  onSelectStage: (stage: PipelineStageId) => void;
}

/* ===========================================================================
   High-Fidelity Header Icons
   =========================================================================== */

const HeaderBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="w-9 h-9 shrink-0 rounded-lg bg-white/20 ring-1 ring-white/30 flex items-center justify-center text-white">
    {children}
  </span>
);

/* ===========================================================================
   4-Card Architecture Pipeline Layout
   =========================================================================== */

export const ArchitecturePipeline: React.FC<ArchitecturePipelineProps> = ({ activeStage, onSelectStage }) => {
  const isCard1Active =
    activeStage === 'source' ||
    activeStage === 'source-events' ||
    activeStage === 'source-attendance' ||
    activeStage === 'source-maintenance';

  const isCard2Active =
    activeStage === 'fastapi' ||
    activeStage === 'agent-route' ||
    activeStage === 'detection-route';

  const isCard3Active =
    activeStage === 'engines' ||
    activeStage === 'agent-engine' ||
    activeStage === 'detection-engine';

  const isCard4Active =
    activeStage === 'outcomes' ||
    activeStage === 'agent-outcomes' ||
    activeStage === 'detection-outcomes';

  return (
    <div className="w-full">
      {/* 4-Column Grid with perfectly aligned straight headers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch relative">

        {/* -------------------------------------------------------------------------
            CARD 1: 1. SOURCE SYSTEM (GROUNDED DATA)
            ------------------------------------------------------------------------- */}
        <div className="relative flex flex-col h-full">
          <div
            className={`group flex flex-col flex-1 h-full rounded-2xl border-2 overflow-hidden transition-all duration-200 bg-white shadow-sm ${
              isCard1Active
                ? 'border-red-600 ring-2 ring-red-500/20 shadow-md'
                : 'border-red-200 hover:border-red-400'
            }`}
          >
            {/* Header Banner - Fixed Height h-[76px] for perfectly straight alignment */}
            <button
              type="button"
              onClick={() => onSelectStage('source')}
              className="w-full h-[76px] min-h-[76px] max-h-[76px] bg-gradient-to-r from-[#991b1b] to-[#b91c1c] text-white px-3 flex items-center gap-2.5 text-left focus:outline-none transition-colors hover:brightness-105"
            >
              <HeaderBadge><Factory className="w-5 h-5" /></HeaderBadge>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <h3 className="text-xs font-black uppercase tracking-wider text-white leading-tight truncate">
                  1. SOURCE SYSTEM
                </h3>
                <p className="text-[10px] text-white/85 font-medium tracking-wide truncate">
                  (GROUNDED DATA)
                </p>
              </div>
            </button>

            {/* Inner Nodes: 3 Grounded Tables */}
            <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-start bg-slate-50/40">
              {/* Node 1: fact_ehs_event */}
              <button
                type="button"
                onClick={() => onSelectStage('source-events')}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'source-events'
                    ? 'border-red-500 bg-red-100/90 shadow-sm ring-1 ring-red-400'
                    : 'border-red-200 bg-red-50/70 hover:bg-red-100/60'
                }`}
              >
                <div className="w-7 h-7 shrink-0 rounded-md bg-red-600 flex items-center justify-center text-white shadow-sm">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                    fact_ehs_event
                  </span>
                  <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                    (400 events · Hazards &amp; Actions)
                  </span>
                </div>
              </button>

              {/* Node 2: fact_workforce_attendance */}
              <button
                type="button"
                onClick={() => onSelectStage('source-attendance')}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'source-attendance'
                    ? 'border-emerald-500 bg-emerald-100/90 shadow-sm ring-1 ring-emerald-400'
                    : 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/60'
                }`}
              >
                <div className="w-7 h-7 shrink-0 rounded-md bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                  <Database className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                    fact_workforce_attendance
                  </span>
                  <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                    (500 shifts · Rosters &amp; Training)
                  </span>
                </div>
              </button>

              {/* Node 3: fact_maintenance_work_order */}
              <button
                type="button"
                onClick={() => onSelectStage('source-maintenance')}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'source-maintenance'
                    ? 'border-sky-500 bg-sky-100/90 shadow-sm ring-1 ring-sky-400'
                    : 'border-sky-200 bg-sky-50/70 hover:bg-sky-100/60'
                }`}
              >
                <div className="w-7 h-7 shrink-0 rounded-md bg-sky-600 flex items-center justify-center text-white shadow-sm">
                  <Wrench className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                    fact_maintenance_work_order
                  </span>
                  <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                    (300 orders · P1 &amp; Equipment)
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Inter-column connector arrow */}
          <div className="hidden lg:flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400">
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        {/* -------------------------------------------------------------------------
            CARD 2: 2. FASTAPI GATEWAY (ROUTING LAYER) - EXACT 2 NODES
            ------------------------------------------------------------------------- */}
        <div className="relative flex flex-col h-full">
          <div
            className={`group flex flex-col flex-1 h-full rounded-2xl border-2 overflow-hidden transition-all duration-200 bg-white shadow-sm ${
              isCard2Active
                ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                : 'border-blue-200 hover:border-blue-400'
            }`}
          >
            {/* Header Banner - Fixed Height h-[76px] */}
            <button
              type="button"
              onClick={() => onSelectStage('fastapi')}
              className="w-full h-[76px] min-h-[76px] max-h-[76px] bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] text-white px-3 flex items-center gap-2.5 text-left focus:outline-none transition-colors hover:brightness-105"
            >
              <HeaderBadge><Server className="w-5 h-5" /></HeaderBadge>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <h3 className="text-xs font-black uppercase tracking-wider text-white leading-tight truncate">
                  2. FASTAPI GATEWAY
                </h3>
                <p className="text-[10px] text-white/85 font-medium tracking-wide truncate">
                  (API &amp; ROUTING LAYER)
                </p>
              </div>
            </button>

            {/* Inner Nodes: Exactly 2 Nodes as requested */}
            <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-start bg-slate-50/40">
              {/* Node 1: Agent Calling Route */}
              <button
                type="button"
                onClick={() => onSelectStage('agent-route')}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'agent-route'
                    ? 'border-blue-600 bg-blue-100/90 shadow-sm ring-1 ring-blue-500'
                    : 'border-blue-200 bg-blue-50/70 hover:bg-blue-100/60'
                }`}
              >
                <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="block text-xs font-black text-slate-800 leading-snug truncate">
                      Agent Calling Route
                    </span>
                  </div>
                  <span className="block text-[9.5px] text-slate-500 truncate">
                    Natural language NLQ ➔ SQL dispatch
                  </span>
                </div>
              </button>

              {/* Node 2: Detection Calling Route */}
              <button
                type="button"
                onClick={() => onSelectStage('detection-route')}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'detection-route'
                    ? 'border-indigo-600 bg-indigo-100/90 shadow-sm ring-1 ring-indigo-500'
                    : 'border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/60'
                }`}
              >
                <div className="w-8 h-8 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Video className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="block text-xs font-black text-slate-800 leading-snug truncate">
                      Detection Calling Route
                    </span>
                  </div>
                  <span className="block text-[9.5px] text-slate-500 truncate">
                    Video streaming &amp; CV model dispatch
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Inter-column connector arrow */}
          <div className="hidden lg:flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400">
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        {/* -------------------------------------------------------------------------
            CARD 3: 3. AI & DETECTION ENGINES (INTELLIGENCE CORE) - EXACT 2 NODES
            ------------------------------------------------------------------------- */}
        <div className="relative flex flex-col h-full">
          <div
            className={`group flex flex-col flex-1 h-full rounded-2xl border-2 overflow-hidden transition-all duration-200 bg-white shadow-sm ${
              isCard3Active
                ? 'border-purple-600 ring-2 ring-purple-500/20 shadow-md'
                : 'border-purple-200 hover:border-purple-400'
            }`}
          >
            {/* Header Banner - Fixed Height h-[76px] */}
            <button
              type="button"
              onClick={() => onSelectStage('engines')}
              className="w-full h-[76px] min-h-[76px] max-h-[76px] bg-gradient-to-r from-[#581c87] to-[#7e22ce] text-white px-3 flex items-center gap-2.5 text-left focus:outline-none transition-colors hover:brightness-105"
            >
              <HeaderBadge><BrainCircuit className="w-5 h-5" /></HeaderBadge>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <h3 className="text-xs font-black uppercase tracking-wider text-white leading-tight truncate">
                  3. AI &amp; DETECTION ENGINES
                </h3>
                <p className="text-[10px] text-white/85 font-medium tracking-wide truncate">
                  (INTELLIGENCE CORE)
                </p>
              </div>
            </button>

            {/* Inner Nodes: Exactly 2 Nodes as requested */}
            <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-start bg-slate-50/40">
              {/* Node 1: Agent Node */}
              <button
                type="button"
                onClick={() => onSelectStage('agent-engine')}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'agent-engine'
                    ? 'border-purple-600 bg-purple-100/90 shadow-sm ring-1 ring-purple-500'
                    : 'border-purple-200 bg-purple-50/70 hover:bg-purple-100/60'
                }`}
              >
                <div className="w-8 h-8 shrink-0 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="block text-xs font-black text-slate-800 leading-snug truncate">
                      EHS Agent Node
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-200 text-purple-800 shrink-0">
                      TEXT-TO-SQL
                    </span>
                  </div>
                  <span className="block text-[10px] text-purple-800 font-semibold truncate mt-0.5">
                    DomoGPT Large v2.2 Core
                  </span>
                  <span className="block text-[9.5px] text-slate-500 truncate">
                    Schema grounding &amp; citations
                  </span>
                </div>
              </button>

              {/* Node 2: Detection Node */}
              <button
                type="button"
                onClick={() => onSelectStage('detection-engine')}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'detection-engine'
                    ? 'border-fuchsia-600 bg-fuchsia-100/90 shadow-sm ring-1 ring-fuchsia-500'
                    : 'border-fuchsia-200 bg-fuchsia-50/70 hover:bg-fuchsia-100/60'
                }`}
              >
                <div className="w-8 h-8 shrink-0 rounded-lg bg-fuchsia-600 text-white flex items-center justify-center shadow-sm">
                  <Eye className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="block text-xs font-black text-slate-800 leading-snug truncate">
                      Detection Node
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-fuchsia-200 text-fuchsia-800 shrink-0">
                      CV MODELS
                    </span>
                  </div>
                  <span className="block text-[10px] text-fuchsia-800 font-semibold truncate mt-0.5">
                    OpenFall · YOLOv8 · OWLv2
                  </span>
                  <span className="block text-[9.5px] text-slate-500 truncate">
                    6 Hazard Computer Vision models
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Inter-column connector arrow */}
          <div className="hidden lg:flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400">
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        {/* -------------------------------------------------------------------------
            CARD 4: 4. CLOSED-LOOP OUTCOMES (INSIGHTS & ACTIONS) - EXACT 2 NODES
            ------------------------------------------------------------------------- */}
        <div className="relative flex flex-col h-full">
          <div
            className={`group flex flex-col flex-1 h-full rounded-2xl border-2 overflow-hidden transition-all duration-200 bg-white shadow-sm ${
              isCard4Active
                ? 'border-red-600 ring-2 ring-red-500/20 shadow-md'
                : 'border-red-200 hover:border-red-400'
            }`}
          >
            {/* Header Banner - Fixed Height h-[76px] */}
            <button
              type="button"
              onClick={() => onSelectStage('outcomes')}
              className="w-full h-[76px] min-h-[76px] max-h-[76px] bg-gradient-to-r from-[#991b1b] to-[#b91c1c] text-white px-3 flex items-center gap-2.5 text-left focus:outline-none transition-colors hover:brightness-105"
            >
              <HeaderBadge><Target className="w-5 h-5" /></HeaderBadge>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <h3 className="text-xs font-black uppercase tracking-wider text-white leading-tight truncate">
                  4. CLOSED-LOOP OUTCOMES
                </h3>
                <p className="text-[10px] text-white/85 font-medium tracking-wide truncate">
                  (INSIGHTS &amp; ACTIONS)
                </p>
              </div>
            </button>

            {/* Inner Nodes: Exactly 2 Nodes as requested */}
            <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-start bg-slate-50/40">
              {/* Node 1: Agent Outcomes */}
              <button
                type="button"
                onClick={() => onSelectStage('agent-outcomes')}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'agent-outcomes'
                    ? 'border-amber-500 bg-amber-100/90 shadow-sm ring-1 ring-amber-400'
                    : 'border-amber-200 bg-amber-50/70 hover:bg-amber-100/60'
                }`}
              >
                <div className="w-8 h-8 shrink-0 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-sm">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="block text-xs font-black text-slate-800 leading-snug truncate">
                      Agent Outcomes
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-800 shrink-0">
                      AUDITS
                    </span>
                  </div>
                  <span className="block text-[10px] text-amber-900 font-semibold truncate mt-0.5">
                    Verified SQL &amp; KPI Citations
                  </span>
                  <span className="block text-[9.5px] text-slate-500 truncate">
                    Root-cause answers &amp; action tracking
                  </span>
                </div>
              </button>

              {/* Node 2: Detection Outcomes */}
              <button
                type="button"
                onClick={() => onSelectStage('detection-outcomes')}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'detection-outcomes'
                    ? 'border-rose-500 bg-rose-100/90 shadow-sm ring-1 ring-rose-400'
                    : 'border-rose-200 bg-rose-50/70 hover:bg-rose-100/60'
                }`}
              >
                <div className="w-8 h-8 shrink-0 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-sm">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="block text-xs font-black text-slate-800 leading-snug truncate">
                      Detection Outcomes
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 shrink-0">
                      ALERTS
                    </span>
                  </div>
                  <span className="block text-[10px] text-rose-900 font-semibold truncate mt-0.5">
                    Annotated Video &amp; Bounding Boxes
                  </span>
                  <span className="block text-[9.5px] text-slate-500 truncate">
                    Real-time alarms &amp; safety tickets
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
