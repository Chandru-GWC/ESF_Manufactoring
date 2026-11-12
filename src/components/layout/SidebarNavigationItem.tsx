import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { NAV_PILL_SPRING } from '../../lib/motion';

export type SidebarBadgeVariant = 'default' | 'accent' | 'warning' | 'info' | 'success';

interface SidebarNavigationItemProps {
  id: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  badge?: number | string | null;
  badgeVariant?: SidebarBadgeVariant;
  badgeTitle?: string;
  isCollapsed?: boolean;
  onClick: () => void;
}

const BADGE_CLASSES: Record<SidebarBadgeVariant, string> = {
  default: 'bg-canvas-subtle text-ink-secondary border-line-subtle',
  warning: 'bg-severity-high-bg text-severity-high-text border-severity-high-border',
  accent: 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border',
  info: 'bg-severity-info-bg text-severity-info-text border-severity-info-border',
  success: 'bg-severity-success-bg text-severity-success-text border-severity-success-border',
};

export const SidebarNavigationItem: React.FC<SidebarNavigationItemProps> = ({
  id,
  label,
  icon: Icon,
  isActive,
  badge,
  badgeVariant = 'default',
  badgeTitle,
  isCollapsed = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      data-nav-id={id}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      title={isCollapsed ? label : undefined}
      className={cn(
        'group relative flex items-center w-full h-9 px-2.5 text-xs rounded-lg transition-colors select-none focus-ring',
        isCollapsed && 'justify-center px-0',
        isActive
          ? 'text-brand-primary font-semibold'
          : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle font-medium'
      )}
    >
      {isActive && (
        <motion.div
          layoutId="active-nav-background"
          className="absolute inset-0 rounded-lg bg-brand-subtle border border-brand-primary/20 -z-0"
          transition={NAV_PILL_SPRING}
        />
      )}

      <Icon
        className={cn(
          'relative z-10 w-4 h-4 shrink-0 transition-colors',
          isActive ? 'text-brand-primary' : 'text-ink-muted group-hover:text-ink-primary'
        )}
        aria-hidden="true"
      />

      {!isCollapsed && (
        <>
          <span className="relative z-10 ml-2.5 mr-2 whitespace-nowrap text-[13px] tracking-tight truncate">
            {label}
          </span>

          {badge !== null && badge !== undefined && (
            <span
              title={badgeTitle}
              className={cn(
                'relative z-10 ml-auto font-mono text-[10px] font-semibold px-1.5 py-0.5 leading-none rounded-md border tabular-nums shrink-0 transition-colors',
                isActive
                  ? 'bg-canvas-surface text-brand-primary border-brand-primary/30'
                  : BADGE_CLASSES[badgeVariant]
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
};
