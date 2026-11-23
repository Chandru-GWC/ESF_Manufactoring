import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  EyeOff,
  HardHat,
  Repeat,
  Workflow,
  Wrench,
  Layers,
  LayoutGrid,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEhs } from '../context/EhsContext';
import { AreaLineChart, AreaRow } from '../components/home/AreaLineChart';
import { ProblemDetail } from '../components/home/ProblemDetail';
import { ArchitecturePipeline, PipelineStageId } from '../components/home/ArchitecturePipeline';
import { PipelineStageDetail } from '../components/home/PipelineStageDetail';

/**
 * TEMPORARY home page. The pipeline and the "Problems solved by agents" list are
 * placeholders while the final home content is being decided.
 */

interface ProblemDef {
  id: string;
  label: string;
  title: string;
  icon: LucideIcon;
  /** Row colours, same idea as the reference design (one tone per problem). */
  tone: string;
  /** Pipeline stage highlighted while this problem is open. */
  stageId: PipelineStageId;
  summary: string;
  steps: string[];
  /** Example question to ask the agent. */
  ask: string;
  agents: { id: string; name: string }[];
  tables: string;
  routeTo: { to: string; label: string };
}

const AGENT = { id: 'ehs_safety_agent', name: 'EHS Agent' };

const PROBLEMS: ProblemDef[] = [
  {
    id: 'delays',
    label: 'DELAYED ACTIONS',
    title: 'Delayed corrective actions',
    icon: Clock,
    tone: 'bg-red-50 border-red-200 text-red-700',
    stageId: 'alerts',
    summary: 'Corrective actions pass their due date without being closed, so known hazards stay open.',
    ask: 'Which corrective actions are overdue? Give the owners and the areas they are in.',
    steps: [
      'Finds every open action past its due date, by owner.',
      'Sends reminders and escalates actions left unresolved.',
      'A safety officer confirms before any status changes.',
    ],
    agents: [AGENT],
    tables: 'fact_ehs_event, safety_alerts',
    routeTo: { to: '/overview', label: 'Open the overview' },
  },
  {
    id: 'blindspots',
    label: 'BLIND SPOTS',
    title: 'Hazard blind spots',
    icon: EyeOff,
    tone: 'bg-amber-50 border-amber-200 text-amber-700',
    stageId: 'reports-bi',
    summary: 'Hazards go unnoticed in areas and shifts nobody is watching closely.',
    ask: 'Which areas and hazard categories have the most critical events?',
    steps: [
      'Ranks hazard categories and plant areas to show hotspots.',
      'Camera models watch for falls, fire, blocked exits and more.',
      'Every finding cites the records it came from.',
    ],
    agents: [AGENT],
    tables: 'fact_ehs_event, video_safety_analyses',
    routeTo: { to: '/monitoring', label: 'Open safety monitoring' },
  },
  {
    id: 'recurring',
    label: 'REPEAT INCIDENTS',
    title: 'Recurring incidents',
    icon: Repeat,
    tone: 'bg-purple-50 border-purple-200 text-purple-700',
    stageId: 'cleaned-data',
    summary: 'The same incident or near-miss keeps happening because the trend is not visible.',
    ask: 'Which hazard category keeps repeating, and in which plants and shifts?',
    steps: [
      'Tracks incidents over time.',
      'Flags repeated near-miss clusters as a warning sign.',
      'Suggests containment and refresher training for review.',
    ],
    agents: [AGENT],
    tables: 'fact_ehs_event',
    routeTo: { to: '/overview', label: 'Open the overview' },
  },
  {
    id: 'equipment',
    label: 'EQUIPMENT RISK',
    title: 'Equipment and maintenance risk',
    icon: Wrench,
    tone: 'bg-sky-50 border-sky-200 text-sky-700',
    stageId: 'erp-mes',
    summary: 'Urgent maintenance stays open while risky equipment keeps running.',
    ask: 'Which P1 maintenance jobs are still open, and what are their failure modes?',
    steps: [
      'Sorts open P1 work orders by urgency.',
      'Highlights machines with repeated failures.',
    ],
    agents: [AGENT],
    tables: 'fact_maintenance_work_order',
    routeTo: { to: '/operations/maintenance', label: 'Open maintenance' },
  },
  {
    id: 'compliance',
    label: 'COMPLIANCE GAPS',
    title: 'Permit and training gaps',
    icon: HardHat,
    tone: 'bg-rose-50 border-rose-300 text-rose-700',
    stageId: 'semantic-model',
    summary: 'Work goes ahead with permit exceptions or lapsed worker training.',
    ask: 'How many employees have expired safety training, and which permit exceptions are on record?',
    steps: [
      'Checks permits and exceptions against the rules.',
      'Checks training status, overtime and shifts.',
      'Combines both into one cross-area report.',
    ],
    agents: [AGENT],
    tables: 'fact_ehs_event, fact_workforce_attendance',
    routeTo: { to: '/operations/training', label: 'Open training matrix' },
  },
];

const card = 'rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle';

export const HomeView: React.FC = () => {
  const detailRef = useRef<HTMLElement | null>(null);
  const { rawEvents, rawAttendance, rawMaintenance, isLoading } = useEhs();
  const [activePipelineStage, setActivePipelineStage] = useState<PipelineStageId>('source');
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);

  // When a problem is clicked, bring its explanation into view.
  useEffect(() => {
    if (selectedProblemId) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedProblemId]);

  const live = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = (d?: string) => !!d && d.slice(0, 10) < today;
    const open = rawEvents.filter(e => e.action_status !== 'CLOSED');
    const overdue = open.filter(e => isOverdue(e.due_date));

    const byArea = new Map<string, AreaRow>();
    rawEvents.forEach(e => {
      const key = e.area || 'Unassigned';
      const row = byArea.get(key) ?? { label: key, total: 0, open: 0 };
      row.total += 1;
      if (e.action_status !== 'CLOSED') row.open += 1;
      byArea.set(key, row);
    });
    const areaRows: AreaRow[] = [...byArea.values()].sort((x, y) => y.total - x.total || y.open - x.open);

    const categories = new Map<string, number>();
    rawEvents.forEach(e => categories.set(e.hazard_category, (categories.get(e.hazard_category) ?? 0) + 1));
    const top = [...categories.entries()].sort((a, b) => b[1] - a[1])[0];

    const metrics: Record<string, string> = {
      delays: `${overdue.length} overdue of ${open.length} open actions`,
      blindspots: `${rawEvents.filter(e => e.event_type === 'HAZARD_OBSERVATION' || e.event_type === 'NEAR_MISS').length} hazard observations and near-misses`,
      recurring: top ? `Top category: ${top[0]} (${top[1]} events)` : 'No events loaded',
      equipment: `${rawMaintenance.filter(m => m.priority === 'P1' && m.status !== 'COMPLETED').length} open P1 work orders`,
      compliance: `${rawEvents.filter(e => e.event_type === 'PERMIT_EXCEPTION').length} permit exceptions`,
    };
    return { areaRows, metrics, overdue: overdue.length, open: open.length };
  }, [rawEvents, rawMaintenance]);

  const problem = selectedProblemId ? PROBLEMS.find(p => p.id === selectedProblemId) : undefined;

  const handleSelectPipelineStage = (stage: PipelineStageId) => {
    setActivePipelineStage(stage);
    setSelectedProblemId(null);
  };

  const handleProblemClick = (id: string) => {
    setSelectedProblemId(id);
    if (id === 'delays') setActivePipelineStage('alerts');
    else if (id === 'blindspots') setActivePipelineStage('reports-bi');
    else if (id === 'recurring') setActivePipelineStage('cleaned-data');
    else if (id === 'equipment') setActivePipelineStage('erp-mes');
    else if (id === 'compliance') setActivePipelineStage('semantic-model');
  };

  const tableCounts = {
    events: rawEvents.length,
    attendance: rawAttendance.length,
    maintenance: rawMaintenance.length,
  };

  const tableRows = {
    events: rawEvents as unknown as Record<string, unknown>[],
    attendance: rawAttendance as unknown as Record<string, unknown>[],
    maintenance: rawMaintenance as unknown as Record<string, unknown>[],
  };

  return (
    <div className="w-full flex flex-col gap-3 lg:h-[calc(100vh-4rem)] lg:min-h-0">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-current="page"
            className="inline-flex items-center gap-2 px-4 min-h-[36px] rounded-xl bg-brand-primary text-white text-xs font-bold shadow-sm-subtle"
          >
            <Layers className="w-4 h-4" aria-hidden="true" />
            Application Architecture &amp; Operations Command
          </span>
          <Link
            to="/overview"
            className="inline-flex items-center gap-2 px-4 min-h-[36px] rounded-xl border border-line-subtle bg-canvas-surface text-xs font-semibold text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle focus-ring"
          >
            <LayoutGrid className="w-4 h-4" aria-hidden="true" />
            Executive Overview &amp; Analytics
          </Link>
        </div>
        <p className="lg:mr-14 flex flex-wrap items-center gap-x-3 text-xs text-ink-secondary">
          <span>
            Database Grounding: <strong className="text-brand-primary">Neon PostgreSQL (ehs_core)</strong>
          </span>
          <span className="flex items-center gap-1.5 font-bold text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
            Zero Mock Data
          </span>
        </p>
      </div>

      {/* Row 1: pipeline (left) + problems (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 shrink-0">
        <section className={`${card} xl:col-span-2 p-3 sm:p-4`}>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-primary">
              <Workflow className="w-4 h-4 text-brand-primary" aria-hidden="true" />
              System Architecture Pipeline
            </h2>
            <span className="text-xs font-semibold text-brand-primary">Click any card to inspect details</span>
          </div>
          <ArchitecturePipeline
            activeStage={activePipelineStage}
            onSelectStage={handleSelectPipelineStage}
          />
        </section>

        <section className={`${card} p-4`}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-ink-primary">Problems Solved by Agents</h2>
            <span className="shrink-0 whitespace-nowrap text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700">
              {PROBLEMS.length} PROBLEMS
            </span>
          </div>
          <ul className="space-y-1.5">
            {PROBLEMS.map((p, i) => {
              const Icon = p.icon;
              const active = selectedProblemId === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleProblemClick(p.id)}
                    aria-pressed={active}
                    className={`w-full flex items-center gap-3 px-3 min-h-[36px] rounded-md border text-left font-bold text-xs focus-ring ${p.tone} ${
                      active ? 'ring-2 ring-offset-1 ring-current' : 'hover:brightness-95'
                    }`}
                  >
                    <span className="font-mono text-[11px] opacity-70">0{i + 1}</span>
                    <span className="flex-1 tracking-wide">{p.label}</span>
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Row 2: short detail (left) + chart (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 lg:flex-1 lg:min-h-0">
        <section ref={detailRef} className={`${card} xl:col-span-2 p-4 space-y-3 lg:min-h-0 lg:overflow-y-auto scroll-mt-20`} aria-live="polite">
          {problem ? (
            <ProblemDetail
              key={problem.id}
              icon={problem.icon}
              title={problem.title}
              index={PROBLEMS.indexOf(problem) + 1}
              total={PROBLEMS.length}
              problem={problem.summary}
              live={live.metrics[problem.id]}
              steps={problem.steps}
              ask={problem.ask}
              tables={problem.tables}
              link={problem.routeTo}
            />
          ) : (
            <PipelineStageDetail
              stage={activePipelineStage}
              tableCounts={tableCounts}
              tableRows={tableRows}
              isLoading={isLoading}
            />
          )}
        </section>

        <AreaLineChart
          title="Events by Plant Area"
          subtitle="From the events table: all events and the ones with an open corrective action."
          source="ehs_core.fact_ehs_event"
          rows={live.areaRows}
          loading={isLoading && !rawEvents.length}
        />
      </div>
    </div>
  );
};
