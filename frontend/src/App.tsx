import React, { useCallback, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import {
  BookOpen,
  Box,
  CalendarCheck,
  Cog,
  ShieldAlert,
  Users,
  Video,
  Wrench,
} from 'lucide-react';
import { EhsProvider } from './context/EhsContext';
import { AlertProvider } from './context/AlertContext';
import { ApplicationShell } from './components/layout/ApplicationShell';
import { ModuleTabs } from './components/layout/ModuleTabs';
import { RouteFilterPreset } from './types/ehs';

// Workspace Module Views
import { HomeView } from './views/HomeView';
import { DashboardView } from './views/DashboardView';
import { VideoMonitoringView } from './views/VideoMonitoringView';
import { DetectionHistoryView } from './views/DetectionHistoryView';
import { DigitalTwinView } from './views/DigitalTwinView';
import { WorkforceShiftsView } from './views/WorkforceShiftsView';
import { MaintenanceSafetyView } from './views/MaintenanceSafetyView';
import { TrainingComplianceView } from './views/TrainingComplianceView';
import { EhsAgentView } from './views/EhsAgentView';
import { DataConnectorsView } from './views/DataConnectorsView';

const OVERVIEW_TABS = [
  { to: '/overview/events', label: 'Events', icon: ShieldAlert },
  { to: '/overview/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/overview/machine', label: 'Machine', icon: Cog },
];

const OPERATIONS_TABS = [
  { to: '/operations/workforce', label: 'Workforce & Shifts', icon: Users },
  { to: '/operations/training', label: 'Training Matrix', icon: BookOpen },
  { to: '/operations/maintenance', label: 'Maintenance & Safety', icon: Wrench },
];

const WorkspaceRoutes: React.FC = () => {
  const [routePreset, setRoutePreset] = useState<RouteFilterPreset | null>(null);

  const applyPreset = useCallback((preset: Omit<RouteFilterPreset, 'token'> | null) => {
    setRoutePreset(preset ? { token: Date.now(), ...preset } : null);
  }, []);

  const wrapInShell = (node: React.ReactNode) => (
    <ApplicationShell onApplyPreset={applyPreset}>{node}</ApplicationShell>
  );

  return (
    <Routes>
      <Route path="/" element={wrapInShell(<HomeView />)} />

      {/* 1. Overview: one dashboard per table (events, attendance, machine) */}
      <Route path="/overview" element={<Navigate to="/overview/events" replace />} />
      <Route
        path="/overview/*"
        element={wrapInShell(
          <ModuleTabs tabs={OVERVIEW_TABS}>
            <Routes>
              <Route path="events" element={<DashboardView kind="events" />} />
              <Route path="attendance" element={<DashboardView kind="attendance" />} />
              <Route path="machine" element={<DashboardView kind="maintenance" />} />
              <Route path="*" element={<Navigate to="/overview/events" replace />} />
            </Routes>
          </ModuleTabs>
        )}
      />
      <Route path="/command-center" element={<Navigate to="/overview/events" replace />} />

      {/* 2. Safety Monitoring: Video Intelligence & 3D Facility Twin */}
      <Route
        path="/monitoring"
        element={wrapInShell(
          <ModuleTabs
            tabs={[
              { to: '/monitoring', label: 'Safety Video Intelligence', icon: Video },
              { to: '/monitoring/digital-twin', label: '3D Facility Twin', icon: Box },
            ]}
          >
            <VideoMonitoringView />
          </ModuleTabs>
        )}
      />
      <Route
        path="/monitoring/digital-twin"
        element={wrapInShell(
          <ModuleTabs
            tabs={[
              { to: '/monitoring', label: 'Safety Video Intelligence', icon: Video },
              { to: '/monitoring/digital-twin', label: '3D Facility Twin', icon: Box },
            ]}
          >
            <DigitalTwinView />
          </ModuleTabs>
        )}
      />
      <Route
        path="/monitoring/history"
        element={wrapInShell(
          <ModuleTabs
            tabs={[
              { to: '/monitoring', label: 'Safety Video Intelligence', icon: Video },
              { to: '/monitoring/digital-twin', label: '3D Facility Twin', icon: Box },
            ]}
          >
            <DetectionHistoryView />
          </ModuleTabs>
        )}
      />
      <Route path="/monitoring/video" element={<Navigate to="/monitoring" replace />} />

      {/* 4. EHS Agent */}
      <Route path="/ehs-agent" element={wrapInShell(<EhsAgentView />)} />
      <Route path="/agents" element={<Navigate to="/ehs-agent" replace />} />

      {/* Operations (Workforce, Training, Maintenance) */}
      <Route path="/operations" element={<Navigate to="/operations/workforce" replace />} />
      <Route
        path="/operations/*"
        element={wrapInShell(
          <ModuleTabs tabs={OPERATIONS_TABS}>
            <Routes>
              <Route path="workforce" element={<WorkforceShiftsView />} />
              <Route path="training" element={<TrainingComplianceView preset={routePreset} />} />
              <Route path="maintenance" element={<MaintenanceSafetyView preset={routePreset} />} />
              <Route path="*" element={<Navigate to="/operations/workforce" replace />} />
            </Routes>
          </ModuleTabs>
        )}
      />

      {/* Data Connectors */}
      <Route path="/connectors" element={wrapInShell(<DataConnectorsView />)} />
      <Route path="/insights/connectors" element={<Navigate to="/connectors" replace />} />
      <Route path="/settings/connectors" element={<Navigate to="/connectors" replace />} />

      {/* Fallback Redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <EhsProvider>
          <AlertProvider>
            <WorkspaceRoutes />
          </AlertProvider>
        </EhsProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}

export default App;
