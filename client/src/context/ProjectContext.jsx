import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(() => {
    return localStorage.getItem('schedule_control_active_project') || null;
  });
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState({
    id: 'demo-admin',
    username: 'admin',
    display_name: 'PMO Director',
    role: 'ADMIN',
  });

  // Load dashboard data for a specific project ID
  const loadDashboard = useCallback(async (projectId) => {
    if (!projectId) {
      setDashboardData(null);
      return;
    }
    try {
      setLoading(true);
      const data = await api.getDashboard(projectId);
      setDashboardData(data);
      setError(null);
    } catch (err) {
      console.error(`Failed to load dashboard for ${projectId}:`, err);
      setError(err.message || 'Failed to load project dashboard.');
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize projects & active project on boot
  const initProjects = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.getProjects();
      setProjects(list || []);

      if (list && list.length > 0) {
        const savedId = localStorage.getItem('schedule_control_active_project');
        const validId = (savedId && list.some(p => p.id === savedId)) ? savedId : list[0].id;
        
        setActiveProjectId(validId);
        localStorage.setItem('schedule_control_active_project', validId);

        // Immediately fetch dashboard for active project before clearing loading
        const data = await api.getDashboard(validId);
        setDashboardData(data);
        setError(null);
      } else {
        setActiveProjectId(null);
        setDashboardData(null);
      }
    } catch (err) {
      console.error('Failed to initialize projects:', err);
      setError(err.message || 'Failed to connect to schedule control server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initProjects();
  }, [initProjects]);

  // Select project handler
  const selectProject = async (id) => {
    setActiveProjectId(id);
    localStorage.setItem('schedule_control_active_project', id);
    await loadDashboard(id);
  };

  const refresh = async () => {
    if (activeProjectId) {
      await loadDashboard(activeProjectId);
      const list = await api.getProjects();
      setProjects(list || []);
    } else {
      await initProjects();
    }
  };

  const switchRole = (newRole) => {
    setCurrentUser(prev => ({ ...prev, role: newRole }));
  };

  const value = {
    projects,
    activeProjectId,
    activeProject: projects.find(p => p.id === activeProjectId) || dashboardData?.project || null,
    dashboardData,
    loading,
    error,
    currentUser,
    selectProject,
    refresh,
    loadProjects: initProjects,
    switchRole,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
