import React, { useState, useMemo } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';
import { api } from '../api/client.js';

export default function ScheduleTracker() {
  const { dashboardData, refresh, currentUser } = useProject();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMilestone, setSelectedMilestone] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [onlyCriticalPath, setOnlyCriticalPath] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [baselineAlertModal, setBaselineAlertModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const tasks = dashboardData?.tasks || [];
  const milestones = dashboardData?.milestones || [];

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedMilestone !== 'ALL' && t.milestone_id !== selectedMilestone) return false;
      if (selectedStatus !== 'ALL' && t.task_status !== selectedStatus) return false;
      if (onlyCriticalPath && !t.is_critical_path) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchId = t.task_id.toLowerCase().includes(query);
        const matchName = t.name.toLowerCase().includes(query);
        const matchOwner = (t.owner || '').toLowerCase().includes(query);
        if (!matchId && !matchName && !matchOwner) return false;
      }
      return true;
    });
  }, [tasks, selectedMilestone, selectedStatus, onlyCriticalPath, searchTerm]);

  const handleOpenEdit = (task) => {
    setEditingTask(task);
    setEditFormData({
      owner_forecast_finish: task.owner_forecast_finish || '',
      percent_complete: task.percent_complete || 0,
      actual_start: task.actual_start || '',
      actual_finish: task.actual_finish || '',
      variance_cause: task.variance_cause || '',
      recovery_action: task.recovery_action || '',
      recovery_date: task.recovery_date || '',
      comments: task.comments || '',
      rebaseline_required: task.rebaseline_required ? true : false,
      rebaseline_reason: task.rebaseline_reason || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    try {
      setSaving(true);
      await api.updateTask(editingTask.id, {
        ...editFormData,
        updated_by: currentUser.display_name,
      });
      await refresh();
      setEditingTask(null);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBaselineAttempt = () => {
    setBaselineAlertModal(true);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Granular Schedule Tracker</h1>
          <div className="breadcrumb">
            Comprehensive PMP Activity Register &bull; Float, CPM, Variances, &amp; Governance
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-bar" style={{ background: 'var(--color-bg-card)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search by ID, task name, or owner..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="form-select"
          style={{ width: '180px', height: '34px', fontSize: 'var(--font-size-xs)' }}
          value={selectedMilestone}
          onChange={(e) => setSelectedMilestone(e.target.value)}
        >
          <option value="ALL">All Milestones</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.milestone_id} - {m.name}
            </option>
          ))}
        </select>

        <select
          className="form-select"
          style={{ width: '180px', height: '34px', fontSize: 'var(--font-size-xs)' }}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="ON TRACK">ON TRACK</option>
          <option value="AT RISK">AT RISK</option>
          <option value="DELAYED">DELAYED</option>
          <option value="COMPLETED - ON TIME">COMPLETED - ON TIME</option>
          <option value="COMPLETED - LATE">COMPLETED - LATE</option>
          <option value="RECOVERED">RECOVERED</option>
          <option value="FORECAST REQUIRED">FORECAST REQUIRED</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
          <input
            type="checkbox"
            checked={onlyCriticalPath}
            onChange={(e) => setOnlyCriticalPath(e.target.checked)}
          />
          <strong>Critical Path Only (TF ≤ 0)</strong>
        </label>

        <div style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          Showing <strong>{filteredTasks.length}</strong> of {tasks.length} tasks
        </div>
      </div>

      {/* Main Schedule Table */}
      <div className="data-table-container" style={{ marginTop: 'var(--space-4)', maxHeight: '68vh' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '70px' }}>Task ID</th>
              <th style={{ minWidth: '220px' }}>Task Name</th>
              <th>Owner</th>
              <th>Orig BL Finish</th>
              <th>Curr BL Finish</th>
              <th>Actual Start</th>
              <th>Actual Finish</th>
              <th>Forecast Finish</th>
              <th className="cell-number">% Done</th>
              <th className="cell-number">Var vs Curr (WD)</th>
              <th className="cell-number">Total Float</th>
              <th className="cell-number">Free Float</th>
              <th>Critical?</th>
              <th>Task Status</th>
              <th>Impact to Finish</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan="16" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                  No tasks match the active filters.
                </td>
              </tr>
            ) : (
              filteredTasks.map((t) => {
                const isLate = (t.forecast_variance_current_wd || 0) > 0;
                const isEarly = (t.forecast_variance_current_wd || 0) < 0;
                return (
                  <tr key={t.id} className={t.is_critical_path ? 'critical-path' : ''}>
                    <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{t.task_id}</td>
                    <td style={{ fontWeight: 500 }} title={t.name}>
                      {t.name}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{t.owner || '—'}</td>
                    
                    {/* Baseline Columns with Lock warning on click */}
                    <td
                      onClick={handleBaselineAttempt}
                      style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}
                      title="Locked Baseline. Click to see governance rules."
                    >
                      {t.original_baseline_finish || '—'} 🔒
                    </td>
                    <td
                      onClick={handleBaselineAttempt}
                      style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}
                      title="Locked Current Baseline. Click to see governance rules."
                    >
                      {t.current_baseline_finish || '—'} 🔒
                    </td>

                    {/* Actuals */}
                    <td style={{ color: t.actual_start ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                      {t.actual_start || '—'}
                    </td>
                    <td style={{ color: t.actual_finish ? 'var(--color-green)' : 'var(--color-text-muted)', fontWeight: t.actual_finish ? 600 : 400 }}>
                      {t.actual_finish || '—'}
                    </td>

                    {/* Forecast */}
                    <td style={{ color: t.owner_forecast_finish ? 'var(--color-blue)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                      {t.actual_finish ? '—' : (t.owner_forecast_finish || 'Required')}
                    </td>

                    {/* % Done */}
                    <td className="cell-number">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <div style={{ width: '40px', background: 'var(--color-bg-input)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${t.percent_complete || 0}%`, background: t.percent_complete >= 100 ? 'var(--color-green)' : 'var(--color-accent)', height: '100%' }} />
                        </div>
                        <span>{t.percent_complete || 0}%</span>
                      </div>
                    </td>

                    {/* Variance */}
                    <td className={`cell-number variance-cell ${isLate ? 'variance-positive' : isEarly ? 'variance-negative' : 'variance-zero'}`}>
                      {t.forecast_variance_current_wd !== null && t.forecast_variance_current_wd !== undefined ? (
                        `${t.forecast_variance_current_wd > 0 ? '+' : ''}${t.forecast_variance_current_wd} WD`
                      ) : '—'}
                    </td>

                    {/* Float */}
                    <td className="cell-number" style={{ color: t.total_float <= 0 ? 'var(--color-red)' : 'var(--color-text-secondary)', fontWeight: t.total_float <= 0 ? 700 : 400 }}>
                      {t.total_float !== null && t.total_float !== undefined ? `${t.total_float} WD` : 'N/A'}
                    </td>
                    <td className="cell-number" style={{ color: 'var(--color-text-muted)' }}>
                      {t.free_float !== null && t.free_float !== undefined ? `${t.free_float} WD` : 'N/A'}
                    </td>

                    {/* Critical */}
                    <td style={{ textAlign: 'center' }}>
                      {t.is_critical_path ? (
                        <span style={{ color: 'var(--color-red)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>⚡ YES</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>No</span>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      <StatusBadge status={t.task_status} />
                    </td>

                    {/* Impact */}
                    <td>
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: t.schedule_impact > 0 ? 'var(--color-red)' : 'var(--color-green)',
                        fontWeight: 600
                      }}>
                        {t.schedule_impact > 0 ? `+${t.schedule_impact} WD` : '0 WD'}
                      </span>
                    </td>

                    {/* Action */}
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                        onClick={() => handleOpenEdit(t)}
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Task Update Modal */}
      {editingTask && (
        <Modal
          isOpen={true}
          onClose={() => setEditingTask(null)}
          title={`Update Task: ${editingTask.task_id} - ${editingTask.name}`}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditingTask(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save & Recalculate'}
              </button>
            </>
          }
        >
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Current Baseline Finish (Immutable)</label>
              <input
                type="text"
                className="form-input"
                value={editingTask.current_baseline_finish || 'N/A'}
                disabled
                style={{ background: 'var(--color-bg-tertiary)', opacity: 0.7 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Owner Forecast Finish</label>
              <input
                type="date"
                className="form-input"
                value={editFormData.owner_forecast_finish}
                onChange={(e) => setEditFormData({ ...editFormData, owner_forecast_finish: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">% Complete</label>
              <input
                type="number"
                min="0"
                max="100"
                className="form-input"
                value={editFormData.percent_complete}
                onChange={(e) => setEditFormData({ ...editFormData, percent_complete: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Actual Finish Date (if completed)</label>
              <input
                type="date"
                className="form-input"
                value={editFormData.actual_finish}
                onChange={(e) => setEditFormData({ ...editFormData, actual_finish: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Variance Cause (if delayed/at risk)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Vendor delivery delay, Scope clarification"
              value={editFormData.variance_cause}
              onChange={(e) => setEditFormData({ ...editFormData, variance_cause: e.target.value })}
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Recovery Action Plan</label>
              <input
                type="text"
                className="form-input"
                placeholder="Mitigating task or crash strategy"
                value={editFormData.recovery_action}
                onChange={(e) => setEditFormData({ ...editFormData, recovery_action: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Recovery Target Date</label>
              <input
                type="date"
                className="form-input"
                value={editFormData.recovery_date}
                onChange={(e) => setEditFormData({ ...editFormData, recovery_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Comments / Weekly Progress Note</label>
            <textarea
              className="form-textarea"
              placeholder="Progress update for weekly executive briefing..."
              value={editFormData.comments}
              onChange={(e) => setEditFormData({ ...editFormData, comments: e.target.value })}
            />
          </div>

          <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-amber)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editFormData.rebaseline_required}
                onChange={(e) => setEditFormData({ ...editFormData, rebaseline_required: e.target.checked })}
              />
              Flag for Formal Rebaseline / Change Control
            </label>
            {editFormData.rebaseline_required && (
              <input
                type="text"
                className="form-input"
                style={{ marginTop: 'var(--space-2)' }}
                placeholder="Reason (approved scope/dependency change — NOT simply 'task is late')"
                value={editFormData.rebaseline_reason}
                onChange={(e) => setEditFormData({ ...editFormData, rebaseline_reason: e.target.value })}
              />
            )}
          </div>
        </Modal>
      )}

      {/* Baseline Immortality Rule Warning Modal */}
      <Modal
        isOpen={baselineAlertModal}
        onClose={() => setBaselineAlertModal(false)}
        title="🛡️ Baseline Governance Rule Enforced"
        footer={
          <button className="btn btn-primary" onClick={() => setBaselineAlertModal(false)}>
            Understood
          </button>
        }
      >
        <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>
          <p style={{ marginBottom: 'var(--space-3)' }}>
            <strong>RULE 1 &amp; RULE 6:</strong> Baseline dates (Original &amp; Current Baseline) are formal governance commitments and <strong>cannot be directly overwritten</strong> from the scheduler.
          </p>
          <ul style={{ paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
            <li>Original Baseline is permanently immutable.</li>
            <li>Current Baseline can only be modified via an approved <strong>Change Control / Rebaseline Request</strong>.</li>
            <li>Weekly schedule progression must be captured via <strong>Owner Forecast Finish</strong>.</li>
          </ul>
          <div style={{ padding: 'var(--space-3)', background: 'var(--color-blue-bg)', border: '1px solid var(--color-blue-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-accent)' }}>
            💡 To submit a formal baseline change request, go to the <strong>Change Control</strong> module in the left sidebar.
          </div>
        </div>
      </Modal>
    </div>
  );
}
