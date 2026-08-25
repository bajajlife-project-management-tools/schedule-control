import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProjectProvider } from './context/ProjectContext.jsx';
import Sidebar from './components/common/Sidebar.jsx';
import Header from './components/common/Header.jsx';

import Dashboard from './pages/Dashboard.jsx';
import CTOView from './pages/CTOView.jsx';
import ScheduleTracker from './pages/ScheduleTracker.jsx';
import MilestoneControl from './pages/MilestoneControl.jsx';
import GanttView from './pages/GanttView.jsx';
import CriticalPathView from './pages/CriticalPathView.jsx';
import WeeklyControl from './pages/WeeklyControl.jsx';
import RAIDManagement from './pages/RAIDManagement.jsx';
import ChangeControl from './pages/ChangeControl.jsx';
import ImportWizard from './pages/ImportWizard.jsx';
import ExecutiveReports from './pages/ExecutiveReports.jsx';
import ProjectSettings from './pages/ProjectSettings.jsx';
import AuditLogView from './pages/AuditLogView.jsx';

export default function App() {
  return (
    <ProjectProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <div className="main-content">
            <Header />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/cto-view" element={<CTOView />} />
              <Route path="/schedule" element={<ScheduleTracker />} />
              <Route path="/milestones" element={<MilestoneControl />} />
              <Route path="/gantt" element={<GanttView />} />
              <Route path="/critical-path" element={<CriticalPathView />} />
              <Route path="/weekly-control" element={<WeeklyControl />} />
              <Route path="/raid" element={<RAIDManagement />} />
              <Route path="/change-control" element={<ChangeControl />} />
              <Route path="/import" element={<ImportWizard />} />
              <Route path="/reports" element={<ExecutiveReports />} />
              <Route path="/settings" element={<ProjectSettings />} />
              <Route path="/audit-log" element={<AuditLogView />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </ProjectProvider>
  );
}
