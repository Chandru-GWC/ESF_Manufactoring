import React, { useCallback, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import {
  AlertOctagon,
  BookOpen,
  Bot,
  Box,
  CheckSquare,
  ClipboardList,
  FileText,
  Flame,
  HardHat,
  KeyRound,
  Settings,
  Users,
  Video,
  Wrench,
} from 'lucide-react';
import { EhsProvider } from './context/EhsContext';
import { ApplicationShell, SECTION_TO_PATH } from './components/layout/ApplicationShell';
import { ModuleTabs } from './components/layout/ModuleTabs';
import { NavSection, RouteFilterPreset } from './types/ehs';

// Public Entry Views
import { LandingPage } from './views/LandingPage';
import { LoginView } from './views/LoginView';

// Workspace Module Views
import { OverviewView } from './views/OverviewView';
import { DigitalTwinView } from './views/DigitalTwinView';
import { HazardMonitoringView } from './views/HazardMonitoringView';
import { IncidentManagementView } from './views/IncidentManagementView';
import { WorkforceShiftsView } from './views/WorkforceShiftsView';
import { MaintenanceSafetyView } from './views/MaintenanceSafetyView';
import { CorrectiveActionsView } from './views/CorrectiveActionsView';
import { PermitLotoComplianceView } from './views/PermitLotoComplianceView';
import { InspectionsAuditsView } from './views/InspectionsAuditsView';
import { RiskRegisterView } from './views/RiskRegisterView';
import { TrainingComplianceView } from './views/TrainingComplianceView';
import { VideoMonitoringView } from './views/VideoMonitoringView';
import { AISafetyAssistantView } from './views/AISafetyAssistantView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';

const WorkspaceRoutes: React.FC = () => {
  const navigate = useNavigate();
  const [routePreset, setRoutePreset] = useState<RouteFilterPreset | null>(null);

  const applyPreset = useCallback((preset: Omit<RouteFilterPreset, 'token'> | null) => {
    setRoutePreset(preset ? { token: Date.now(), ...preset } : null);
  }, []);

  const navigateToSection = useCallback(
    (section: NavSection, preset?: Omit<RouteFilterPreset, 'token'>) => {
      applyPreset(preset ?? null);
      navigate(SECTION_TO_PATH[section] || '/overview');
    },
    [applyPreset, navigate]
  );

  const openIngestModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent('ehs:open-lineage'));
  }, []);

  const wrapInShell = (node: React.ReactNode) => (
    <ApplicationShell onApplyPreset={applyPreset}>{node}</ApplicationShell>
  );

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginView />} />

      {/* 1. Command Center */}
      <Route
        path="/overview"
        element={wrapInShell(
          <OverviewView onOpenIngestModal={openIngestModal} onNavigate={navigateToSection} />
        )}
      />
      <Route path="/command-center" element={<Navigate to="/overview" replace />} />

      {/* 2. Safety Monitoring */}
      <Route path="/monitoring" element={<Navigate to="/monitoring/video" replace />} />
      <Route
        path="/monitoring/*"
        element={wrapInShell(
          <ModuleTabs
            tabs={[
              { to: '/monitoring/video', label: 'Safety Video Intelligence', icon: Video },
              { to: '/monitoring/digital-twin', label: '3D Facility Twin', icon: Box },
            ]}
          >
            <Routes>
              <Route path="video" element={<VideoMonitoringView />} />
              <Route path="digital-twin" element={<DigitalTwinView />} />
              <Route path="*" element={<Navigate to="/monitoring/video" replace />} />
            </Routes>
          </ModuleTabs>
        )}
      />

      {/* 3. Events & Incidents */}
      <Route path="/events" element={<Navigate to="/events/hazards" replace />} />
      <Route
        path="/events/*"
        element={wrapInShell(
          <ModuleTabs
            tabs={[
              { to: '/events/hazards', label: 'Hazard Monitoring', icon: Flame },
              { to: '/events/incidents', label: 'Incident Management', icon: AlertOctagon },
              { to: '/events/risks', label: 'Risk Register', icon: HardHat },
            ]}
          >
            <Routes>
              <Route path="hazards" element={<HazardMonitoringView preset={routePreset} />} />
              <Route path="incidents" element={<IncidentManagementView preset={routePreset} />} />
              <Route path="risks" element={<RiskRegisterView preset={routePreset} />} />
              <Route path="*" element={<Navigate to="/events/hazards" replace />} />
            </Routes>
          </ModuleTabs>
        )}
      />

      {/* 4. Prevention & CAPA */}
      <Route path="/prevention" element={<Navigate to="/prevention/capa" replace />} />
      <Route
        path="/prevention/*"
        element={wrapInShell(
          <ModuleTabs
            tabs={[
              { to: '/prevention/capa', label: 'Corrective Actions (CAPA)', icon: CheckSquare },
              { to: '/prevention/permits', label: 'Permit & LOTO', icon: KeyRound },
              { to: '/prevention/audits', label: 'Inspections & Audits', icon: ClipboardList },
            ]}
          >
            <Routes>
              <Route path="capa" element={<CorrectiveActionsView preset={routePreset} />} />
              <Route path="permits" element={<PermitLotoComplianceView />} />
              <Route path="audits" element={<InspectionsAuditsView />} />
              <Route path="*" element={<Navigate to="/prevention/capa" replace />} />
            </Routes>
          </ModuleTabs>
        )}
      />

      {/* 5. Operations */}
      <Route path="/operations" element={<Navigate to="/operations/workforce" replace />} />
      <Route
        path="/operations/*"
        element={wrapInShell(
          <ModuleTabs
            tabs={[
              { to: '/operations/workforce', label: 'Workforce & Shifts', icon: Users },
              { to: '/operations/training', label: 'Training Matrix', icon: BookOpen },
              { to: '/operations/maintenance', label: 'Maintenance & Safety', icon: Wrench },
            ]}
          >
            <Routes>
              <Route path="workforce" element={<WorkforceShiftsView />} />
              <Route path="training" element={<TrainingComplianceView preset={routePreset} />} />
              <Route path="maintenance" element={<MaintenanceSafetyView preset={routePreset} />} />
              <Route path="*" element={<Navigate to="/operations/workforce" replace />} />
            </Routes>
          </ModuleTabs>
        )}
      />

      {/* 6. Insights & Administration */}
      <Route path="/insights" element={<Navigate to="/insights/assistant" replace />} />
      <Route
        path="/insights/*"
        element={wrapInShell(
          <ModuleTabs
            tabs={[
              { to: '/insights/assistant', label: 'AI Safety Assistant', icon: Bot },
              { to: '/insights/reports', label: 'Reports & Export', icon: FileText },
              { to: '/insights/settings', label: 'System Settings', icon: Settings },
            ]}
          >
            <Routes>
              <Route path="assistant" element={<AISafetyAssistantView />} />
              <Route path="reports" element={<ReportsView />} />
              <Route path="settings" element={<SettingsView />} />
              <Route path="*" element={<Navigate to="/insights/assistant" replace />} />
            </Routes>
          </ModuleTabs>
        )}
      />

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
          <WorkspaceRoutes />
        </EhsProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}

export default App;
