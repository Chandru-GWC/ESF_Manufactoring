import React from 'react';
import { ArrowRight } from 'lucide-react';

export type PipelineStageId =
  | 'source'
  | 'preparation'
  | 'warehouse'
  | 'consumption'
  | 'outcome'
  | 'erp-mes'
  | 'excel-files'
  | 'apis-etl'
  | 'prepare-load'
  | 'cleaned-data'
  | 'semantic-model'
  | 'aggregated-data'
  | 'reports-bi'
  | 'decisions'
  | 'alerts'
  | 'impact';

interface ArchitecturePipelineProps {
  activeStage: PipelineStageId;
  onSelectStage: (stage: PipelineStageId) => void;
}

/* ===========================================================================
   High-Fidelity Vector Icons Matching the Sample Architecture Diagram
   =========================================================================== */

/** Factory icon for Stage 1 Header */
const FactoryHeaderIcon = () => (
  <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20h20M2 20V8l5 4V8l5 4V4h4l4 4v12" />
    <path d="M18 9h1M18 13h1M6 16h1M10 16h1M14 16h1" />
  </svg>
);

/** Database icon for Stage 2 Header */
const DatabaseHeaderIcon = () => (
  <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

/** Layered Stack / Warehouse icon for Stage 3 Header */
const WarehouseHeaderIcon = () => (
  <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="8" ry="2.5" />
    <path d="M4 5v5c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V5" />
    <path d="M4 10v5c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V10" />
    <path d="M4 15v4c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V15" />
  </svg>
);

/** Bar Chart icon for Stage 4 Header */
const ConsumptionHeaderIcon = () => (
  <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
);

/** Users / People icon for Stage 5 Header */
const OutcomeHeaderIcon = () => (
  <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    <circle cx="19" cy="8" r="2.5" />
    <path d="M19 13.5c1.5 0 4 .75 4 2.25V18h-3v-2.25c0-.85-.4-1.6-1-2.25z" />
    <circle cx="5" cy="8" r="2.5" />
    <path d="M5 13.5c-1.5 0-4 .75-4 2.25V18h3v-2.25c0-.85.4-1.6 1-2.25z" />
  </svg>
);

/* Card Visual Icons */

/** ERP & MES: Blue database cylinder with green cog */
const ErpMesIcon = () => (
  <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
    <svg className="w-6 h-6 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="8" ry="2.5" />
      <path d="M4 5v9c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V5" />
      <path d="M4 9.5c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5" />
    </svg>
    <svg className="w-3.5 h-3.5 text-emerald-600 absolute -bottom-0.5 -right-0.5 animate-spin-slow bg-white rounded-full p-0.5 shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  </div>
);

/** Excel & Files: Green file sheet icon with X */
const ExcelFilesIcon = () => (
  <div className="w-7 h-7 shrink-0 rounded-md bg-emerald-600 flex items-center justify-center shadow-sm">
    <div className="text-white font-extrabold text-xs tracking-tighter flex items-center justify-center">
      <span>X</span>
    </div>
  </div>
);

/** APIs & ETL: Purple Cloud with network bus / API */
const ApisEtlIcon = () => (
  <div className="w-7 h-7 shrink-0 rounded-md bg-purple-100 border border-purple-300 flex items-center justify-center shadow-sm">
    <svg className="w-4 h-4 text-purple-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <path d="M10 13h4M12 11v4" strokeWidth="2.5" />
    </svg>
  </div>
);

/** Stage 2 Center Graphic: Database with gears around it */
const PrepareLoadGraphic = () => (
  <div className="relative w-14 h-12 flex items-center justify-center my-0.5">
    {/* Blue database cylinder */}
    <svg className="w-10 h-10 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="6" rx="8" ry="2.5" fill="#dbeafe" />
      <path d="M4 6v8c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V6" fill="#eff6ff" />
      <path d="M4 10c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5" />
    </svg>
    {/* Gear 1 */}
    <svg className="w-5 h-5 text-sky-500 absolute -top-1 -right-0.5 animate-spin-slow drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="3" fill="#bae6fd" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
    {/* Gear 2 */}
    <svg className="w-4 h-4 text-blue-700 absolute -bottom-1 -left-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="3" fill="#bfdbfe" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  </div>
);

/** Cleaned & Integrated Data: Purple isometric 3D cubes cluster */
const Cubes3DIcon = () => (
  <svg className="w-6 h-6 text-purple-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <line x1="12" y1="22" x2="12" y2="12" />
  </svg>
);

/** Business / Semantic Model: Cyan connected graph nodes */
const SemanticModelIcon = () => (
  <svg className="w-6 h-6 text-cyan-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="6" cy="18" r="3" fill="#cffafe" />
    <circle cx="18" cy="18" r="3" fill="#cffafe" />
    <circle cx="12" cy="6" r="3" fill="#cffafe" />
    <line x1="8.59" y1="16.5" x2="15.42" y2="16.5" />
    <line x1="7.5" y1="15.5" x2="10.5" y2="8.5" />
    <line x1="16.5" y1="15.5" x2="13.5" y2="8.5" />
  </svg>
);

/** Aggregated & Optimized Data: Green grid table spreadsheet */
const TableGridIcon = () => (
  <svg className="w-6 h-6 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#d1fae5" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="#059669" />
  </svg>
);

/** Stage 4 Center Graphic: Desktop Monitor with colorful charts */
const BiMonitorGraphic = () => (
  <div className="w-14 h-12 flex items-center justify-center my-0.5">
    <svg className="w-12 h-10 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" fill="#f8fafc" stroke="#0284c7" strokeWidth="2" />
      <path d="M12 17v4M8 21h8" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
      {/* Bars on screen */}
      <rect x="5" y="9" width="2" height="5" fill="#38bdf8" stroke="none" />
      <rect x="8" y="7" width="2" height="7" fill="#0284c7" stroke="none" />
      {/* Pie slice on screen */}
      <circle cx="15.5" cy="10" r="3.5" fill="#f59e0b" stroke="none" />
      <path d="M15.5 6.5A3.5 3.5 0 0 1 19 10h-3.5z" fill="#10b981" />
    </svg>
  </div>
);

/** Power BI yellow bar icon badge */
const PowerBiBadge = () => (
  <span className="w-6 h-6 rounded bg-amber-400 p-0.5 flex items-end justify-center gap-0.5 shadow-sm" title="Power BI">
    <span className="w-1 h-2 bg-amber-900/60 rounded-xs" />
    <span className="w-1 h-3.5 bg-amber-900/70 rounded-xs" />
    <span className="w-1 h-4.5 bg-amber-900 rounded-xs" />
  </span>
);

/** Tableau cross scatter badge */
const TableauBadge = () => (
  <span className="w-6 h-6 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center shadow-sm" title="Tableau">
    <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 2h2v4h-2zm-6 5h2v4H5zm12 0h2v4h-2zM2 11h4v2H2zm16 0h4v2h-4zm-7 0h2v2h-2zm-6 5h2v4H5zm12 0h2v4h-2zm-6 3h2v3h-2z" />
    </svg>
  </span>
);

/** Custom Apps / Grid badge */
const CustomAppsBadge = () => (
  <span className="w-6 h-6 rounded bg-blue-600 p-1 flex items-center justify-center shadow-sm" title="Custom Apps">
    <div className="grid grid-cols-3 gap-0.5">
      <span className="w-1 h-1 bg-white rounded-xs" />
      <span className="w-1 h-1 bg-white rounded-xs" />
      <span className="w-1 h-1 bg-white rounded-xs" />
      <span className="w-1 h-1 bg-white rounded-xs" />
      <span className="w-1 h-1 bg-white rounded-xs" />
      <span className="w-1 h-1 bg-white rounded-xs" />
      <span className="w-1 h-1 bg-white rounded-xs" />
      <span className="w-1 h-1 bg-white rounded-xs" />
      <span className="w-1 h-1 bg-white rounded-xs" />
    </div>
  </span>
);

/** Data-Driven Decisions: Orange upward trend chart with arrow */
const TrendDecisionsIcon = () => (
  <svg className="w-6 h-6 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
    <rect x="3" y="16" width="2" height="4" fill="#fed7aa" stroke="#f97316" />
    <rect x="8" y="12" width="2" height="8" fill="#fed7aa" stroke="#f97316" />
    <rect x="13" y="14" width="2" height="6" fill="#fed7aa" stroke="#f97316" />
    <rect x="18" y="8" width="2" height="12" fill="#fed7aa" stroke="#f97316" />
  </svg>
);

/** Alerts & Early Actions: Golden warning bell */
const AlertsBellIcon = () => (
  <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
    <svg className="w-5 h-5 text-amber-500 fill-amber-400" viewBox="0 0 24 24">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
    <span className="w-1.5 h-1.5 rounded-full bg-red-500 absolute top-0 right-0 animate-ping" />
  </div>
);

/** Operational & Business Impact: Royal Blue bullseye target with arrow */
const BullseyeImpactIcon = () => (
  <svg className="w-6 h-6 text-sky-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" stroke="#0284c7" />
    <circle cx="12" cy="12" r="6" stroke="#0284c7" fill="#e0f2fe" />
    <circle cx="12" cy="12" r="2" fill="#0369a1" />
  </svg>
);

/* ===========================================================================
   Main Pipeline Layout Component
   =========================================================================== */

export const ArchitecturePipeline: React.FC<ArchitecturePipelineProps> = ({ activeStage, onSelectStage }) => {
  return (
    <div className="w-full">
      {/* 5-Column Grid with Inter-Column Flow Arrows */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-stretch relative">

        {/* -------------------------------------------------------------------------
            COLUMN 1: 1. SOURCE SYSTEM (DATA INTEGRATION)
            ------------------------------------------------------------------------- */}
        <div className="relative flex flex-col">
          <div
            className={`group flex flex-col flex-1 rounded-2xl border-2 overflow-hidden transition-all duration-200 bg-white shadow-sm ${
              activeStage === 'source' || activeStage === 'erp-mes' || activeStage === 'excel-files' || activeStage === 'apis-etl'
                ? 'border-red-600 ring-2 ring-red-500/20 shadow-md'
                : 'border-red-200 hover:border-red-400'
            }`}
          >
            {/* Header Banner */}
            <button
              type="button"
              onClick={() => onSelectStage('source')}
              className="w-full bg-gradient-to-r from-[#991b1b] to-[#b91c1c] text-white px-3 py-2.5 flex items-center gap-2.5 text-left focus:outline-none transition-colors hover:brightness-105"
            >
              <FactoryHeaderIcon />
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-white leading-tight">
                  1. SOURCE SYSTEM
                </h3>
                <p className="text-[10px] text-white/85 font-medium tracking-wide">
                  (DATA INTEGRATION)
                </p>
              </div>
            </button>

            {/* Cards Body */}
            <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between bg-slate-50/40">
              {/* Card 1: ERP & MES */}
              <button
                type="button"
                onClick={() => onSelectStage('erp-mes')}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'erp-mes'
                    ? 'border-sky-500 bg-sky-100/90 shadow-sm'
                    : 'border-sky-200 bg-sky-50/70 hover:bg-sky-100/60'
                }`}
              >
                <ErpMesIcon />
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                    ERP &amp; MES
                  </span>
                  <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                    (SAP / Oracle / Etc.)
                  </span>
                </div>
              </button>

              {/* Card 2: Excel & Files */}
              <button
                type="button"
                onClick={() => onSelectStage('excel-files')}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'excel-files'
                    ? 'border-emerald-500 bg-emerald-100/90 shadow-sm'
                    : 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/60'
                }`}
              >
                <ExcelFilesIcon />
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                    Excel &amp; Files
                  </span>
                  <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                    (CSV / XLSX / Etc.)
                  </span>
                </div>
              </button>

              {/* Card 3: APIs & ETL */}
              <button
                type="button"
                onClick={() => onSelectStage('apis-etl')}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'apis-etl'
                    ? 'border-purple-500 bg-purple-100/90 shadow-sm'
                    : 'border-purple-200 bg-purple-50/70 hover:bg-purple-100/60'
                }`}
              >
                <ApisEtlIcon />
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                    APIs &amp; ETL
                  </span>
                  <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                    (REST / OData / Etc.)
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
            COLUMN 2: 2. DATA PREPARATION (ETL / DATA PIPELINE)
            ------------------------------------------------------------------------- */}
        <div className="relative flex flex-col">
          <div
            className={`group flex flex-col flex-1 rounded-2xl border-2 overflow-hidden transition-all duration-200 bg-white shadow-sm ${
              activeStage === 'preparation' || activeStage === 'prepare-load'
                ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                : 'border-blue-200 hover:border-blue-400'
            }`}
          >
            {/* Header Banner */}
            <button
              type="button"
              onClick={() => onSelectStage('preparation')}
              className="w-full bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] text-white px-3 py-2.5 flex items-center gap-2.5 text-left focus:outline-none transition-colors hover:brightness-105"
            >
              <DatabaseHeaderIcon />
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-white leading-tight">
                  2. DATA PREPARATION
                </h3>
                <p className="text-[10px] text-white/85 font-medium tracking-wide">
                  (ETL / DATA PIPELINE)
                </p>
              </div>
            </button>

            {/* Body Content */}
            <button
              type="button"
              onClick={() => onSelectStage('prepare-load')}
              className={`p-3 flex-1 flex flex-col items-center justify-center text-center space-y-2 bg-slate-50/40 transition-colors ${
                activeStage === 'prepare-load' ? 'bg-blue-50/80' : 'hover:bg-blue-50/40'
              }`}
            >
              {/* Database & Gears Illustration */}
              <PrepareLoadGraphic />

              {/* PREPARE & LOAD Title */}
              <div>
                <span className="block text-xs font-black tracking-wide text-blue-900 uppercase">
                  PREPARE &amp; LOAD
                </span>
              </div>

              {/* Extract, Transform, Load Pills */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-teal-300 bg-teal-50 text-teal-800">
                  Extract
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-cyan-300 bg-cyan-50 text-cyan-800">
                  Transform
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800">
                  Load
                </span>
              </div>

              {/* Footer subtitle */}
              <span className="block text-[10px] font-semibold text-slate-500 pt-1">
                (SSIS / ADF / ETL / RPA)
              </span>
            </button>
          </div>
          {/* Inter-column connector arrow */}
          <div className="hidden lg:flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400">
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        {/* -------------------------------------------------------------------------
            COLUMN 3: 3. DATA & BUSINESS LAYER (DATA WAREHOUSE / SEMANTIC MODEL)
            ------------------------------------------------------------------------- */}
        <div className="relative flex flex-col">
          <div
            className={`group flex flex-col flex-1 rounded-2xl border-2 overflow-hidden transition-all duration-200 bg-white shadow-sm ${
              activeStage === 'warehouse' || activeStage === 'cleaned-data' || activeStage === 'semantic-model' || activeStage === 'aggregated-data'
                ? 'border-purple-600 ring-2 ring-purple-500/20 shadow-md'
                : 'border-purple-200 hover:border-purple-400'
            }`}
          >
            {/* Header Banner */}
            <button
              type="button"
              onClick={() => onSelectStage('warehouse')}
              className="w-full bg-gradient-to-r from-[#581c87] to-[#7e22ce] text-white px-3 py-2.5 flex items-center gap-2.5 text-left focus:outline-none transition-colors hover:brightness-105"
            >
              <WarehouseHeaderIcon />
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-white leading-tight">
                  3. DATA &amp; BUSINESS LAYER
                </h3>
                <p className="text-[10px] text-white/85 font-medium tracking-wide">
                  (DATA WAREHOUSE / SEMANTIC MODEL)
                </p>
              </div>
            </button>

            {/* Cards Body */}
            <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between bg-slate-50/40">
              {/* Card 1: Cleaned & Integrated Data */}
              <button
                type="button"
                onClick={() => onSelectStage('cleaned-data')}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'cleaned-data'
                    ? 'border-purple-500 bg-purple-100/90 shadow-sm'
                    : 'border-purple-200 bg-purple-50/70 hover:bg-purple-100/60'
                }`}
              >
                <Cubes3DIcon />
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                    Cleaned &amp; Integrated Data
                  </span>
                  <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                    (Single Source of Truth)
                  </span>
                </div>
              </button>

              {/* Card 2: Business / Semantic Model */}
              <button
                type="button"
                onClick={() => onSelectStage('semantic-model')}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'semantic-model'
                    ? 'border-cyan-500 bg-cyan-100/90 shadow-sm'
                    : 'border-cyan-200 bg-cyan-50/70 hover:bg-cyan-100/60'
                }`}
              >
                <SemanticModelIcon />
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                    Business / Semantic Model
                  </span>
                  <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                    (Metrics / KPIs / Logic)
                  </span>
                </div>
              </button>

              {/* Card 3: Aggregated & Optimized Data */}
              <button
                type="button"
                onClick={() => onSelectStage('aggregated-data')}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                  activeStage === 'aggregated-data'
                    ? 'border-emerald-500 bg-emerald-100/90 shadow-sm'
                    : 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/60'
                }`}
              >
                <TableGridIcon />
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                    Aggregated &amp; Optimized Data
                  </span>
                  <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                    (Facts / Dimensions / Views)
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
            COLUMN 4: 4. CONSUMPTION (BI / REPORTING / APPS)
            ------------------------------------------------------------------------- */}
        <div className="relative flex flex-col">
          <div
            className={`group flex flex-col flex-1 rounded-2xl border-2 overflow-hidden transition-all duration-200 bg-white shadow-sm ${
              activeStage === 'consumption' || activeStage === 'reports-bi'
                ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                : 'border-blue-200 hover:border-blue-400'
            }`}
          >
            {/* Header Banner */}
            <button
              type="button"
              onClick={() => onSelectStage('consumption')}
              className="w-full bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white px-3 py-2.5 flex items-center gap-2.5 text-left focus:outline-none transition-colors hover:brightness-105"
            >
              <ConsumptionHeaderIcon />
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-white leading-tight">
                  4. CONSUMPTION
                </h3>
                <p className="text-[10px] text-white/85 font-medium tracking-wide">
                  (BI / REPORTING / APPS)
                </p>
              </div>
            </button>

            {/* Body Content */}
            <button
              type="button"
              onClick={() => onSelectStage('reports-bi')}
              className={`p-3 flex-1 flex flex-col items-center justify-center text-center space-y-2 bg-slate-50/40 transition-colors ${
                activeStage === 'reports-bi' ? 'bg-blue-50/80' : 'hover:bg-blue-50/40'
              }`}
            >
              {/* Desktop Monitor Illustration */}
              <BiMonitorGraphic />

              {/* Reports & Dashboards Title */}
              <div>
                <span className="block text-xs font-black text-slate-900 leading-tight">
                  Reports &amp; Dashboards
                </span>
                <span className="block text-[10px] text-slate-600 font-medium leading-tight">
                  (Power BI / Tableau / Custom Apps)
                </span>
              </div>

              {/* App Badges: Power BI, Tableau, Custom Apps */}
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <PowerBiBadge />
                <TableauBadge />
                <CustomAppsBadge />
              </div>

              {/* Footer subtitle */}
              <span className="block text-[10px] font-semibold text-slate-500 pt-1">
                (Power BI / Tableau / Etc.)
              </span>
            </button>
          </div>
          {/* Inter-column connector arrow */}
          <div className="hidden lg:flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400">
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        {/* -------------------------------------------------------------------------
            COLUMN 5: 5. BUSINESS OUTCOME (INSIGHTS & ACTIONS)
            ------------------------------------------------------------------------- */}
        <div
          className={`group flex flex-col rounded-2xl border-2 overflow-hidden transition-all duration-200 bg-white shadow-sm ${
            activeStage === 'outcome' || activeStage === 'decisions' || activeStage === 'alerts' || activeStage === 'impact'
              ? 'border-red-600 ring-2 ring-red-500/20 shadow-md'
              : 'border-red-200 hover:border-red-400'
          }`}
        >
          {/* Header Banner */}
          <button
            type="button"
            onClick={() => onSelectStage('outcome')}
            className="w-full bg-gradient-to-r from-[#991b1b] to-[#b91c1c] text-white px-3 py-2.5 flex items-center gap-2.5 text-left focus:outline-none transition-colors hover:brightness-105"
          >
            <OutcomeHeaderIcon />
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-white leading-tight">
                5. BUSINESS OUTCOME
              </h3>
              <p className="text-[10px] text-white/85 font-medium tracking-wide">
                (INSIGHTS &amp; ACTIONS)
              </p>
            </div>
          </button>

          {/* Cards Body */}
          <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between bg-slate-50/40">
            {/* Card 1: Data-Driven Decisions */}
            <button
              type="button"
              onClick={() => onSelectStage('decisions')}
              className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                activeStage === 'decisions'
                  ? 'border-amber-500 bg-amber-100/90 shadow-sm'
                  : 'border-amber-200 bg-amber-50/70 hover:bg-amber-100/60'
              }`}
            >
              <TrendDecisionsIcon />
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                  Data-Driven Decisions
                </span>
                <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                  (Real-time / Historical)
                </span>
              </div>
            </button>

            {/* Card 2: Alerts & Early Actions */}
            <button
              type="button"
              onClick={() => onSelectStage('alerts')}
              className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                activeStage === 'alerts'
                  ? 'border-lime-500 bg-lime-100/90 shadow-sm'
                  : 'border-lime-200 bg-lime-50/70 hover:bg-lime-100/60'
              }`}
            >
              <AlertsBellIcon />
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                  Alerts &amp; Early Actions
                </span>
                <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                  (Threshold / Anomaly)
                </span>
              </div>
            </button>

            {/* Card 3: Operational & Business Impact */}
            <button
              type="button"
              onClick={() => onSelectStage('impact')}
              className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                activeStage === 'impact'
                  ? 'border-sky-500 bg-sky-100/90 shadow-sm'
                  : 'border-sky-200 bg-sky-50/70 hover:bg-sky-100/60'
              }`}
            >
              <BullseyeImpactIcon />
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold text-slate-800 leading-snug truncate">
                  Operational &amp; Business Impact
                </span>
                <span className="block text-[10px] text-slate-600 font-medium leading-tight truncate">
                  (Efficiency / Quality / Yield)
                </span>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
