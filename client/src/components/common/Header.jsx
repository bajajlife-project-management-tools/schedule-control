import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext.jsx';
import { api } from '../../api/client.js';

export default function Header() {
  const { projects, activeProjectId, selectProject, currentUser, switchRole, refresh } = useProject();
  const [recalculating, setRecalculating] = useState(false);

  const handleRecalculate = async () => {
    if (!activeProjectId) return;
    try {
      setRecalculating(true);
      await api.recalculateProject(activeProjectId);
      await refresh();
    } catch (err) {
      alert('Recalculation error: ' + err.message);
    } finally {
      setRecalculating(false);
    }
  };

  const handleExport = () => {
    if (!activeProjectId) return;
    window.location.href = api.exportExcelUrl(activeProjectId);
  };

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <label htmlFor="project-selector" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
          Project:
        </label>
        <select
          id="project-selector"
          className="form-select"
          style={{ width: '260px', padding: '4px 28px 4px 10px', height: '32px', fontSize: 'var(--font-size-sm)' }}
          value={activeProjectId || ''}
          onChange={(e) => selectProject(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleRecalculate}
          disabled={recalculating || !activeProjectId}
          title="Recalculate CPM network, float, variances and statuses"
        >
          {recalculating ? '⟳ Calculating...' : '⚡ Recalculate Network'}
        </button>
      </div>

      <div className="top-bar-right">
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleExport}
          disabled={!activeProjectId}
          title="Export complete schedule-control pack to 8-tab Excel"
        >
          📥 Export Excel Pack
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--color-border)', paddingLeft: '12px' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Role:</span>
          <select
            className="form-select"
            style={{ width: '150px', padding: '4px 24px 4px 8px', height: '30px', fontSize: 'var(--font-size-xs)' }}
            value={currentUser.role}
            onChange={(e) => switchRole(e.target.value)}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="PMO">PMO</option>
            <option value="PROJECT_MANAGER">PROJECT MANAGER</option>
            <option value="TASK_OWNER">TASK OWNER</option>
            <option value="EXECUTIVE">EXECUTIVE</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </div>
      </div>
    </header>
  );
}
