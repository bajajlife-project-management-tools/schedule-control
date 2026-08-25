import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import { api } from '../api/client.js';

export default function AuditLogView() {
  const { activeProjectId } = useProject();
  const [logs, setLogs] = useState([]);
  const [filterSource, setFilterSource] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (activeProjectId) {
      api.getAuditLog({ project_id: activeProjectId, limit: 200 }).then(setLogs).catch(console.error);
    }
  }, [activeProjectId]);

  const filteredLogs = logs.filter((l) => {
    if (filterSource !== 'ALL' && l.source !== filterSource) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchEntity = (l.entity_type || '').toLowerCase().includes(q);
      const matchAction = (l.action || '').toLowerCase().includes(q);
      const matchField = (l.field_changed || '').toLowerCase().includes(q);
      const matchUser = (l.user_name || '').toLowerCase().includes(q);
      if (!matchEntity && !matchAction && !matchField && !matchUser) return false;
    }
    return true;
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Schedule &amp; Baseline Audit Trail</h1>
          <div className="breadcrumb">
            Immutable Audit of Baseline, Forecast, Actuals, Rebaseline &amp; Steering Actions (Rule 27)
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ background: 'var(--color-bg-card)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
        <input
          type="text"
          className="search-input"
          placeholder="Filter audit log by entity, user, field..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="form-select"
          style={{ width: '200px', height: '34px', fontSize: 'var(--font-size-xs)' }}
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
        >
          <option value="ALL">All Sources</option>
          <option value="Owner Update">Owner Update</option>
          <option value="PMO Update">PMO Update</option>
          <option value="Change Control">Change Control</option>
          <option value="System Calculation">System Calculation</option>
          <option value="Import">Import</option>
        </select>

        <div style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          Showing <strong>{filteredLogs.length}</strong> audit records
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card" style={{ marginTop: 'var(--space-4)' }}>
        <div className="data-table-container" style={{ border: 'none', maxHeight: '68vh' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User / Actor</th>
                <th>Entity Type</th>
                <th>Action</th>
                <th>Field Changed</th>
                <th>Old Value</th>
                <th>New Value</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    No audit records match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {log.created_at}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {log.user_name || 'System Engine'}
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'var(--color-bg-tertiary)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600
                      }}>
                        {log.entity_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{log.action}</td>
                    <td style={{ color: 'var(--color-accent)', fontSize: 'var(--font-size-xs)' }}>
                      {log.field_changed || '—'}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.old_value || '—'}
                    </td>
                    <td style={{ color: 'var(--color-green)', fontSize: 'var(--font-size-xs)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.new_value || '—'}
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: 'var(--font-size-xs)',
                        background: log.source === 'Change Control' ? 'var(--color-blue-bg)' : (log.source === 'Owner Update' ? 'var(--color-purple-bg)' : 'var(--color-bg-tertiary)'),
                        color: log.source === 'Change Control' ? 'var(--color-accent)' : (log.source === 'Owner Update' ? 'var(--color-purple)' : 'var(--color-text-secondary)')
                      }}>
                        {log.source || 'Engine'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
