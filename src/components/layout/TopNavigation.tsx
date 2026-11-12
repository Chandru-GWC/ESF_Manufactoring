import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Command,
  Building2,
  RefreshCw,
  SlidersHorizontal,
  Menu,
  Calendar,
  LogIn,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { useEhs } from '../../context/EhsContext';

interface TopNavigationProps {
  onOpenCommandPalette: () => void;
  onOpenNotifications: () => void;
  onOpenIngestModal: () => void;
  onOpenMobileSidebar?: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  onOpenCommandPalette,
  onOpenNotifications,
  onOpenIngestModal,
  onOpenMobileSidebar,
}) => {
  const {
    authUser,
    signOut,
    eventSummary,
    facilityId,
    setFacilityId,
    isLoading,
    reloadAllData,
    overviewSummary,
    unreadNotificationsCount,
  } = useEhs();
  const navigate = useNavigate();

  const dateWindowLabel =
    eventSummary?.date_range?.start && eventSummary?.date_range?.end
      ? `${eventSummary.date_range.start.slice(0, 10)} → ${eventSummary.date_range.end.slice(0, 10)}`
      : null;

  const totalRows = overviewSummary
    ? overviewSummary.total_ehs_events +
      overviewSummary.total_workforce_records +
      overviewSummary.total_maintenance_work_orders
    : null;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-2 h-14 px-3 sm:px-6 bg-canvas-surface/95 backdrop-blur-md border-b border-line-subtle">
      {/* Left: Mobile Drawer Trigger, Command Search, Plant Filter */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        {onOpenMobileSidebar && (
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="p-2 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-canvas-muted lg:hidden shrink-0 focus-ring"
            aria-label="Open navigation sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        {/* Quick Command Search */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 text-xs text-ink-muted bg-canvas-subtle hover:bg-canvas-muted rounded-lg border border-line-subtle transition-colors w-36 sm:w-52 md:w-60 text-left min-w-0 focus-ring"
          aria-label="Open global command search"
        >
          <Search className="w-3.5 h-3.5 text-ink-muted shrink-0" />
          <span className="truncate">Search records...</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-ink-muted bg-canvas-surface border border-line-subtle rounded shrink-0">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>

        {/* Plant Selector */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-canvas-subtle border border-line-subtle text-xs shrink-0">
          <Building2 className="w-3.5 h-3.5 text-brand-primary shrink-0" />
          <label htmlFor="top-plant-selector" className="text-ink-muted text-[11px] font-medium hidden lg:inline">
            Plant:
          </label>
          <select
            id="top-plant-selector"
            value={facilityId}
            onChange={e => setFacilityId(e.target.value)}
            className="bg-transparent font-semibold text-xs text-ink-primary focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Plants (Fleet)</option>
            <option value="IN-KA-01">IN-KA-01 (Karnataka)</option>
            <option value="IN-TN-01">IN-TN-01 (Tamil Nadu)</option>
          </select>
        </div>

        {/* Grounded Dataset Date Window Pill */}
        {dateWindowLabel && (
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-canvas-subtle border border-line-subtle text-xs text-ink-secondary shrink-0 whitespace-nowrap">
            <Calendar className="w-3.5 h-3.5 text-brand-blue shrink-0" />
            <span className="font-mono text-[11px] font-medium text-ink-primary">{dateWindowLabel}</span>
          </div>
        )}
      </div>

      {/* Right: Row Telemetry, Refresh, Data Lineage, Session, Notifications */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-canvas-subtle border border-line-subtle text-xs font-mono whitespace-nowrap shrink-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-severity-success-dot" />
          </span>
          <span className="font-semibold text-ink-primary tabular-nums">
            {totalRows !== null ? `${totalRows.toLocaleString('en-IN')} Rows` : 'Syncing'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => reloadAllData()}
          disabled={isLoading}
          className="p-2 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-canvas-muted border border-line-subtle transition-colors disabled:opacity-50 shrink-0 focus-ring"
          title="Reload verified records from Neon PostgreSQL"
          aria-label="Reload verified records"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-brand-primary' : ''}`} />
        </button>

        <button
          type="button"
          onClick={onOpenIngestModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-canvas-subtle hover:bg-canvas-muted text-ink-primary border border-line-subtle transition-colors shrink-0 whitespace-nowrap focus-ring"
          title="Inspect Data Dictionary & Neon Ingestion Lineage"
          aria-label="Data Lineage"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-brand-orange shrink-0" />
          <span className="hidden lg:inline">Data Lineage</span>
        </button>

        {authUser ? (
          <div className="hidden sm:flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-canvas-subtle border border-line-subtle text-xs shrink-0">
            <UserCheck className="w-3.5 h-3.5 text-severity-success-dot shrink-0" />
            <span className="font-medium text-ink-primary max-w-[110px] truncate">{authUser.full_name}</span>
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate('/');
              }}
              className="p-1 rounded text-ink-muted hover:text-severity-critical-text hover:bg-severity-critical-bg transition-colors focus-ring"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-canvas-surface hover:bg-canvas-subtle text-ink-primary border border-line-default transition-colors shrink-0 focus-ring"
          >
            <LogIn className="w-3.5 h-3.5 text-brand-primary" />
            <span>Sign In</span>
          </Link>
        )}

        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative p-2 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-canvas-muted border border-line-subtle transition-colors shrink-0 focus-ring"
          title="Safety System Alerts"
          aria-label="Open safety notifications"
        >
          <Bell className="w-4 h-4 text-ink-secondary" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand-orange text-white font-mono text-[9px] font-bold flex items-center justify-center">
              {unreadNotificationsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
