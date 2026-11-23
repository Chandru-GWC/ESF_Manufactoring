import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { SiteSidebar } from './SiteSidebar';
import { CommandPaletteModal } from '../common/CommandPaletteModal';
import { NotificationPanel } from '../ui/NotificationPanel';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { NavSection, RouteFilterPreset } from '../../types/ehs';
import { useAlerts } from '../../context/AlertContext';
import { AlertCenterDrawer } from '../alerts/AlertCenterDrawer';
import { AlertDetailPanel } from '../alerts/AlertDetailPanel';
import { PAGE_VARIANTS } from '../../lib/motion';

export const SECTION_TO_PATH: Record<NavSection, string> = {
  overview: '/overview/events',
  'video-monitoring': '/monitoring',
  'digital-twin': '/monitoring/digital-twin',
  hazards: '/overview',
  incidents: '/overview',
  risks: '/overview',
  actions: '/overview',
  permits: '/overview',
  inspections: '/overview',
  'workforce-shifts': '/operations/workforce',
  training: '/operations/training',
  'maintenance-safety': '/operations/maintenance',
  'ai-assistant': '/ehs-agent',
  'agent-architecture': '/overview',
  reports: '/overview',
  settings: '/overview',
  connectors: '/connectors',
};

interface ApplicationShellProps {
  onApplyPreset: (preset: Omit<RouteFilterPreset, 'token'> | null) => void;
  children: React.ReactNode;
}

export const ApplicationShell: React.FC<ApplicationShellProps> = ({
  onApplyPreset,
  children,
}) => {
  const { notifications, unreadCount, markRead, markAllRead, openAlert, openAlertCenter } = useAlerts();
  const location = useLocation();
  const navigate = useNavigate();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const navigateToSection = useCallback(
    (section: NavSection, preset?: Omit<RouteFilterPreset, 'token'>) => {
      onApplyPreset(preset ?? null);
      navigate(SECTION_TO_PATH[section] || '/overview');
    },
    [navigate, onApplyPreset]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="min-h-screen bg-canvas-app text-ink-primary font-sans overflow-x-hidden">
      <SiteSidebar
        onOpenNotifications={() => setIsNotificationOpen(prev => !prev)}
      />

      <main className="pt-14 lg:pt-0 lg:pl-52">
        <div className="p-4 sm:p-6 lg:p-8 w-full">
          <motion.div
            key={location.pathname}
            variants={PAGE_VARIANTS}
            initial="hidden"
            animate="visible"
          >
            <ErrorBoundary key={location.pathname} scope="This view">
              {children}
            </ErrorBoundary>
          </motion.div>
        </div>
      </main>

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={section => {
          navigateToSection(section);
          setIsCommandPaletteOpen(false);
        }}
      />

      <NotificationPanel
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAllAsRead={markAllRead}
        onViewAll={() => {
          setIsNotificationOpen(false);
          openAlertCenter();
        }}
        onSelectNotification={item => {
          markRead([item.notification_id]);
          setIsNotificationOpen(false);
          if (item.target_type === 'alert' && item.alert_id) {
            openAlert(item.alert_id);
          } else if (item.target_type === 'alert') {
            openAlertCenter();
          } else {
            navigateToSection('hazards');
          }
        }}
      />

      {/* Mounted once so alerts open from any route, from every route */}
      <AlertCenterDrawer />
      <AlertDetailPanel />
    </div>
  );
};
