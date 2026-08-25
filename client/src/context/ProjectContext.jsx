import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState({
    id: 'demo-admin',
    username: 'admin',
    display_name: 'PMO Director',
    role: 'ADMIN',
  });

  // Load project list
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.getProjects();
      setProjects(list || []);
      if (list && list.length > 0) {
        if (!activeProjectId || !list.find(p => p.id === activeProjectId)) {
          setActiveProjectId(list[0].id);
        }
      } else {
        setActiveProjectId(null);
        setDashboardData(null);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  // Load dashboard data for active project
  const loadDashboard = useCallback(async (projectId) => {
    const id = projectId || activeProjectId;
    if (!id) {
      setDashboardData(null);
      return;
    }
    try {
      setLoading(true);
      const data = await api.getDashboard(id);
      setDashboardData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (activeProjectId) {
      loadDashboard(activeProjectId);
    }
  }, [activeProjectId, loadDashboard]);

  const selectProject = (id) => {
    setActiveProjectId(id);
  };

  const refresh = async () => {
    if (activeProjectId) {
      await loadDashboard(activeProjectId);
      // Also reload projects in case name/status changed
      const list = await api.getProjects();
      setProjects(list || []);
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
    loadProjects,
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
