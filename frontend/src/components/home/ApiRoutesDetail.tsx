import React from 'react';
import { Bot, FileCode2, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface RouteInfo {
  icon: LucideIcon;
  title: string;
  method: 'POST' | 'GET';
  path: string;
  summary: string;
  request: string;
  steps: string[];
  response: string;
  code: string;
}

const ROUTES: RouteInfo[] = [
  {
    icon: Bot,
    title: 'Agent route',
    method: 'POST',
    path: '/api/v1/ai/query',
    summary: 'Ask a safety question in plain words. The EHS Agent answers from the data with evidence.',
    request: '{ "prompt": "Which area has the most overdue actions?", "plant_id": "ALL" }',
    steps: [
      'The EHS Agent gets the question.',
      'It calls inspect_schema and run_query on the 3 tables (read-only).',
      'It answers with record IDs as evidence.',
    ],
    response: 'summary, key_findings, supporting_evidence, recommendations, execution_trace',
    code: 'backend/app/api/routes/ai.py',
  },
  {
    icon: Video,
    title: 'Video upload for detection',
    method: 'POST',
    path: '/api/v1/detection/upload',
    summary: 'Send a video. It is stored, analysed by the vision model in the background, and shown in Safety Monitoring.',
    request: 'multipart form: use_case, plant_id, file (the video)',
    steps: [
      'The server saves the video and answers at once: PROCESSING.',
      'The model draws the boxes; progress is read from GET /api/v1/detection/analyses/{id}.',
      'When done, annotated_video_url is ready.',
    ],
    response: 'analysis_id, status, progress_pct, original_video_url, annotated_video_url',
    code: 'backend/app/api/routes/detection.py',
  },
];

/** The two routes of the FastAPI backend that the app is built around. */
export const ApiRoutesDetail: React.FC = () => (
  <div className="space-y-2.5">
    <div>
      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted">Backend · FastAPI</span>
      <h3 className="text-base font-bold text-ink-primary">The two routes the app is built around</h3>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {ROUTES.map(r => {
        const Icon = r.icon;
        return (
          <article key={r.path} className="rounded-xl border border-line-subtle bg-canvas-subtle p-3 space-y-2 min-w-0">
            <h4 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
              <span className="p-1.5 rounded-lg bg-canvas-surface border border-line-subtle text-brand-primary">
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              {r.title}
            </h4>

            <p className="flex items-center gap-2 rounded-lg bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-slate-100 break-all">
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${r.method === 'POST' ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white'}`}>{r.method}</span>
              <span>{r.path}</span>
            </p>

            <p className="text-xs text-ink-secondary">{r.summary}</p>

            <p className="text-[11px] text-ink-primary">
              <span className="font-bold text-ink-secondary">Send: </span>
              <span className="font-mono break-words">{r.request}</span>
            </p>
            <div>
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary mb-1">What happens</h5>
              <ol className="space-y-0.5">
                {r.steps.map((step, i) => (
                  <li key={step} className="flex gap-2 text-xs text-ink-primary">
                    <span className="font-mono font-bold text-red-600">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="text-[11px] text-ink-primary">
              <span className="font-bold text-ink-secondary">Get back: </span>
              <span className="font-mono break-words">{r.response}</span>
            </p>

            <p className="flex items-center gap-1.5 text-[11px] font-mono text-ink-muted">
              <FileCode2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {r.code}
            </p>
          </article>
        );
      })}
    </div>
  </div>
);
