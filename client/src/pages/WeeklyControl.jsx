import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';
import { api } from '../api/client.js';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function WeeklyControl() {
  const { dashboardData, activeProjectId, refresh, currentUser } = useProject();
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const snapshots = dashboardData?.snapshots || [];
  const project = dashboardData?.project || {};
  const kpis = dashboardData?.kpis || {};

  // Forecast trajectory data for trend chart
  const trajectoryData = [...snapshots].reverse().map((s) => ({
    week: `Wk ${s.week_number || 1}`,
    date: s.status_date,
    forecastVariance: s.forecast_variance_current_wd || 0,
    cumulativeSlippage: s.cumulative_milestone_slippage || 0,
  }));

  // Add current state as the latest point
  trajectoryData.push({
    week: `Current (Wk ${snapshots.length + 1})`,
    date: project.status_date || 'Today',
    forecastVariance: kpis.varianceCurrentWD || 0,
    cumulativeSlippage: kpis.cumulativeMilestoneSlippage || 0,
  });

  const handleCloseReview = async () => {
    try {
      setCreating(true);
      await api.createSnapshot({
        project_id: activeProjectId,
        notes,
        created_by: currentUser.display_name,
      });
      await refresh();
      setSnapshotModalOpen(false);
      setNotes('');
      alert('Weekly schedule review snapshot successfully created and historical baseline preserved.');
    } catch (err) {
      alert('Failed to close review: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Weekly Schedule Snapshots &amp; Control</h1>
          <div className="breadcrumb">
            Weekly Review Governance &bull; Immutable Forecast Trajectory &bull; Trend Assurance
          </div>
        </div>
        <div>
          <button
            className="btn btn-primary"
            onClick={() => setSnapshotModalOpen(true)}
          >
            🔒 Close Weekly Review &amp; Create Snapshot
          </button>
        </div>
      </div>

      {/* Trajectory Chart Panel */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <div className="card-title">Weekly Forecast Trajectory (Stabilization &amp; Recovery Trend)</div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Working Days Delay Movement Over Weekly Cycles
          </span>
        </div>
        <div className="card-body" style={{ height: '280px', padding: 'var(--space-4)' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trajectoryData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} label={{ value: 'WD Variance', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', borderColor: '#334155', borderRadius: '6px', color: '#f8fafc' }}
              />
              <Line type="monotone" dataKey="forecastVariance" name="Project Finish Var (WD)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
              <Line type="monotone" dataKey="cumulativeSlippage" name="Cumulative Milestone Slip (WD)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Weekly Snapshot Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Historical Weekly Schedule Snapshots (Immutable Audit)</div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Preserving Week-on-Week Performance History
          </span>
        </div>
        <div className="data-table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Status Date</th>
                <th>Week #</th>
                <th>Current BL Finish</th>
                <th>Project Forecast</th>
                <th className="cell-number">Var vs BL (WD)</th>
                <th>Overall Status</th>
                <th>Top Driver</th>
                <th>Critical Risk</th>
                <th>Milestone Stats</th>
                <th>Cumulative Slip</th>
                <th>Executive Notes</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    No weekly snapshots recorded yet. Click "Close Weekly Review" to take the first snapshot.
                  </td>
                </tr>
              ) : (
                snapshots.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{s.status_date}</td>
                    <td>Wk {s.week_number || 1}</td>
                    <td>{s.current_baseline_finish || '—'}</td>
                    <td style={{ color: 'var(--color-blue)', fontWeight: 600 }}>{s.project_forecast_finish || '—'}</td>
                    <td className={`cell-number variance-cell ${s.forecast_variance_current_wd > 0 ? 'variance-positive' : s.forecast_variance_current_wd < 0 ? 'variance-negative' : 'variance-zero'}`}>
                      {s.forecast_variance_current_wd !== null ? `${s.forecast_variance_current_wd > 0 ? '+' : ''}${s.forecast_variance_current_wd} WD` : '0 WD'}
                    </td>
                    <td><StatusBadge status={s.overall_status} /></td>
                    <td style={{ fontSize: 'var(--font-size-xs)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.top_schedule_driver || '—'}
                    </td>
                    <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-red)' }}>
                      {s.critical_path_risk || 'None'}
                    </td>
                    <td style={{ fontSize: 'var(--font-size-xs)' }}>
                      <span style={{ color: 'var(--color-green)' }}>{s.milestones_on_track || 0} On Track</span> / <span style={{ color: 'var(--color-amber)' }}>{s.milestones_delayed || 0} Late</span>
                    </td>
                    <td className="cell-number" style={{ color: 'var(--color-amber)', fontWeight: 600 }}>
                      {s.cumulative_milestone_slippage || 0} WD
                    </td>
                    <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Confirmation Modal */}
      <Modal
        isOpen={snapshotModalOpen}
        onClose={() => setSnapshotModalOpen(false)}
        title="🔒 Close Weekly Review &amp; Create Snapshot"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setSnapshotModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCloseReview} disabled={creating}>
              {creating ? 'Saving Snapshot...' : 'Confirm & Save Weekly Snapshot'}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>
          <p style={{ marginBottom: 'var(--space-3)' }}>
            Closing the weekly review will freeze the current schedule calculations, forecast dates, and milestone statuses into an immutable weekly snapshot (<strong>Week {snapshots.length + 1}</strong>).
          </p>
          <div className="form-group">
            <label className="form-label">PMO Weekly Review Notes / Commentary</label>
            <textarea
              className="form-textarea"
              placeholder="Record steering highlights, critical milestones completed, or notable escalations for this weekly review cycle..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
