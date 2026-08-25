import React from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import KPICard from '../components/common/KPICard.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const { dashboardData, loading, error, activeProject } = useProject();

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Loading Executive Schedule Control Dashboard...</div>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="page-content">
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>⚠️</div>
          <h2>No Project Data Available</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            {error || 'Please upload an Excel project plan or select an existing project.'}
          </p>
        </div>
      </div>
    );
  }

  const { project, kpis, milestones, topDrivers, scheduleHealth, narrative, raidItems, recoveryActions, alerts } = dashboardData;

  // Chart data for milestone variances
  const chartData = (milestones || []).map((m) => ({
    name: m.milestone_id,
    fullName: m.name,
    variance: m.forecast_variance_wd || 0,
    status: m.status,
  }));

  const getKPIStatusColor = (status) => {
    if (!status) return 'gray';
    const s = status.toUpperCase();
    if (s.includes('ON TIME') || s === 'ON TRACK') return 'green';
    if (s.includes('PROTECTED')) return 'blue';
    if (s.includes('AT RISK') || s.includes('COMPLETED - LATE')) return 'amber';
    if (s.includes('DELAYED')) return 'red';
    if (s.includes('RECOVERED')) return 'purple';
    return 'gray';
  };

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Executive Schedule Dashboard</h1>
          <div className="breadcrumb">
            {project.name} &bull; Status Date: {project.status_date || 'Current'} &bull; Governed Baseline Model
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <StatusBadge status={kpis.overallStatus} />
          <span className="status-badge" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
            Health: {scheduleHealth?.level || 'Healthy'} ({scheduleHealth?.percentage || 0}%)
          </span>
        </div>
      </div>

      {/* Critical Alerts Banner if any */}
      {alerts && alerts.length > 0 && (
        <div style={{
          background: 'var(--color-red-bg)',
          border: '1px solid var(--color-red-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3) var(--space-4)',
          marginBottom: 'var(--space-5)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)'
        }}>
          <span style={{ fontSize: '1.25rem' }}>🚨</span>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-red)' }}>
            <strong>Active Governance Alerts:</strong> {alerts.length} unacknowledged condition(s) requiring PMO attention.
          </div>
        </div>
      )}

      {/* Executive Auto Narrative */}
      <div className="narrative-panel">
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>
          Executive Schedule Narrative (Auto-Generated)
        </div>
        <div className="narrative-text">
          {narrative}
        </div>
      </div>

      {/* Top 13 KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          label="Overall Project Status"
          value={kpis.overallStatus}
          status={getKPIStatusColor(kpis.overallStatus)}
          sub="Governed Status Engine"
        />
        <KPICard
          label="Project Forecast Finish"
          value={kpis.forecastFinish || 'TBD'}
          status="blue"
          sub={`Baseline: ${kpis.currentBaselineFinish || 'TBD'}`}
        />
        <KPICard
          label="Forecast Var vs Curr BL"
          value={kpis.varianceCurrentWD !== null ? `${kpis.varianceCurrentWD > 0 ? '+' : ''}${kpis.varianceCurrentWD} WD` : 'N/A'}
          status={kpis.varianceCurrentWD > 0 ? 'red' : kpis.varianceCurrentWD < 0 ? 'green' : 'blue'}
          sub="Working Days to Project Finish"
        />
        <KPICard
          label="Var vs Original BL"
          value={kpis.varianceOriginalWD !== null ? `${kpis.varianceOriginalWD > 0 ? '+' : ''}${kpis.varianceOriginalWD} WD` : 'N/A'}
          status={kpis.varianceOriginalWD > 0 ? 'red' : 'blue'}
          sub="Historical Commitment Var"
        />
        <KPICard
          label="Milestones Forecast Late"
          value={`${kpis.milestonesForcastLate} / ${kpis.totalMilestones}`}
          status={kpis.milestonesForcastLate > 0 ? 'amber' : 'green'}
          sub="Milestone-level breach count"
        />
        <KPICard
          label="Cumulative Slippage"
          value={`${kpis.cumulativeMilestoneSlippage} WD`}
          status={kpis.cumulativeMilestoneSlippage > 0 ? 'amber' : 'green'}
          sub="Sum of milestone delays (≠ Project Delay)"
        />
        <KPICard
          label="Max Milestone Var"
          value={`+${kpis.maxMilestoneVariance} WD`}
          status={kpis.maxMilestoneVariance > 10 ? 'red' : 'amber'}
          sub="Single highest milestone slip"
        />
        <KPICard
          label="Critical Tasks At Risk"
          value={kpis.criticalTasksAtRisk}
          status={kpis.criticalTasksAtRisk > 0 ? 'red' : 'green'}
          sub="Float <= 0 & Delayed/At Risk"
        />
        <KPICard
          label="Tasks Needing Forecast"
          value={kpis.tasksRequiringForecast}
          status={kpis.tasksRequiringForecast > 0 ? 'gray' : 'green'}
          sub="Open tasks with blank forecast"
        />
        <KPICard
          label="Recovery Achieved"
          value={kpis.recoveryAchieved}
          status={kpis.recoveryAchieved > 0 ? 'purple' : 'gray'}
          sub="Tasks recovered back in tolerance"
        />
        <KPICard
          label="Completed Late Tasks"
          value={kpis.completedLate}
          status={kpis.completedLate > 0 ? 'amber' : 'green'}
          sub="Actual Finish > Baseline Finish"
        />
        <KPICard
          label="Rebaseline Required"
          value={kpis.rebaselineRequired}
          status={kpis.rebaselineRequired > 0 ? 'amber' : 'green'}
          sub="Formal CR flags raised"
        />
      </div>

      {/* Grid: Milestone Schedule Table & Variance Chart */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-6)', gridTemplateColumns: '1.4fr 0.8fr' }}>
        {/* Milestone Schedule Control Table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Milestone Schedule Control</div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Controlling network roll-up
            </span>
          </div>
          <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th>Name</th>
                  <th>Curr BL Finish</th>
                  <th>Actual Finish</th>
                  <th>Forecast Finish</th>
                  <th className="cell-number">Var (WD)</th>
                  <th>Status</th>
                  <th>Impact to Finish</th>
                </tr>
              </thead>
              <tbody>
                {(milestones || []).map((m) => {
                  const isLate = (m.forecast_variance_wd || 0) > 0;
                  const isEarly = (m.forecast_variance_wd || 0) < 0;
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{m.milestone_id}</td>
                      <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.name}>
                        {m.name}
                      </td>
                      <td>{m.current_baseline_finish || '—'}</td>
                      <td style={{ color: m.actual_finish ? 'var(--color-green)' : 'var(--color-text-muted)' }}>
                        {m.actual_finish || '—'}
                      </td>
                      <td style={{ color: m.owner_forecast_finish || m.calculated_forecast_finish ? 'var(--color-blue)' : 'var(--color-text-muted)' }}>
                        {m.actual_finish ? '—' : (m.owner_forecast_finish || m.calculated_forecast_finish || 'Required')}
                      </td>
                      <td className={`cell-number variance-cell ${isLate ? 'variance-positive' : isEarly ? 'variance-negative' : 'variance-zero'}`}>
                        {m.forecast_variance_wd !== null ? `${m.forecast_variance_wd > 0 ? '+' : ''}${m.forecast_variance_wd} WD` : '—'}
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
                          {m.impact_to_project_finish > 0 ? `+${m.impact_to_project_finish} WD` : '0 WD (Absorbed)'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Milestone Forecast Variance Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Milestone Variance vs Baseline (WD)</div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              + Delay / - Ahead
            </span>
          </div>
          <div className="card-body" style={{ height: '320px', padding: 'var(--space-4)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '8px 12px', borderRadius: '6px' }}>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{d.name}: {d.fullName}</div>
                          <div style={{ color: d.variance > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                            Variance: {d.variance > 0 ? `+${d.variance}` : d.variance} Working Days
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            Status: {d.status}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="variance" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => {
                    let fill = '#10b981';
                    if (entry.variance > 5) fill = '#ef4444';
                    else if (entry.variance > 0) fill = '#f59e0b';
                    else if (entry.status && entry.status.includes('COMPLETED - LATE')) fill = '#f59e0b';
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid: Top Drivers, Active Recoveries, Decisions Required */}
      <div className="grid-3">
        {/* Top Schedule Drivers */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Top Schedule Drivers</div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-red)' }}>Pressure Areas</span>
          </div>
          <div className="card-body" style={{ padding: 'var(--space-3)' }}>
            {topDrivers && topDrivers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {topDrivers.slice(0, 4).map((d, i) => (
                  <div key={i} style={{
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `3px solid ${d.severity === 'Critical' ? 'var(--color-red)' : 'var(--color-amber)'}`,
                    fontSize: 'var(--font-size-xs)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>{d.taskId} - {d.name}</span>
                      <span style={{ color: d.severity === 'Critical' ? 'var(--color-red)' : 'var(--color-amber)' }}>
                        {d.varianceWD ? `+${d.varianceWD} WD` : (d.totalFloat !== undefined ? `TF: ${d.totalFloat} WD` : d.type)}
                      </span>
                    </div>
                    <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Type: {d.type} &bull; Severity: {d.severity}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', padding: 'var(--space-3)' }}>
                No critical schedule drivers identified.
              </div>
            )}
          </div>
        </div>

        {/* Recovery Tracking */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recovery Actions</div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-purple)' }}>Mitigation</span>
          </div>
          <div className="card-body" style={{ padding: 'var(--space-3)' }}>
            {recoveryActions && recoveryActions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {recoveryActions.map((r, i) => (
                  <div key={i} style={{
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '3px solid var(--color-purple)',
                    fontSize: 'var(--font-size-xs)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                        {r.action_description}
                      </span>
                      <span style={{ color: 'var(--color-purple)' }}>
                        +{r.expected_days_recovered || 0} WD Recv
                      </span>
                    </div>
                    <div style={{ color: 'var(--color-text-muted)', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Owner: {r.recovery_owner || 'Unassigned'}</span>
                      <span>Target: {r.recovery_date || 'TBD'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', padding: 'var(--space-3)' }}>
                No active recovery actions logged.
              </div>
            )}
          </div>
        </div>

        {/* Executive Decisions & Top Risks */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Steering Decisions &amp; Risks</div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-amber)' }}>Governance</span>
          </div>
          <div className="card-body" style={{ padding: 'var(--space-3)' }}>
            {raidItems && raidItems.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {raidItems.slice(0, 4).map((item, i) => (
                  <div key={i} style={{
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `3px solid ${item.impact === 'High' || item.impact === 'Critical' ? 'var(--color-red)' : 'var(--color-amber)'}`,
                    fontSize: 'var(--font-size-xs)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>{item.raid_id} ({item.type})</span>
                      <span style={{ color: item.impact === 'High' || item.impact === 'Critical' ? 'var(--color-red)' : 'var(--color-amber)' }}>
                        {item.impact} Impact
                      </span>
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', padding: 'var(--space-3)' }}>
                No open RAID items requiring immediate steering decision.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
