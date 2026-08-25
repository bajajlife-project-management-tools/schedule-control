import React from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import { api } from '../api/client.js';

export default function ExecutiveReports() {
  const { dashboardData, activeProjectId } = useProject();

  if (!dashboardData) return null;

  const { project, kpis, milestones, topDrivers, scheduleHealth, narrative, raidItems, recoveryActions, changeRequests } = dashboardData;

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!activeProjectId) return;
    window.location.href = api.exportExcelUrl(activeProjectId);
  };

  return (
    <div className="page-content">
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1>Weekly Executive Governance Report</h1>
          <div className="breadcrumb">
            CTO / CIO &bull; Steering Committee Ready &bull; 10-Point Schedule Assurance Report
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary" onClick={handleExportExcel}>
            📥 Export Excel Pack
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Report Container */}
      <div className="card" style={{ padding: 'var(--space-8)', background: '#0b1120', border: '1px solid var(--color-border)' }}>
        {/* Header Block */}
        <div style={{ borderBottom: '2px solid var(--color-border)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              EXECUTIVE SCHEDULE GOVERNANCE REPORT
            </div>
            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginTop: '4px' }}>
              {project.name}
            </h2>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Project Manager: {project.project_manager || 'PMO'} &bull; Status Date: {project.status_date || '2026-08-22'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <StatusBadge status={kpis.overallStatus} />
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '6px' }}>
              Health Index: {scheduleHealth?.level} ({scheduleHealth?.percentage}%)
            </div>
          </div>
        </div>

        {/* Section 1: Executive Summary & Narrative */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
            1. Executive Schedule Position &amp; Narrative
          </h3>
          <div style={{ padding: 'var(--space-4)', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', lineHeight: 1.7, fontSize: 'var(--font-size-sm)' }}>
            {narrative}
          </div>
        </div>

        {/* Section 2: Overall Schedule Position Table */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
            2. Core Schedule Metrics &amp; Commitments
          </h3>
          <div className="grid-4" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ background: 'var(--color-bg-card)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>ORIGINAL COMMITMENT</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', marginTop: '2px' }}>{kpis.originalBaselineFinish || 'TBD'}</div>
            </div>
            <div style={{ background: 'var(--color-bg-card)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>CURRENT BASELINE</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', marginTop: '2px' }}>{kpis.currentBaselineFinish || 'TBD'}</div>
            </div>
            <div style={{ background: 'var(--color-bg-card)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>NETWORK FORECAST</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-blue)', marginTop: '2px' }}>{kpis.forecastFinish || 'TBD'}</div>
            </div>
            <div style={{ background: 'var(--color-bg-card)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>OVERALL PROJECT VARIANCE</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: kpis.varianceCurrentWD > 0 ? 'var(--color-red)' : 'var(--color-green)', marginTop: '2px' }}>
                {kpis.varianceCurrentWD !== null ? `${kpis.varianceCurrentWD > 0 ? '+' : ''}${kpis.varianceCurrentWD} WD` : '0 WD'}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Milestone Schedule Table */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
            3. Milestone Control Register
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Milestone</th>
                <th>Name</th>
                <th>Baseline Finish</th>
                <th>Actual Finish</th>
                <th>Forecast Finish</th>
                <th className="cell-number">Variance</th>
                <th>Status</th>
                <th>Management Message</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 700 }}>{m.milestone_id}</td>
                  <td>{m.name}</td>
                  <td>{m.current_baseline_finish}</td>
                  <td>{m.actual_finish || '—'}</td>
                  <td>{m.actual_finish ? '—' : (m.owner_forecast_finish || m.calculated_forecast_finish)}</td>
                  <td className={`cell-number variance-cell ${m.forecast_variance_wd > 0 ? 'variance-positive' : m.forecast_variance_wd < 0 ? 'variance-negative' : 'variance-zero'}`}>
                    {m.forecast_variance_wd !== null ? `${m.forecast_variance_wd > 0 ? '+' : ''}${m.forecast_variance_wd} WD` : '—'}
                  </td>
                  <td><StatusBadge status={m.status} /></td>
                  <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{m.management_message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 4 & 5: Top Drivers & Active Recoveries */}
        <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-red)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
              4. Top Schedule Pressure Drivers
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {topDrivers.slice(0, 3).map((d, i) => (
                <div key={i} style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)' }}>
                  <strong>{d.taskId} - {d.name}</strong> ({d.type}) — <span style={{ color: 'var(--color-red)' }}>{d.varianceWD ? `+${d.varianceWD} WD` : d.severity}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-purple)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
              5. Recovery Actions Tracked
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {recoveryActions.map((r, i) => (
                <div key={i} style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)' }}>
                  <strong>{r.action_description}</strong> — <span style={{ color: 'var(--color-purple)' }}>+{r.expected_days_recovered || 0} WD Recv</span> (Target: {r.recovery_date || 'TBD'})
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 6 & 7: Steering RAID & Decisions */}
        <div className="grid-2">
          <div>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-amber)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
              6. Critical Steering RAID Items
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {raidItems.slice(0, 3).map((item, i) => (
                <div key={i} style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)' }}>
                  <strong>{item.raid_id} ({item.type}):</strong> {item.description}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
              7. Governance Decisions Required
            </h3>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', lineHeight: 1.6 }}>
              • Steering Committee approval on fast-tracked procurement vendor onboarding.<br />
              • Review data engineering contractor augmentation proposal by 15-Sep.<br />
              • Confirm hypercare stabilization exit criteria for go-live on 27-Nov.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
