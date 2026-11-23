import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, CheckCircle2, Database, Eye, ShieldCheck, Video } from 'lucide-react';

/** Detail of the "Agent" node: the single EHS Agent and how it works. */
export const AgentDetail: React.FC = () => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted">AI · the only agent</span>
        <h3 className="flex items-center gap-2 text-lg font-bold text-ink-primary mt-1">
          <span className="p-1.5 rounded-lg bg-brand-subtle text-brand-primary">
            <Bot className="w-4 h-4" aria-hidden="true" />
          </span>
          EHS Agent
        </h3>
        <p className="text-sm text-ink-secondary mt-1">Answers safety questions by reading the 3 tables with two read-only tools.</p>
      </div>
      <Link to="/ehs-agent" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline focus-ring rounded">
        Open the EHS Agent page <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-line-subtle bg-canvas-subtle p-4 space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary">How it works</h4>
        <ol className="space-y-1.5">
          {[
            'You ask a question in plain words.',
            'DomoGPT picks the next step: look at a table or run a query.',
            'The tool runs and the result goes back to DomoGPT (up to 6 steps).',
            'It answers with the figures and the record IDs behind them.',
          ].map((step, i) => (
            <li key={step} className="flex gap-2 text-xs text-ink-primary">
              <span className="font-mono font-bold text-red-600">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-line-subtle bg-canvas-subtle p-4 space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary">Its two tools</h4>
        <div className="space-y-2">
          <p className="text-xs text-ink-primary">
            <span className="inline-flex items-center gap-1 font-mono font-bold text-brand-primary">
              <Database className="w-3 h-3" aria-hidden="true" /> inspect_schema(table)
            </span>
            <span className="block text-ink-secondary">Columns, meanings and the allowed values of a table.</span>
          </p>
          <p className="text-xs text-ink-primary">
            <span className="inline-flex items-center gap-1 font-mono font-bold text-brand-primary">
              <Database className="w-3 h-3" aria-hidden="true" /> run_query(sql)
            </span>
            <span className="block text-ink-secondary">One read-only SELECT on the 3 tables, at most 50 rows.</span>
          </p>
        </div>
      </div>
    </div>

    <ul className="flex flex-wrap gap-2 text-[11px]">
      {['Read-only', 'Only the 3 tables', 'Every figure comes from a query result', 'A human approves any action'].map(rule => (
        <li key={rule} className="inline-flex items-center gap-1 rounded-full border border-line-subtle bg-canvas-subtle px-2.5 py-1 font-semibold text-ink-primary">
          <ShieldCheck className="w-3 h-3 text-severity-success-dot" aria-hidden="true" />
          {rule}
        </li>
      ))}
    </ul>
  </div>
);

interface OutcomeCard {
  icon: typeof Bot;
  title: string;
  lead: string;
  items: string[];
  shownOn: { to: string; label: string };
}

const OUTCOMES: OutcomeCard[] = [
  {
    icon: Bot,
    title: 'Agent outcome',
    lead: 'A written answer you can check.',
    items: [
      'Summary with the exact figures',
      'Key findings and recommendations',
      'Evidence: record IDs and the query that produced them',
      'Suggested follow-up questions',
      'Trace of every tool call',
    ],
    shownOn: { to: '/ehs-agent', label: 'EHS Agent page' },
  },
  {
    icon: Video,
    title: 'Detection outcome',
    lead: 'What the vision model found in a video.',
    items: [
      'Status: completed, needs review or failed',
      'The event found (for example a fall) and when it happened',
      'The video with the detection boxes drawn, plus an evidence frame',
      'An alert is raised when something is detected',
      'A person confirms or dismisses the finding',
    ],
    shownOn: { to: '/monitoring', label: 'Safety Monitoring page' },
  },
];

/** Detail of the "Outcomes" node: what comes out of the agent and out of the detection. */
export const OutcomesDetail: React.FC = () => (
  <div className="space-y-4">
    <div>
      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted">Results</span>
      <h3 className="text-lg font-bold text-ink-primary mt-1">Two kinds of outcome</h3>
      <p className="text-sm text-ink-secondary mt-1">Both are shown in the app and both are reviewed by a person before anything is acted on.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {OUTCOMES.map(o => {
        const Icon = o.icon;
        return (
          <article key={o.title} className="rounded-xl border border-line-subtle bg-canvas-subtle p-4 space-y-3 min-w-0">
            <h4 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
              <span className="p-1.5 rounded-lg bg-canvas-surface border border-line-subtle text-brand-primary">
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              {o.title}
            </h4>
            <p className="text-xs text-ink-secondary">{o.lead}</p>
            <ul className="space-y-1.5">
              {o.items.map(item => (
                <li key={item} className="flex gap-2 text-xs text-ink-primary">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-severity-success-dot" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link to={o.shownOn.to} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline focus-ring rounded">
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              See it on the {o.shownOn.label}
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </article>
        );
      })}
    </div>
  </div>
);
