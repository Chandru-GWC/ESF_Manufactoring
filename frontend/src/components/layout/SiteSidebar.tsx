import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  Cpu,
  Database,
  Home,
  LayoutDashboard,
  Menu,
  Video,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { useAlerts } from '../../context/AlertContext';

interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Route prefixes that mark this item active. */
  prefixes: string[];
}

export const PRIMARY_NAV: NavItem[] = [
  { id: 'home', label: 'Home', to: '/', icon: Home, prefixes: [] },
  { id: 'overview', label: 'Overview', to: '/overview', icon: LayoutDashboard, prefixes: ['/overview'] },
  { id: 'monitoring', label: 'Safety Monitoring', to: '/monitoring', icon: Video, prefixes: ['/monitoring'] },
  { id: 'agents', label: 'EHS Agent', to: '/ehs-agent', icon: Cpu, prefixes: ['/ehs-agent', '/agents'] },
  { id: 'connectors', label: 'Data Connectors', to: '/connectors', icon: Database, prefixes: ['/connectors'] },
];

interface SiteSidebarProps {
  onOpenNotifications: () => void;
}

export const SiteSidebar: React.FC<SiteSidebarProps> = ({ onOpenNotifications }) => {
  const { unreadCount, unreadCriticalOrHigh } = useAlerts();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const isActive = (item: NavItem) =>
    item.id === 'home' ? location.pathname === '/' : item.prefixes.some(p => location.pathname.startsWith(p));
  const iconBtn =
    'text-ink-secondary hover:text-ink-primary hover:bg-canvas-muted border-line-subtle min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-lg border transition-colors focus-ring';

  const bellButton = (extra: string) => (
    <button
      type="button"
      onClick={onOpenNotifications}
      className={`relative ${iconBtn} ${extra}`}
      aria-label={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : 'Open notifications'}
      title="Notifications"
    >
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <span
          className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-white font-mono text-[9px] font-bold flex items-center justify-center ${
            unreadCriticalOrHigh > 0 ? 'bg-brand-orange ring-2 ring-white' : 'bg-ink-secondary'
          }`}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );

  const bell = bellButton('');
  const sidebarBody = (
    <>
      <div className="h-16 shrink-0 px-4 flex items-center justify-between border-b border-line-subtle">
        <BrandMark tone="dark" onClick={() => setMenuOpen(false)} />
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="lg:hidden p-2 rounded-lg text-ink-secondary hover:bg-canvas-subtle focus-ring"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {PRIMARY_NAV.map(item => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 px-2.5 min-h-[38px] rounded-lg text-sm font-semibold transition-colors focus-ring ${
                active
                  ? 'text-brand-primary bg-brand-subtle'
                  : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

    </>
  );

  return (
    <>
      {/* Desktop: fixed left sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-52 flex-col bg-canvas-surface border-r border-line-subtle text-ink-primary">
        {sidebarBody}
      </aside>

      {/* Desktop: notification bell, always in the top-right corner on every page */}
      <div className="hidden lg:block fixed top-2.5 right-4 z-40">
        {bellButton('bg-canvas-surface shadow-sm-subtle !min-w-[38px] !min-h-[38px]')}
      </div>

      {/* Mobile / tablet: compact top bar + slide-over drawer */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 px-4 flex items-center justify-between bg-canvas-surface/95 backdrop-blur-md border-b border-line-subtle text-ink-primary">
        <BrandMark tone="dark" />
        <div className="flex items-center gap-1.5">
          {bell}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={iconBtn}
            aria-label="Open navigation"
            aria-expanded={menuOpen}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <aside className="w-72 max-w-[85vw] flex flex-col bg-canvas-surface text-ink-primary shadow-2xl">
            {sidebarBody}
          </aside>
          <button
            type="button"
            className="flex-1 bg-black/40"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          />
        </div>
      )}
    </>
  );
};
