import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';

export interface ModuleTabItem {
  to: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number | null;
}

interface ModuleTabsProps {
  title?: string;
  tabs: ModuleTabItem[];
  children: React.ReactNode;
}

export const ModuleTabs: React.FC<ModuleTabsProps> = ({ tabs, children }) => {
  return (
    <div className="space-y-5">
      <div
        role="navigation"
        aria-label="Module Sections"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-line-subtle"
      >
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 whitespace-nowrap transition-colors focus-ring',
                  isActive
                    ? 'border-brand-primary text-brand-primary bg-brand-subtle/60'
                    : 'border-transparent text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
                )
              }
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== null && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-canvas-subtle text-ink-muted border border-line-subtle">
                  {tab.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
};

