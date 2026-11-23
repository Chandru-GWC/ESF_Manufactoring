import React from 'react';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  lead?: string;
  actions?: React.ReactNode;
}

/** Shared section heading used across the unified home page. */
export const SectionHeading: React.FC<SectionHeadingProps> = ({ eyebrow, title, lead, actions }) => (
  <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
    <div className="max-w-2xl">
      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-secondary flex items-center gap-2">
        <span className="w-5 h-0.5 bg-brand-orange" aria-hidden="true" />
        {eyebrow}
      </span>
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-primary mt-2">{title}</h2>
      {lead && <p className="text-sm text-ink-secondary mt-2 leading-relaxed">{lead}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);
