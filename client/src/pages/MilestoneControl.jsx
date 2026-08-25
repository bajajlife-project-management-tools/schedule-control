import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';

export default function MilestoneControl() {
  const { dashboardData } = useProject();
  const [selectedMilestone, setSelectedMilestone] = useState(null);

  const milestones = dashboardData?.milestones || [];
  const tasks = dashboardData?.tasks || [];

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Milestone Schedule Control</h1>
          <div className="breadcrumb">
            Executive Milestone Status &bull; Controlling Activity Analysis &bull; Management Messaging
          </div>
        </div>
      </div>

      {/* Milestone Table */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="data-table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Milestone</th>
                <th>Milestone Name</th>
                <th>Planned Start</th>
                <th>Actual Start</th>
                <th>Current BL Finish</th>
                <th>Actual Finish</th>
                <th>Owner Forecast</th>
                <th className="cell-number">Forecast Var (WD)</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Impact to Finish</th>
                <th>Management Message</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => {
                const isLate = (m.forecast_variance_wd || 0) > 0;
                const isEarly = (m.forecast_variance_wd || 0) < 0;
                const childTasks = tasks.filter((t) => t.milestone_id === m.id);

                return (
                  <tr
                    key={m.id}
                    style={{
                      background: selectedMilestone?.id === m.id ? 'var(--color-bg-hover)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedMilestone(selectedMilestone?.id === m.id ? null : m)}
                  >
                    <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{m.milestone_id}</td>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td>{m.original_baseline_start || '—'}</td>
                    <td>{m.actual_start || '—'}</td>
                    <td>{m.current_baseline_finish || '—'}</td>
                    <td style={{ color: m.actual_finish ? 'var(--color-green)' : 'var(--color-text-muted)', fontWeight: m.actual_finish ? 600 : 400 }}>
                      {m.actual_finish || '—'}
                    </td>
                    <td style={{ color: 'var(--color-blue)', fontWeight: 600 }}>
                      {m.actual_finish ? '—' : (m.owner_forecast_finish || m.calculated_forecast_finish || 'Required')}
                    </td>
                    <td className={`cell-number variance-cell ${isLate ? 'variance-positive' : isEarly ? 'variance-negative' : 'variance-zero'}`}>
                      {m.forecast_variance_wd !== null && m.forecast_variance_wd !== undefined ? (
                        `${m.forecast_variance_wd > 0 ? '+' : ''}${m.forecast_variance_wd} WD`
                      ) : '—'}
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>
                        {m.stage || 'In Progress'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td>
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: m.impact_to_project_finish > 0 ? 'var(--color-red)' : 'var(--color-green)',
                        fontWeight: 600
                      }}>
                        {m.impact_to_project_finish > 0 ? `+${m.impact_to_project_finish} WD` : '0 WD'}
                      </span>
                    </td>
                    <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.management_message || '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMilestone(selectedMilestone?.id === m.id ? null : m);
                        }}
                      >
                        {selectedMilestone?.id === m.id ? 'Hide Tasks' : `Drilldown (${childTasks.length})`}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Milestone Drilldown View */}
      {selectedMilestone && (
        <div className="card" style={{ animation: 'slideUp 0.2s ease' }}>
          <div className="card-header" style={{ background: 'var(--color-bg-tertiary)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontWeight: 700, textTransform: 'uppercase' }}>
                CONTROLLING ACTIVITIES DRILLDOWN
              </div>
              <div className="card-title" style={{ marginTop: '2px' }}>
                {selectedMilestone.milestone_id} - {selectedMilestone.name}
              </div>
            </div>
            <StatusBadge status={selectedMilestone.status} />
          </div>

          <div className="data-table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task ID</th>
                  <th>Activity Name</th>
                  <th>Owner</th>
                  <th>Curr BL Finish</th>
                  <th>Actual Finish</th>
                  <th>Forecast Finish</th>
                  <th className="cell-number">% Done</th>
                  <th className="cell-number">Var (WD)</th>
                  <th>Critical?</th>
                  <th>Status</th>
                  <th>Variance Cause</th>
                  <th>Recovery Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks
                  .filter((t) => t.milestone_id === selectedMilestone.id)
                  .map((t) => (
                    <tr key={t.id} className={t.is_critical_path ? 'critical-path' : ''}>
                      <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{t.task_id}</td>
                      <td style={{ fontWeight: 500 }}>{t.name}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{t.owner || '—'}</td>
                      <td>{t.current_baseline_finish || '—'}</td>
                      <td style={{ color: t.actual_finish ? 'var(--color-green)' : 'var(--color-text-muted)' }}>
                        {t.actual_finish || '—'}
                      </td>
                      <td style={{ color: 'var(--color-blue)', fontWeight: 600 }}>
                        {t.actual_finish ? '—' : (t.owner_forecast_finish || 'Required')}
                      </td>
                      <td className="cell-number">{t.percent_complete || 0}%</td>
                      <td className={`cell-number variance-cell ${t.forecast_variance_current_wd > 0 ? 'variance-positive' : t.forecast_variance_current_wd < 0 ? 'variance-negative' : 'variance-zero'}`}>
                        {t.forecast_variance_current_wd !== null ? `${t.forecast_variance_current_wd > 0 ? '+' : ''}${t.forecast_variance_current_wd} WD` : '—'}
                      </td>
                      <td>{t.is_critical_path ? '⚡ YES' : 'No'}</td>
                      <td><StatusBadge status={t.task_status} /></td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t.variance_cause || '—'}</td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-purple)' }}>{t.recovery_action || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
