import React, { useState, useMemo } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';

export default function GanttView() {
  const { dashboardData } = useProject();
  const [zoomLevel, setZoomLevel] = useState('Month'); // Day, Week, Month, Quarter
  const [selectedTask, setSelectedTask] = useState(null);

  const tasks = dashboardData?.tasks || [];
  const milestones = dashboardData?.milestones || [];
  const project = dashboardData?.project || {};

  // Determine overall timeline min & max
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    let min = new Date('2026-06-01');
    let max = new Date('2026-12-15');

    tasks.forEach((t) => {
      const dates = [
        t.original_baseline_start, t.original_baseline_finish,
        t.current_baseline_start, t.current_baseline_finish,
        t.actual_start, t.actual_finish,
        t.owner_forecast_finish
      ].filter(Boolean).map(d => new Date(d));

      dates.forEach(d => {
        if (d < min) min = d;
        if (d > max) max = d;
      });
    });

    const totalDays = Math.max(1, Math.round((max - min) / (1000 * 60 * 60 * 24)));
    return { timelineStart: min, timelineEnd: max, totalDays };
  }, [tasks]);

  const getPositionPercent = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const offset = (d - timelineStart) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.min(100, (offset / totalDays) * 100));
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Interactive Gantt Schedule</h1>
          <div className="breadcrumb">
            Multi-Layer Timeline &bull; Baseline vs Forecast vs Actual &bull; Critical Path Overlay
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Zoom:</span>
          {['Day', 'Week', 'Month', 'Quarter'].map((z) => (
            <button
              key={z}
              className={`btn btn-sm ${zoomLevel === z ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setZoomLevel(z)}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* Gantt Legend */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-4)',
        alignItems: 'center',
        background: 'var(--color-bg-card)',
        padding: 'var(--space-2) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-4)',
        fontSize: 'var(--font-size-xs)',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '16px', height: '4px', background: '#64748b', borderRadius: '2px' }}></span>
          <span>Baseline (Target Commitment)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '16px', height: '8px', background: 'var(--color-green)', borderRadius: '2px' }}></span>
          <span>Actual (Completed)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '16px', height: '8px', background: 'var(--color-blue)', borderRadius: '2px' }}></span>
          <span>Owner Forecast (On Track)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '16px', height: '8px', background: 'var(--color-red)', borderRadius: '2px' }}></span>
          <span>Critical Path (TF ≤ 0) / Delayed</span>
        </div>
      </div>

      {/* Gantt Container */}
      <div className="gantt-container" style={{ maxHeight: '70vh' }}>
        {/* Timeline Header */}
        <div className="gantt-header">
          <div style={{ width: '280px', minWidth: '280px', padding: '8px 12px', fontWeight: 600, fontSize: 'var(--font-size-xs)', borderRight: '1px solid var(--color-border)' }}>
            WBS / Activity Name
          </div>
          <div className="gantt-timeline" style={{ padding: '8px 12px', fontSize: 'var(--font-size-xs)', display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
            <span>Jun 2026</span>
            <span>Jul 2026</span>
            <span>Aug 2026</span>
            <span>Sep 2026</span>
            <span>Oct 2026</span>
            <span>Nov 2026</span>
            <span>Dec 2026</span>
          </div>
        </div>

        {/* Milestone Groups & Tasks */}
        {milestones.map((ms) => {
          const msTasks = tasks.filter(t => t.milestone_id === ms.id);
          return (
            <React.Fragment key={ms.id}>
              {/* Milestone Row */}
              <div className="gantt-row" style={{ background: 'var(--color-bg-tertiary)', fontWeight: 600 }}>
                <div className="gantt-task-label" style={{ color: 'var(--color-accent)' }}>
                  🏁 {ms.milestone_id} - {ms.name}
                </div>
                <div className="gantt-timeline">
                  {/* Milestone Marker */}
                  {(() => {
                    const pos = getPositionPercent(ms.actual_finish || ms.owner_forecast_finish || ms.current_baseline_finish);
                    if (pos === null) return null;
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${pos}%`,
                          top: '50%',
                          transform: 'translate(-50%, -50%) rotate(45deg)',
                          width: '12px',
                          height: '12px',
                          background: ms.status?.includes('COMPLETED') ? 'var(--color-green)' : (ms.status === 'DELAYED' ? 'var(--color-red)' : 'var(--color-amber)'),
                          border: '2px solid white',
                          zIndex: 3
                        }}
                        title={`${ms.milestone_id}: ${ms.status}`}
                      />
                    );
                  })()}
                </div>
              </div>

              {/* Task Rows */}
              {msTasks.map((t) => {
                const blStartPct = getPositionPercent(t.current_baseline_start || t.original_baseline_start);
                const blFinishPct = getPositionPercent(t.current_baseline_finish || t.original_baseline_finish);
                const actStartPct = getPositionPercent(t.actual_start);
                const actFinishPct = getPositionPercent(t.actual_finish);
                const fcstFinishPct = getPositionPercent(t.owner_forecast_finish);

                const startPct = actStartPct !== null ? actStartPct : blStartPct;
                const endPct = actFinishPct !== null ? actFinishPct : (fcstFinishPct !== null ? fcstFinishPct : blFinishPct);

                const widthPct = startPct !== null && endPct !== null ? Math.max(1.5, endPct - startPct) : 2;
                const blWidthPct = blStartPct !== null && blFinishPct !== null ? Math.max(1.5, blFinishPct - blStartPct) : 2;

                let barColor = 'var(--color-blue)';
                if (t.actual_finish) barColor = 'var(--color-green)';
                else if (t.is_critical_path || t.task_status === 'DELAYED') barColor = 'var(--color-red)';
                else if (t.task_status === 'AT RISK') barColor = 'var(--color-amber)';
                else if (t.task_status === 'RECOVERED') barColor = 'var(--color-purple)';

                return (
                  <div
                    key={t.id}
                    className="gantt-row"
                    onClick={() => setSelectedTask(t)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="gantt-task-label">
                      <span style={{ color: t.is_critical_path ? 'var(--color-red)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                        {t.task_id}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                    </div>

                    <div className="gantt-timeline">
                      {/* Baseline Bar (Ghost) */}
                      {blStartPct !== null && (
                        <div
                          className="gantt-bar baseline"
                          style={{
                            left: `${blStartPct}%`,
                            width: `${blWidthPct}%`,
                          }}
                          title={`Baseline: ${t.current_baseline_start} to ${t.current_baseline_finish}`}
                        />
                      )}

                      {/* Execution/Forecast Bar */}
                      {startPct !== null && (
                        <div
                          className="gantt-bar"
                          style={{
                            left: `${startPct}%`,
                            width: `${widthPct}%`,
                            background: barColor,
                            boxShadow: t.is_critical_path ? '0 0 6px rgba(239, 68, 68, 0.4)' : 'none'
                          }}
                          title={`${t.task_id}: ${t.task_status} (${t.percent_complete}%)`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTask(null)}
          title={`Task Inspector: ${selectedTask.task_id} - ${selectedTask.name}`}
          footer={
            <button className="btn btn-primary" onClick={() => setSelectedTask(null)}>
              Close
            </button>
          }
        >
          <div className="grid-2" style={{ fontSize: 'var(--font-size-sm)' }}>
            <div>
              <p><strong>Owner:</strong> {selectedTask.owner || 'Unassigned'}</p>
              <p><strong>Status:</strong> <StatusBadge status={selectedTask.task_status} /></p>
              <p><strong>% Complete:</strong> {selectedTask.percent_complete || 0}%</p>
              <p><strong>Critical Path:</strong> {selectedTask.is_critical_path ? '⚡ YES (TF ≤ 0)' : 'No'}</p>
            </div>
            <div>
              <p><strong>Baseline:</strong> {selectedTask.current_baseline_start} to {selectedTask.current_baseline_finish}</p>
              <p><strong>Actual Dates:</strong> {selectedTask.actual_start || '—'} to {selectedTask.actual_finish || '—'}</p>
              <p><strong>Owner Forecast:</strong> {selectedTask.owner_forecast_finish || 'Required'}</p>
              <p><strong>Total Float:</strong> {selectedTask.total_float ?? 'N/A'} WD</p>
            </div>
          </div>

          {selectedTask.variance_cause && (
            <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
              <strong>Variance Cause:</strong> {selectedTask.variance_cause}
            </div>
          )}

          {selectedTask.recovery_action && (
            <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-purple-bg)', borderRadius: 'var(--radius-md)', color: 'var(--color-purple)' }}>
              <strong>Recovery Plan:</strong> {selectedTask.recovery_action} (Target: {selectedTask.recovery_date || 'TBD'})
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
