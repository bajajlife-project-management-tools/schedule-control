/**
 * API Client for Schedule Control & Project Governance
 */

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  } else if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const response = await fetch(url, config);
  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.blob();
}

export const api = {
  // Auth & Users
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  getUsers: () => request('/auth/users'),
  getCurrentUser: () => request('/auth/current'),

  // Projects
  getProjects: () => request('/projects'),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: data }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PATCH', body: data }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  getDashboard: (id) => request(`/projects/${id}/dashboard`),
  recalculateProject: (id) => request(`/projects/${id}/recalculate`, { method: 'POST' }),
  getSchedule: (id) => request(`/projects/${id}/schedule`),
  getMilestones: (id) => request(`/projects/${id}/milestones`),
  getDependencies: (id) => request(`/projects/${id}/dependencies`),

  // Tasks
  getTasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks${qs ? `?${qs}` : ''}`);
  },
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: data }),
  updateForecast: (id, data) => request(`/tasks/${id}/forecast`, { method: 'POST', body: data }),
  getForecastHistory: (id) => request(`/tasks/${id}/forecast-history`),
  bulkUpdateTasks: (updates) => request('/tasks/bulk-update', { method: 'POST', body: { updates } }),

  // RAID
  getRAID: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/raid${qs ? `?${qs}` : ''}`);
  },
  createRAID: (data) => request('/raid', { method: 'POST', body: data }),
  updateRAID: (id, data) => request(`/raid/${id}`, { method: 'PATCH', body: data }),
  deleteRAID: (id) => request(`/raid/${id}`, { method: 'DELETE' }),

  // Change Control / Rebaseline
  getChangeRequests: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/change-requests${qs ? `?${qs}` : ''}`);
  },
  createChangeRequest: (data) => request('/change-requests', { method: 'POST', body: data }),
  approveChangeRequest: (id, data) => request(`/change-requests/${id}/approve`, { method: 'POST', body: data }),
  rejectChangeRequest: (id, data) => request(`/change-requests/${id}/reject`, { method: 'POST', body: data }),
  updateChangeRequest: (id, data) => request(`/change-requests/${id}`, { method: 'PATCH', body: data }),

  // Weekly Snapshots
  getSnapshots: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/snapshots${qs ? `?${qs}` : ''}`);
  },
  createSnapshot: (data) => request('/snapshots', { method: 'POST', body: data }),

  // Calendar
  getCalendar: (projectId) => request(`/calendar/${projectId}`),
  updateCalendar: (projectId, data) => request(`/calendar/${projectId}`, { method: 'PATCH', body: data }),
  addHoliday: (projectId, data) => request(`/calendar/${projectId}/holidays`, { method: 'POST', body: data }),
  deleteHoliday: (projectId, id) => request(`/calendar/${projectId}/holidays/${id}`, { method: 'DELETE' }),

  // Audit
  getAuditLog: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/audit${qs ? `?${qs}` : ''}`);
  },

  // Import / Export
  parseExcel: (formData) => request('/import/parse', { method: 'POST', body: formData }),
  detectColumns: (headers) => request('/import/detect-columns', { method: 'POST', body: { headers } }),
  validateImport: (rows, mapping) => request('/import/validate', { method: 'POST', body: { rows, mapping } }),
  executeImport: (data) => request('/import/execute', { method: 'POST', body: data }),
  exportExcelUrl: (projectId) => `/api/import/export/${projectId}`,
};
