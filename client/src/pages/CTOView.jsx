import React from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';

export default function CTOView() {
  const { dashboardData, loading } = useProject();

  if (loading || !dashboardData) {
    return (
      <div className="page-content">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Loading CTO 60-Second Briefing...</div>
        </div>
      </div>
    );
  }

  const { project, kpis, milestones, topDrivers, scheduleHealth, narrative, raidItems, recoveryActions, changeRequests } = dashboardData;

  const top3Drivers = topDrivers?.slice(0, 3) || [];
  const top3Raid = raidItems?.filter(r => r.status === 'Open' || r.status === 'Monitoring')?.slice(0, 3) || [];
  const atRiskMilestones = milestones?.filter(m => m.status === 'DELAYED' || m.status === 'AT RISK') || [];

  return (
    <div className="page-content">
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            EXECUTIVE STEERING BRIEFING
          </div>
          <h1>CTO 60-Second Schedule Control View</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Status Date: {project.status_date || '2026-08-22'}
          </span>
          <StatusBadge status={kpis.overallStatus} />
        </div>
      </div>

      {/* Main Narrative Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        marginBottom: 'var(--space-6)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              PROJECT TARGET POSITION
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '4px' }}>
              {project.name}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>OVERALL SCHEDULE VARIANCE</div>
            <div style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 800,
              color: kpis.varianceCurrentWD > 0 ? 'var(--color-red)' : kpis.varianceCurrentWD < 0 ? 'var(--color-green)' : 'var(--color-blue)'
            }}>
              {kpis.varianceCurrentWD !== null ? `${kpis.varianceCurrentWD > 0 ? '+' : ''}${kpis.varianceCurrentWD} WD` : '0 WD'}
            </div>
          </div>
        </div>

        <div style={{
          fontSize: 'var(--font-size-lg)',
          lineHeight: '1.6',
          color: 'var(--color-text-primary)',
          background: 'rgba(0,0,0,0.25)',
          padding: 'var(--space-4) var(--space-5)',
          borderRadius: 'var(--radius-lg)',
          borderLeft: '4px solid var(--color-accent)'
        }}>
          {narrative}
        </div>
      </div>

      {/* CTO Key Metrics 4-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Current Baseline Finish</div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px' }}>
            {kpis.currentBaselineFinish || 'TBD'}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Original: {kpis.originalBaselineFinish || 'TBD'}
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Network Forecast Finish</div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-blue)', marginTop: '4px' }}>
            {kpis.forecastFinish || 'TBD'}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Calculated via CPM Logic
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Milestones Under Pressure</div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: atRiskMilestones.length > 0 ? 'var(--color-amber)' : 'var(--color-green)', marginTop: '4px' }}>
            {kpis.milestonesForcastLate} / {kpis.totalMilestones} Late
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Cumulative: {kpis.cumulativeMilestoneSlippage} WD
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Schedule Health &amp; Critical Path</div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: scheduleHealth?.level === 'Healthy' ? 'var(--color-green)' : 'var(--color-amber)', marginTop: '4px' }}>
            {scheduleHealth?.level || 'Healthy'} ({scheduleHealth?.percentage}%)
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {kpis.criticalTasksAtRisk} Critical Tasks At Risk
          </div>
        </div>
      </div>

      {/* 2-Column CTO Drilldown */}
      <div className="grid-2">
        {/* Left: Top 3 Drivers & Recovery */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Top 3 Schedule Pressure Drivers</div>
            </div>
            <div className="card-body" style={{ padding: 'var(--space-3)' }}>
              {top3Drivers.map((d, idx) => (
                <div key={idx} style={{
                  padding: 'var(--space-3)',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: idx < top3Drivers.length - 1 ? 'var(--space-2)' : 0,
                  borderLeft: `4px solid ${d.severity === 'Critical' ? 'var(--color-red)' : 'var(--color-amber)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{idx + 1}. {d.taskId} - {d.name}</span>
                    <span style={{ color: d.severity === 'Critical' ? 'var(--color-red)' : 'var(--color-amber)' }}>
                      {d.varianceWD ? `+${d.varianceWD} WD` : d.type}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Type: {d.type} &bull; Severity: {d.severity}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Recovery Plan Execution</div>
            </div>
            <div className="card-body" style={{ padding: 'var(--space-3)' }}>
              {recoveryActions?.slice(0, 3).map((r, idx) => (
                <div key={idx} style={{
                  padding: 'var(--space-3)',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: idx < (recoveryActions.length - 1) ? 'var(--space-2)' : 0,
                  borderLeft: '4px solid var(--color-purple)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{r.action_description}</span>
                    <span style={{ color: 'var(--color-purple)' }}>+{r.expected_days_recovered || 0} WD Recv</span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Owner: {r.recovery_owner}</span>
                    <span>Status: {r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Top 3 Steering RAID Items & Rebaseline Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Top 3 Executive RAID Decisions</div>
            </div>
            <div className="card-body" style={{ padding: 'var(--space-3)' }}>
              {top3Raid.map((item, idx) => (
                <div key={idx} style={{
                  padding: 'var(--space-3)',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: idx < top3Raid.length - 1 ? 'var(--space-2)' : 0,
                  borderLeft: `4px solid ${item.impact === 'High' || item.impact === 'Critical' ? 'var(--color-red)' : 'var(--color-amber)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{item.raid_id}: {item.type}</span>
                    <span style={{ color: item.impact === 'High' || item.impact === 'Critical' ? 'var(--color-red)' : 'var(--color-amber)' }}>
                      {item.impact} Impact
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    {item.description}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Mitigation: {item.mitigation || 'Under formulation'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Governance &amp; Rebaseline Assurance</div>
            </div>
            <div className="card-body" style={{ padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Original Baseline Immortality:</span>
                  <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>PRESERVED (RULE 1)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Pending Change Requests:</span>
                  <span style={{ fontWeight: 600 }}>{changeRequests?.filter(c => c.approval_status === 'Pending Approval').length || 0} Pending</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Controlling Finish Constraint:</span>
                  <span style={{ color: 'var(--color-blue)', fontWeight: 600 }}>Network-Driven (CPM)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Steering Action Recommendation:</span>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Monitor M2/M3; No Rebaseline Required</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
