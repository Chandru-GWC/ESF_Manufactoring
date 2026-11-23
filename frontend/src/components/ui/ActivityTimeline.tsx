import React from 'react';
import { LucideIcon, CheckCircle2, AlertTriangle, FileText, UserCheck, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  user: string;
  type: 'incident' | 'hazard' | 'inspection' | 'action' | 'permit';
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ events, className }) => {
  const getIcon = (type: TimelineEvent['type']): LucideIcon => {
    switch (type) {
      case 'incident':
        return ShieldAlert;
      case 'hazard':
        return AlertTriangle;
      case 'inspection':
        return CheckCircle2;
      case 'action':
        return UserCheck;
      case 'permit':
        return FileText;
    }
  };

  const getBadgeStyle = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'incident':
        return 'text-severity-critical-text bg-severity-critical-bg border-severity-critical-border';
      case 'hazard':
        return 'text-severity-warning-text bg-severity-warning-bg border-severity-warning-border';
      case 'inspection':
        return 'text-severity-success-text bg-severity-success-bg border-severity-success-border';
      case 'action':
        return 'text-severity-info-text bg-severity-info-bg border-severity-info-border';
      case 'permit':
        return 'text-ink-secondary bg-canvas-subtle border-line-default';
    }
  };

  return (
    <div
      className={cn(
        'relative pl-4 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-line-subtle',
        className
      )}
    >
      {events.map(evt => {
        const Icon = getIcon(evt.type);
        const badgeClasses = getBadgeStyle(evt.type);

        return (
          <div key={evt.id} className="relative flex items-start gap-3 text-xs group">
            <div
              className={cn(
                'absolute -left-4 mt-1 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 z-10',
                badgeClasses
              )}
            >
              <Icon className="w-2.5 h-2.5" />
            </div>

            <div className="flex-1 bg-canvas-surface border border-line-subtle group-hover:border-line-default rounded-lg p-3 transition-colors">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-ink-primary">{evt.title}</span>
                <span className="font-mono text-[11px] text-ink-muted tabular-nums shrink-0">
                  {evt.timestamp}
                </span>
              </div>
              <p className="text-ink-secondary text-[11px] leading-relaxed mb-1.5">{evt.description}</p>
              <div className="flex items-center justify-between text-[10px] text-ink-muted pt-1.5 border-t border-line-subtle/60">
                <span className="font-mono uppercase text-brand-purple font-semibold">{evt.id}</span>
                <span>Owner: {evt.user}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
