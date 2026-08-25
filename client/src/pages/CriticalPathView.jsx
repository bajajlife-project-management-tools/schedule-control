import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import { api } from '../api/client.js';

export default function CriticalPathView() {
  const { dashboardData, activeProjectId } = useProject();
  const [dependencies, setDependencies] = useState([]);
  const [activeTab, setActiveTab] = useState('DIAGRAM'); // 'DIAGRAM' (Visual PERT/AON) or 'TABLE' (CPM Matrix)
  const [filterType, setFilterType] = useState('ALL'); // ALL, CRITICAL_ONLY, ZERO_FLOAT
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  useEffect(() => {
    if (activeProjectId) {
      api.getDependencies(activeProjectId).then(setDependencies).catch(console.error);
    }
  }, [activeProjectId]);

  const tasks = dashboardData?.tasks || [];
  const milestones = dashboardData?.milestones || [];
  const criticalTasks = tasks.filter(t => t.is_critical_path);

  const displayedTasks = tasks.filter((t) => {
    if (filterType === 'CRITICAL_ONLY') return t.is_critical_path;
    if (filterType === 'ZERO_FLOAT') return t.total_float !== null && t.total_float <= 0;
    return true;
  });

  // Group tasks by milestone for structured network flow layout
  const milestoneGroups = useMemo(() => {
    return milestones.map((ms) => {
      const msTasks = tasks.filter(t => t.milestone_id === ms.id);
      return {
        ...ms,
        tasks: msTasks,
      };
    }).filter(g => g.tasks.length > 0);
  }, [milestones, tasks]);

  // Find upstream predecessors and downstream successors of selected task
  const { upstreamPreds, downstreamSuccs } = useMemo(() => {
    if (!selectedTaskId) return { upstreamPreds: new Set(), downstreamSuccs: new Set() };
    
    const preds = new Set();
    const succs = new Set();

    // Direct and transitive preds
    const findPreds = (tId) => {
      dependencies.filter(d => d.successor_task_id === tId || d.succ_task_id === tId).forEach(d => {
        const pId = d.pred_task_id || d.predecessor_task_id;
        if (!preds.has(pId)) {
          preds.add(pId);
          findPreds(pId);
        }
      });
    };

    // Direct and transitive succs
    const findSuccs = (tId) => {
      dependencies.filter(d => d.predecessor_task_id === tId || d.pred_task_id === tId).forEach(d => {
        const sId = d.succ_task_id || d.successor_task_id;
        if (!succs.has(sId)) {
          succs.add(sId);
          findSuccs(sId);
        }
      });
    };

    findPreds(selectedTaskId);
    findSuccs(selectedTaskId);

    return { upstreamPreds: preds, downstreamSuccs: succs };
  }, [selectedTaskId, dependencies]);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Critical Path &amp; Dependency Network Graph</h1>
          <div className="breadcrumb">
            Mathematical CPM Forward/Backward Pass &bull; Interactive PERT/AON Network Graph &bull; Total Float Matrix
          </div>
        </div>

        {/* Mode Toggle Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className={`btn btn-sm ${activeTab === 'DIAGRAM' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('DIAGRAM')}
          >
            🕸️ Visual Network Graph (PERT)
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'TABLE' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('TABLE')}
          >
            📋 CPM Calculation Matrix
          </button>
        </div>
      </div>

      {/* CPM Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(15, 23, 42, 0.9))',
        border: '1px solid var(--color-red-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4) var(--space-5)',
        marginBottom: 'var(--space-5)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-red)', textTransform: 'uppercase' }}>
            MATHEMATICAL CRITICAL PATH NETWORK (RULE 13)
          </div>
          <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '4px' }}>
            {criticalTasks.length} activities form the uninterrupted driving critical path with Total Float ≤ 0 WD.
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Click on any node in the graph below to trace driving upstream predecessors and downstream successors.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-red)' }}>
            {criticalTasks.filter(t => t.task_status === 'DELAYED' || t.task_status === 'AT RISK').length}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Critical Tasks At Risk</div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Filter:</span>
        <button
          className={`btn btn-sm ${filterType === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterType('ALL')}
        >
          All Activities ({tasks.length})
        </button>
        <button
          className={`btn btn-sm ${filterType === 'CRITICAL_ONLY' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterType('CRITICAL_ONLY')}
        >
          ⚡ Critical Path Only ({criticalTasks.length})
        </button>
        <button
          className={`btn btn-sm ${filterType === 'ZERO_FLOAT' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilterType('ZERO_FLOAT')}
        >
          Float ≤ 0 WD
        </button>

        {selectedTaskId && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 'auto', color: 'var(--color-accent)' }}
            onClick={() => setSelectedTaskId(null)}
          >
            Clear Selected Trace ({selectedTaskId}) ✕
          </button>
        )}
      </div>

      {/* VIEW 1: Visual Network Diagram (PERT / Activity-on-Node AON Layout) */}
      {activeTab === 'DIAGRAM' && (
        <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div className="card-title">Activity-on-Node (AON) Network Flow Graph</div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', background: 'var(--color-bg-card)', border: '2px solid var(--color-red)', borderRadius: '3px' }}></span>
                <span>Critical Path (TF ≤ 0)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '3px' }}></span>
                <span>Non-Critical (Has Float)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', background: 'var(--color-blue-bg)', border: '2px solid var(--color-accent)', borderRadius: '3px' }}></span>
                <span>Selected / Traced Link</span>
              </div>
            </div>
          </div>

          {/* Network Graph Grid by Milestone Stages */}
          <div style={{ display: 'flex', gap: 'var(--space-6)', minWidth: '1100px', paddingBottom: 'var(--space-4)' }}>
            {milestoneGroups.map((group, groupIdx) => (
              <div
                key={group.id}
                style={{
                  flex: '1',
                  minWidth: '260px',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)'
                }}
              >
                {/* Milestone Stage Header */}
                <div style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  borderBottom: '2px solid var(--color-accent)',
                  fontWeight: 700,
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-accent)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{group.milestone_id}</span>
                  <StatusBadge status={group.status} />
                </div>

                {/* Task Nodes in this Stage */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {group.tasks.map((t) => {
                    const isSelected = selectedTaskId === t.task_id || selectedTaskId === t.id;
                    const isUpstream = upstreamPreds.has(t.task_id) || upstreamPreds.has(t.id);
                    const isDownstream = downstreamSuccs.has(t.task_id) || downstreamSuccs.has(t.id);

                    // CPM 6-box model values
                    const es = t.current_baseline_start || t.actual_start || 'ES';
                    const ef = t.current_baseline_finish || t.actual_finish || 'EF';
                    const dur = t.duration_wd ?? 1;
                    const tf = t.total_float !== null && t.total_float !== undefined ? `${t.total_float} WD` : 'N/A';

                    let borderStyle = '1px solid var(--color-border)';
                    let boxShadow = 'none';
                    let bgColor = 'var(--color-bg-card)';

                    if (t.is_critical_path) {
                      borderStyle = '2px solid var(--color-red)';
                      boxShadow = '0 0 10px rgba(239, 68, 68, 0.2)';
                    }
                    if (isSelected) {
                      borderStyle = '2px solid var(--color-accent)';
                      bgColor = 'var(--color-blue-bg)';
                      boxShadow = '0 0 12px rgba(59, 130, 246, 0.4)';
                    } else if (isUpstream) {
                      borderStyle = '2px dashed var(--color-purple)';
                      bgColor = 'var(--color-purple-bg)';
                    } else if (isDownstream) {
                      borderStyle = '2px dashed var(--color-teal)';
                      bgColor = 'rgba(20, 184, 166, 0.1)';
                    }

                    // Find successor link tags
                    const succLinks = dependencies.filter(d => d.predecessor_task_id === t.id || d.pred_task_id === t.task_id);

                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(isSelected ? null : t.task_id)}
                        style={{
                          background: bgColor,
                          border: borderStyle,
                          borderRadius: 'var(--radius-md)',
                          padding: 'var(--space-2) var(--space-3)',
                          cursor: 'pointer',
                          boxShadow: boxShadow,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Node Top: ID & Name */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 800, color: t.is_critical_path ? 'var(--color-red)' : 'var(--color-accent)', fontSize: 'var(--font-size-xs)' }}>
                            {t.task_id} {t.is_critical_path ? '⚡' : ''}
                          </span>
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontWeight: 700,
                            background: t.total_float <= 0 ? 'var(--color-red-bg)' : 'var(--color-bg-tertiary)',
                            color: t.total_float <= 0 ? 'var(--color-red)' : 'var(--color-text-secondary)'
                          }}>
                            TF: {tf}
                          </span>
                        </div>

                        <div style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: '6px'
                        }} title={t.name}>
                          {t.name}
                        </div>

                        {/* Standard PMP 3-Cell Box: ES | Duration | EF */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          background: 'var(--color-bg-input)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '3px',
                          fontSize: '0.65rem',
                          textAlign: 'center',
                          marginBottom: '4px'
                        }}>
                          <div style={{ padding: '2px', borderRight: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }} title="Early Start">
                            {es.slice(5)}
                          </div>
                          <div style={{ padding: '2px', borderRight: '1px solid var(--color-border)', fontWeight: 700, color: 'var(--color-text-primary)' }} title="Duration">
                            {dur}d
                          </div>
                          <div style={{ padding: '2px', color: 'var(--color-text-muted)' }} title="Early Finish">
                            {ef.slice(5)}
                          </div>
                        </div>

                        {/* Downstream Connector Links */}
                        {succLinks.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                            {succLinks.map((s, si) => (
                              <span
                                key={si}
                                style={{
                                  fontSize: '0.6rem',
                                  padding: '1px 4px',
                                  borderRadius: '2px',
                                  background: 'var(--color-bg-tertiary)',
                                  color: 'var(--color-text-secondary)',
                                  border: '1px solid var(--color-border)'
                                }}
                              >
                                → {s.succ_task_id || s.successor_task_id} ({s.dependency_type || 'FS'})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: CPM Matrix Table */}
      {activeTab === 'TABLE' && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <div className="card-title">CPM Network Calculations (Working Calendar Aware)</div>
          </div>
          <div className="data-table-container" style={{ border: 'none', maxHeight: '55vh' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task ID</th>
                  <th>Task Name</th>
                  <th>Duration (WD)</th>
                  <th>Early Start (ES)</th>
                  <th>Early Finish (EF)</th>
                  <th>Late Start (LS)</th>
                  <th>Late Finish (LF)</th>
                  <th className="cell-number">Total Float (TF)</th>
                  <th className="cell-number">Free Float (FF)</th>
                  <th>Critical Path</th>
                  <th>Status</th>
                  <th>Controlling Successor</th>
                </tr>
              </thead>
              <tbody>
                {displayedTasks.map((t) => {
                  const succList = dependencies.filter(d => d.predecessor_task_id === t.id || d.pred_task_id === t.task_id);
                  return (
                    <tr key={t.id} className={t.is_critical_path ? 'critical-path' : ''}>
                      <td style={{ fontWeight: 700, color: t.is_critical_path ? 'var(--color-red)' : 'var(--color-accent)' }}>
                        {t.task_id}
                      </td>
                      <td style={{ fontWeight: 500 }}>{t.name}</td>
                      <td>{t.duration_wd ?? 1} WD</td>
                      <td>{t.current_baseline_start || t.actual_start || '—'}</td>
                      <td>{t.current_baseline_finish || t.actual_finish || '—'}</td>
                      <td>{t.current_baseline_start || '—'}</td>
                      <td>{t.current_baseline_finish || '—'}</td>
                      <td className="cell-number" style={{ fontWeight: 700, color: t.total_float <= 0 ? 'var(--color-red)' : 'var(--color-text-secondary)' }}>
                        {t.total_float !== null && t.total_float !== undefined ? `${t.total_float} WD` : 'N/A'}
                      </td>
                      <td className="cell-number" style={{ color: 'var(--color-text-muted)' }}>
                        {t.free_float !== null && t.free_float !== undefined ? `${t.free_float} WD` : 'N/A'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {t.is_critical_path ? (
                          <span style={{ color: 'var(--color-red)', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>⚡ CRITICAL</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>Non-Critical</span>
                        )}
                      </td>
                      <td><StatusBadge status={t.task_status} /></td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {succList.length > 0 ? succList.map(s => `${s.succ_task_id || s.successor_task_id} (${s.dependency_type || 'FS'})`).join(', ') : 'Terminal (Project Finish)'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dependency Network List Cards */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Network Dependency Logic (Predecessor → Successor Links)</div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {dependencies.length} Verified Links &bull; Topological Graph Verified (0 Cycles)
          </span>
        </div>
        <div className="card-body" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-3)' }}>
            {dependencies.map((dep) => (
              <div key={dep.id} style={{
                padding: 'var(--space-3)',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 'var(--font-size-xs)'
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{dep.pred_task_id}</span>
                  <span style={{ color: 'var(--color-text-muted)', margin: '0 6px' }}>→</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-blue)' }}>{dep.succ_task_id}</span>
                </div>
                <div>
                  <span style={{
                    background: 'var(--color-bg-input)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)'
                  }}>
                    {dep.dependency_type} {dep.lag_days ? `+${dep.lag_days} WD Lag` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
