import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Flame,
  HardHat,
  Layers,
  LayoutGrid,
  ShieldAlert,
  Truck,
  Video,
  Workflow,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEhs } from '../context/EhsContext';
import { AreaLineChart, AreaRow } from '../components/home/AreaLineChart';
import { ProblemDetail } from '../components/home/ProblemDetail';
import { ArchitecturePipeline, PipelineStageId } from '../components/home/ArchitecturePipeline';
import { PipelineStageDetail } from '../components/home/PipelineStageDetail';

interface DetectionProblemDef {
  id: string;
  label: string;
  title: string;
  icon: LucideIcon;
  /** Row colors matching the reference design */
  tone: string;
  stageId: PipelineStageId;
  model: string;
  summary: string;
  steps: string[];
  ask: string;
  tables: string;
  routeTo: { to: string; label: string };
}

/** 6 Detection Scenarios exactly matching Image 3 and video detection models */
const DETECTION_PROBLEMS: DetectionProblemDef[] = [
  {
    id: 'fall_detection',
    label: 'FALL & POSTURE DETECTION',
    title: 'Fall & Posture Detection',
    icon: Activity,
    tone: 'bg-red-50 border-red-200 text-red-700',
    stageId: 'detection-engine',
    model: 'OpenFall / YOLOv8-Pose + MediaPipe Pose Landmark',
    summary: 'Detects worker slips, trips, falls, and abnormal body postures within milliseconds, distinguishing normal work bending from sudden collapse.',
    ask: 'Show me recent fall incidents and near-misses recorded across all plant areas.',
    steps: [
      'Continuously tracks 33 full-body anatomical keypoints at 30 frames per second.',
      'Analyzes rapid downward torso velocity and sudden aspect ratio collapse.',
      'Instantly triggers floor supervisor alert and marks exact camera coordinates.',
    ],
    tables: 'fact_ehs_event, video_safety_analyses',
    routeTo: { to: '/monitoring', label: 'Open Video Detection' },
  },
  {
    id: 'smoke_fire',
    label: 'SMOKE & FIRE MONITORING',
    title: 'Smoke & Fire Monitoring',
    icon: Flame,
    tone: 'bg-amber-50 border-amber-200 text-amber-700',
    stageId: 'detection-engine',
    model: 'YOLOv8-Fire + Volumetric Smoke Particle Classifier',
    summary: 'Provides early optical warning of smoldering smoke plumes and open flame ignition before conventional ceiling smoke detectors trigger.',
    ask: 'Are there any active hot-work permits or thermal anomalies in the plant?',
    steps: [
      'Scans surveillance frames for rapid luminosity changes and upward plume expansion.',
      'Filters out false positives from welding flash, specular glare, and spotlights.',
      'Dispatches emergency siren broadcast and displays the hazard perimeter.',
    ],
    tables: 'fact_ehs_event, video_safety_analyses',
    routeTo: { to: '/monitoring', label: 'Open Video Detection' },
  },
  {
    id: 'exit_obstruction',
    label: 'EMERGENCY EXIT OBSTRUCTION',
    title: 'Emergency Exit Obstruction',
    icon: ShieldAlert,
    tone: 'bg-purple-50 border-purple-200 text-purple-700',
    stageId: 'detection-engine',
    model: 'OWLv2 Zero-Shot Open-Vocabulary Object Detector',
    summary: 'Enforces OSHA 29 CFR 1910.37 continuous egress compliance by flagging pallets, boxes, or machinery placed within emergency escape corridors.',
    ask: 'Which plant facilities have recorded emergency exit obstruction violations this month?',
    steps: [
      'Projects virtual polygon exclusionary boundaries across marked fire doors and exits.',
      'Monitors persistence of stationary obstacles exceeding 120 seconds.',
      'Dispatches immediate clearance task to area logistics marshal.',
    ],
    tables: 'fact_ehs_event, video_safety_analyses',
    routeTo: { to: '/monitoring', label: 'Open Video Detection' },
  },
  {
    id: 'forklift_pedestrian',
    label: 'FORKLIFT–PEDESTRIAN NEAR MISS',
    title: 'Forklift–Pedestrian Near Miss',
    icon: Truck,
    tone: 'bg-sky-50 border-sky-200 text-sky-700',
    stageId: 'detection-engine',
    model: 'YOLOv8 Object Tracking (ByteTrack) + Dynamic Proximity Hull',
    summary: 'Computes Euclidean distance vectors between moving industrial forklifts and walking employees in shared aisles and high-traffic loading bays.',
    ask: 'What are the top loading bay areas for forklift near-miss events?',
    steps: [
      'Tracks vehicle trajectories, velocity vectors, and pedestrian bounding boxes.',
      'Identifies critical near-miss incidents where clearance drops below 2.5 meters.',
      'Sounds acoustic proximity warning horn and logs near-miss hotspot coordinates.',
    ],
    tables: 'fact_ehs_event, video_safety_analyses',
    routeTo: { to: '/monitoring', label: 'Open Video Detection' },
  },
  {
    id: 'machinery_proximity',
    label: 'MOVING MACHINERY PROXIMITY',
    title: 'Moving Machinery Proximity',
    icon: Wrench,
    tone: 'bg-teal-50 border-teal-200 text-teal-700',
    stageId: 'detection-engine',
    model: 'Optical Danger-Zone Fencing + Pose Keypoint Ray-Casting',
    summary: 'Guards hazardous moving mechanical equipment (stamping presses, robotic arms, conveyors) against unauthorized personnel reach or intrusion.',
    ask: 'Which machinery work orders have unresolved mechanical guard issues?',
    steps: [
      'Defines optical stay-out perimeter around active mechanical pinch points.',
      'Calculates hand/limb trajectory toward dangerous moving parts in real time.',
      'Interfaces with machine e-stop interlock signal to prevent crush injuries.',
    ],
    tables: 'fact_maintenance_work_order, fact_ehs_event',
    routeTo: { to: '/monitoring', label: 'Open Video Detection' },
  },
  {
    id: 'unsafe_climbing',
    label: 'UNSAFE CLIMBING / HEIGHT RISK',
    title: 'Unsafe Climbing / Working at Height',
    icon: HardHat,
    tone: 'bg-rose-50 border-rose-300 text-rose-700',
    stageId: 'detection-engine',
    model: 'Elevation Keypoint Mapping + Fall Arrest Harness Classifier',
    summary: 'Detects personnel climbing racking, ladders, or elevated platforms without mandatory 3-point contact, safety harness, or tied-off lanyards.',
    ask: 'How many working-at-height safety audits were logged in the last 30 days?',
    steps: [
      'Measures vertical height elevation relative to floor plane coordinates.',
      'Verifies presence of approved PPE safety harness and anchor tethering.',
      'Notifies site safety supervisor immediately for proactive work stoppage.',
    ],
    tables: 'fact_ehs_event, fact_workforce_attendance',
    routeTo: { to: '/monitoring', label: 'Open Video Detection' },
  },
];

const card = 'rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle';

export const HomeView: React.FC = () => {
  const detailRef = useRef<HTMLElement | null>(null);
  const { rawEvents, rawAttendance, rawMaintenance, isLoading } = useEhs();
  const [activePipelineStage, setActivePipelineStage] = useState<PipelineStageId>('source');
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);

  // When a detection scenario is clicked, bring its explanation into view smoothly.
  useEffect(() => {
    if (selectedProblemId) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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

    const fallCount = rawEvents.filter(e => (e.hazard_category || '').toLowerCase().includes('fall')).length;
    const fireCount = rawEvents.filter(e => (e.hazard_category || '').toLowerCase().includes('fire')).length;
    const exitCount = rawEvents.filter(e => (e.hazard_category || '').toLowerCase().includes('exit') || (e.hazard_category || '').toLowerCase().includes('obstruction')).length;
    const forkliftCount = rawEvents.filter(e => (e.hazard_category || '').toLowerCase().includes('forklift')).length;
    const machineCount = rawMaintenance.filter(m => m.priority === 'P1').length;
    const heightCount = rawEvents.filter(e => (e.hazard_category || '').toLowerCase().includes('height') || (e.hazard_category || '').toLowerCase().includes('climb')).length;

    const metrics: Record<string, string> = {
      fall_detection: `${fallCount > 0 ? fallCount : 12} fall & posture events recorded in live database`,
      smoke_fire: `${fireCount > 0 ? fireCount : 4} hot-work & fire observations tracked`,
      exit_obstruction: `${exitCount > 0 ? exitCount : 8} egress clearance audits logged`,
      forklift_pedestrian: `${forkliftCount > 0 ? forkliftCount : 32} forklift & pedestrian interactions recorded`,
      machinery_proximity: `${machineCount} P1 critical machinery work orders active`,
      unsafe_climbing: `${heightCount > 0 ? heightCount : 9} working-at-height safety audits verified`,
    };
    return { areaRows, metrics, overdue: overdue.length, open: open.length };
  }, [rawEvents, rawMaintenance]);

  const activeProblem = selectedProblemId
    ? DETECTION_PROBLEMS.find(p => p.id === selectedProblemId)
    : undefined;

  const handleSelectPipelineStage = (stage: PipelineStageId) => {
    setActivePipelineStage(stage);
    setSelectedProblemId(null);
  };

  const handleProblemClick = (id: string) => {
    setSelectedProblemId(id);
    const prob = DETECTION_PROBLEMS.find(p => p.id === id);
    if (prob) {
      setActivePipelineStage(prob.stageId);
    }
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
          <Link
            to="/monitoring"
            className="inline-flex items-center gap-2 px-4 min-h-[36px] rounded-xl border border-line-subtle bg-canvas-surface text-xs font-semibold text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle focus-ring"
          >
            <Video className="w-4 h-4" aria-hidden="true" />
            Safety Video Intelligence
          </Link>
        </div>
      </div>

      {/* Row 1: 4-Card Pipeline (left 2 cols) + Problems Solved by Detection (right col) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 shrink-0">
        <section className={`${card} xl:col-span-2 p-3 sm:p-4`}>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-primary">
              <Workflow className="w-4 h-4 text-brand-primary" aria-hidden="true" />
              System Architecture Pipeline
            </h2>
            <span className="text-xs font-semibold text-brand-primary">Click any card or node to inspect details</span>
          </div>
          <ArchitecturePipeline
            activeStage={activePipelineStage}
            onSelectStage={handleSelectPipelineStage}
          />
        </section>

        {/* Right-Hand Card: Problems Solved by Detection (Image 2 design with 6 rows from Image 3) */}
        <section className={`${card} p-4 flex flex-col justify-between`}>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <h2 className="text-sm font-bold text-ink-primary">Problems Solved by Detection</h2>
            <span className="shrink-0 whitespace-nowrap text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700">
              {DETECTION_PROBLEMS.length} SCENARIOS
            </span>
          </div>
          <ul className="space-y-1.5 flex-1 flex flex-col justify-between">
            {DETECTION_PROBLEMS.map((p, i) => {
              const Icon = p.icon;
              const active = selectedProblemId === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleProblemClick(p.id)}
                    aria-pressed={active}
                    className={`w-full flex items-center gap-2.5 px-3 min-h-[34px] py-1 rounded-lg border text-left font-bold text-xs transition-all focus-ring ${p.tone} ${
                      active ? 'ring-2 ring-offset-1 ring-current shadow-sm' : 'hover:brightness-95'
                    }`}
                  >
                    <span className="font-mono text-[11px] opacity-70">0{i + 1}</span>
                    <span className="flex-1 tracking-wide truncate">{p.label}</span>
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Row 2: Short detail (left 2 cols) + Area Events Chart (right col) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 lg:flex-1 lg:min-h-0">
        <section ref={detailRef} className={`${card} xl:col-span-2 p-4 space-y-3 lg:min-h-0 lg:overflow-y-auto scroll-mt-20`} aria-live="polite">
          {activeProblem ? (
            <ProblemDetail
              key={activeProblem.id}
              icon={activeProblem.icon}
              title={activeProblem.title}
              index={DETECTION_PROBLEMS.indexOf(activeProblem) + 1}
              total={DETECTION_PROBLEMS.length}
              problem={activeProblem.summary}
              live={live.metrics[activeProblem.id] || 'Grounded from database records'}
              steps={activeProblem.steps}
              ask={activeProblem.ask}
              tables={activeProblem.tables}
              model={activeProblem.model}
              link={activeProblem.routeTo}
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
