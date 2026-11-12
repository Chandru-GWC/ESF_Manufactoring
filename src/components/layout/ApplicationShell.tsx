import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AppSidebar, PrimaryModuleId } from './AppSidebar';
import { TopNavigation } from './TopNavigation';
import { DatasetIngestionModal } from '../common/DatasetIngestionModal';
import { CommandPaletteModal } from '../common/CommandPaletteModal';
import { NotificationPanel } from '../ui/NotificationPanel';
import { NavSection, RouteFilterPreset } from '../../types/ehs';
import { useEhs } from '../../context/EhsContext';
import { PAGE_VARIANTS } from '../../lib/motion';

export const SECTION_TO_PATH: Record<NavSection, string> = {
  overview: '/overview',
  'video-monitoring': '/monitoring/video',
  'digital-twin': '/monitoring/digital-twin',
  hazards: '/events/hazards',
  incidents: '/events/incidents',
  risks: '/events/risks',
  actions: '/prevention/capa',
  permits: '/prevention/permits',
  inspections: '/prevention/audits',
  'workforce-shifts': '/operations/workforce',
  training: '/operations/training',
  'maintenance-safety': '/operations/maintenance',
  'ai-assistant': '/insights/assistant',
  reports: '/insights/reports',
  settings: '/insights/settings',
};

export const MODULE_DEFAULT_PATH: Record<PrimaryModuleId, string> = {
  'command-center': '/overview',
  'safety-monitoring': '/monitoring/video',
  'events-incidents': '/events/hazards',
  'prevention-capa': '/prevention/capa',
  operations: '/operations/workforce',
  'insights-admin': '/insights/assistant',
};

function resolveActiveModule(pathname: string): PrimaryModuleId {
  if (pathname.startsWith('/monitoring')) return 'safety-monitoring';
  if (pathname.startsWith('/events')) return 'events-incidents';
  if (pathname.startsWith('/prevention')) return 'prevention-capa';
  if (pathname.startsWith('/operations')) return 'operations';
  if (pathname.startsWith('/insights')) return 'insights-admin';
  return 'command-center';
}

interface ApplicationShellProps {
  onApplyPreset: (preset: Omit<RouteFilterPreset, 'token'> | null) => void;
  children: React.ReactNode;
}

export const ApplicationShell: React.FC<ApplicationShellProps> = ({
  onApplyPreset,
  children,
}) => {
  const { notifications, markAllNotificationsRead, markNotificationRead } = useEhs();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const activeModule = resolveActiveModule(location.pathname);

  const navigateToSection = useCallback(
    (section: NavSection, preset?: Omit<RouteFilterPreset, 'token'>) => {
      onApplyPreset(preset ?? null);
      navigate(SECTION_TO_PATH[section] || '/overview');
    },
    [navigate, onApplyPreset]
  );

  const handleSelectModule = useCallback(
    (moduleId: PrimaryModuleId) => {
      onApplyPreset(null);
      navigate(MODULE_DEFAULT_PATH[moduleId]);
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
    const handleOpenIngest = () => setIsIngestModalOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('ehs:open-lineage', handleOpenIngest);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('ehs:open-lineage', handleOpenIngest);
    };
  }, []);

  return (
    <div className="min-h-screen bg-canvas-app text-ink-primary font-sans overflow-x-hidden">
      <AppSidebar
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        onOpenIngestModal={() => setIsIngestModalOpen(true)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div
        className={`flex flex-col min-h-screen transition-all duration-200 ${
          isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-[264px]'
        }`}
      >
        <TopNavigation
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenNotifications={() => setIsNotificationOpen(prev => !prev)}
          onOpenIngestModal={() => setIsIngestModalOpen(true)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          <motion.div
            key={location.pathname}
            variants={PAGE_VARIANTS}
            initial="hidden"
            animate="visible"
          >
            {children}
          </motion.div>
        </main>
      </div>

      <DatasetIngestionModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
      />

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
        onMarkAllAsRead={markAllNotificationsRead}
        onSelectNotification={item => {
          markNotificationRead(item.id);
          setIsNotificationOpen(false);
          if (item.id === 'alert-training-expired') {
            navigateToSection('training', { trainingStatus: 'EXPIRED' });
          } else {
            navigateToSection('hazards', {
              hazardSeverity: 'CRITICAL',
              hazardStatus: 'OPEN',
              hazardSearch: '',
              hazardCategory: 'ALL',
            });
          }
        }}
      />
    </div>
  );
};
