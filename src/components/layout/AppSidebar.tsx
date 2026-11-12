import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  Flame,
  CheckSquare,
  Users,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Database,
  X,
  ArrowUpLeft,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEhs } from '../../context/EhsContext';
import { SidebarNavigationItem, SidebarBadgeVariant } from './SidebarNavigationItem';

export type PrimaryModuleId =
  | 'command-center'
  | 'safety-monitoring'
  | 'events-incidents'
  | 'prevention-capa'
  | 'operations'
  | 'insights-admin';

interface AppSidebarProps {
  activeModule: PrimaryModuleId;
  onSelectModule: (moduleId: PrimaryModuleId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenIngestModal: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface ModuleNavDef {
  id: PrimaryModuleId;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  badge?: number | string | null;
  badgeVariant?: SidebarBadgeVariant;
  badgeTitle?: string;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeModule,
  onSelectModule,
  isCollapsed,
  onToggleCollapse,
  onOpenIngestModal,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const {
    overviewSummary,
    isDataConnected,
    facilityId,
  } = useEhs();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const totalVerifiedRecords = overviewSummary
    ? overviewSummary.total_ehs_events +
      overviewSummary.total_workforce_records +
      overviewSummary.total_maintenance_work_orders
    : null;

  const formatCompactCount = (n?: number | null) => {
    if (n === null || n === undefined) return null;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n;
  };

  const navModules: ModuleNavDef[] = [
    {
      id: 'command-center',
      label: 'Command Center',
      subtitle: 'Executive KPIs',
      icon: LayoutDashboard,
    },
    {
      id: 'safety-monitoring',
      label: 'Safety Monitoring',
      subtitle: 'Video AI & 3D Twin',
      icon: Video,
      badge: '6 AI',
      badgeVariant: 'info',
      badgeTitle: 'Safety Video Intelligence & 3D Digital Twin',
    },
    {
      id: 'events-incidents',
      label: 'Events & Incidents',
      subtitle: 'Hazards, Incidents & Risks',
      icon: Flame,
      badge: overviewSummary?.critical_events_count ?? null,
      badgeVariant: 'accent',
      badgeTitle: 'Critical severity safety events in Neon',
    },
    {
      id: 'prevention-capa',
      label: 'Prevention & CAPA',
      subtitle: 'CAPA, Permits & Audits',
      icon: CheckSquare,
      badge: overviewSummary?.open_actions_count ?? null,
      badgeVariant: 'warning',
      badgeTitle: 'Open + In Progress CAPA tasks',
    },
    {
      id: 'operations',
      label: 'Operations',
      subtitle: 'Workforce, Training & Maintenance',
      icon: Users,
      badge: formatCompactCount(overviewSummary?.total_workforce_records),
      badgeVariant: 'success',
      badgeTitle: 'Workforce attendance records in Neon',
    },
    {
      id: 'insights-admin',
      label: 'Insights & Admin',
      subtitle: 'AI Assistant, Reports & Settings',
      icon: Sparkles,
    },
  ];

  const handleNavClick = (id: PrimaryModuleId) => {
    onSelectModule(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onCloseMobile}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <aside
        aria-label="Primary EHS Navigation"
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col bg-sidebar-bg border-r border-sidebar-border transition-all duration-200 select-none ${
          isMobileOpen
            ? 'translate-x-0 w-[264px]'
            : isCollapsed
            ? '-translate-x-full lg:translate-x-0 lg:w-16'
            : '-translate-x-full lg:translate-x-0 lg:w-[264px]'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-14 px-3.5 border-b border-sidebar-border shrink-0">
          <Link
            to="/overview"
            onClick={() => isMobileOpen && onCloseMobile?.()}
            className="flex items-center gap-2.5 min-w-0 focus-ring rounded-lg"
          >
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-ink-primary text-white shrink-0">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white ${
                  isDataConnected ? 'bg-severity-success-dot' : 'bg-brand-orange'
                }`}
              />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="min-w-0">
                <span className="block text-[13px] font-bold tracking-tight text-ink-primary whitespace-nowrap">
                  EHS Safety AI
                </span>
                <span className="block text-[10px] font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">
                  Enterprise Light
                </span>
              </div>
            )}
          </Link>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-canvas-subtle transition-colors focus-ring"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {isMobileOpen && onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-md text-ink-muted hover:text-ink-primary hover:bg-canvas-subtle lg:hidden"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Neon Lineage Summary */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="px-3.5 py-3 border-b border-sidebar-border bg-sidebar-surface shrink-0">
            <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                <Database className="w-3 h-3 text-brand-primary shrink-0" />
                <span>Scope ({facilityId})</span>
              </span>
              <span className="text-[11px] font-mono text-severity-success-text font-semibold tabular-nums whitespace-nowrap">
                {totalVerifiedRecords !== null
                  ? `${totalVerifiedRecords.toLocaleString('en-IN')} rows`
                  : 'Syncing...'}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenIngestModal}
              className="w-full text-left text-[11px] text-brand-primary hover:underline font-medium whitespace-nowrap transition-colors focus-ring rounded"
            >
              Inspect Schema & Lineage →
            </button>
          </div>
        )}

        {/* Consolidated 6-Module Navigation */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
          {(!isCollapsed || isMobileOpen) && (
            <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              Safety Workspace
            </div>
          )}
          {navModules.map(mod => (
            <SidebarNavigationItem
              key={mod.id}
              id={mod.id}
              label={mod.label}
              icon={mod.icon}
              isActive={activeModule === mod.id}
              badge={mod.badge}
              badgeVariant={mod.badgeVariant}
              badgeTitle={mod.badgeTitle}
              isCollapsed={isCollapsed && !isMobileOpen}
              onClick={() => handleNavClick(mod.id)}
            />
          ))}
        </nav>

        {/* Footer: Landing Link + Neon Governance */}
        <div className="px-3 py-3 border-t border-sidebar-border bg-sidebar-surface space-y-2 shrink-0">
          {(!isCollapsed || isMobileOpen) ? (
            <>
              <Link
                to="/"
                className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors px-1 py-0.5 rounded focus-ring"
              >
                <ArrowUpLeft className="w-3.5 h-3.5 text-ink-muted" />
                <span>Public Overview Page</span>
              </Link>
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-ink-muted px-1">
                <span className="text-severity-success-text font-semibold">Neon SSL • ehs_core</span>
                <span className="text-brand-orange font-semibold">Zero-Mock</span>
              </div>
            </>
          ) : (
            <Link
              to="/"
              title="Public Landing Page"
              aria-label="Public Landing Page"
              className="flex items-center justify-center p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-canvas-muted"
            >
              <ArrowUpLeft className="w-4 h-4" />
            </Link>
          )}
        </div>
      </aside>
    </>
  );
};
