import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Cpu, Database, Eye, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ProblemDetailProps {
  icon: LucideIcon;
  title: string;
  index: number;
  total: number;
  problem: string;
  live: string;
  steps: string[];
  ask: string;
  tables: string;
  model?: string;
  link: { to: string; label: string };
}

/** Full, clearly separated explanation of one problem solved by detection / safety AI. */
export const ProblemDetail: React.FC<ProblemDetailProps> = ({
  icon: Icon,
  title,
  index,
  total,
  problem,
  live,
  steps,
  ask,
  tables,
  model,
  link,
}) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-lg font-bold text-ink-primary">
        <span className="p-1.5 rounded-lg bg-red-50 text-red-600">
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        {title}
      </h3>
      <span className="text-[10px] font-mono font-bold px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700">
        SCENARIO {index} OF {total}
      </span>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section className="rounded-xl border border-red-200 bg-red-50/60 p-4 space-y-1.5">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-700">The Workplace Hazard</h4>
        <p className="text-sm text-ink-primary">{problem}</p>
      </section>

      <section className="rounded-xl border border-line-subtle bg-canvas-subtle p-4 space-y-1.5">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary">Detection Model &amp; Database Grounding</h4>
        {model && (
          <p className="text-xs font-mono font-bold text-brand-primary flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            {model}
          </p>
        )}
        <p className="text-xs font-medium text-ink-primary">{live}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted pt-1">
          <Database className="w-3 h-3 shrink-0" aria-hidden="true" />
          {tables.split(',').map(t => (
            <span key={t} className="font-mono rounded bg-canvas-surface border border-line-subtle px-1.5 py-0.5">
              {t.trim()}
            </span>
          ))}
        </p>
      </section>
    </div>

    <section className="rounded-xl border border-line-subtle p-4 space-y-2">
      <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-secondary">
        <Eye className="w-3.5 h-3.5 text-brand-primary" aria-hidden="true" />
        How Safety AI &amp; Detection Solves It
      </h4>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm text-ink-primary">
            <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-brand-subtle text-brand-primary text-[11px] font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>

    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
      <p className="flex items-start gap-2 rounded-xl bg-brand-subtle px-4 py-3 text-sm text-ink-primary">
        <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-brand-orange" aria-hidden="true" />
        <span>
          <strong>Ask the safety agent:</strong> "{ask}"
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Link to="/ehs-agent" className="inline-flex items-center gap-1.5 font-semibold text-brand-primary hover:underline focus-ring rounded">
          Ask Safety Agent <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
        <Link to={link.to} className="inline-flex items-center gap-1.5 font-semibold text-brand-primary hover:underline focus-ring rounded">
          {link.label} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  </div>
);
