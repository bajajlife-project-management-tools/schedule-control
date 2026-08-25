import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useProject } from '../context/ProjectContext.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import { api } from '../api/client.js';

export default function NetworkGraphView() {
  const { dashboardData, activeProjectId, loading } = useProject();
  const [dependencies, setDependencies] = useState([]);
  const [viewMode, setViewMode] = useState('ALL'); // 'ALL' = Full Project Network, 'CRITICAL_CHAIN' = Critical Path Backbone Only
  const [selectedTaskId, setSelectedTaskId] = useState('1.1'); // Default selected task for explainer box
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomScale, setZoomScale] = useState(1.0);
  const containerRef = useRef(null);

  useEffect(() => {
    if (activeProjectId) {
      api.getDependencies(activeProjectId).then(setDependencies).catch(console.error);
    }
  }, [activeProjectId]);

  const tasks = dashboardData?.tasks || [];
  const milestones = dashboardData?.milestones || [];
  const criticalTasks = tasks.filter(t => t.is_critical_path);

  // Map task milestone codes
  const milestoneMap = useMemo(() => {
    const map = {};
    milestones.forEach(m => {
      map[m.id] = m;
    });
    return map;
  }, [milestones]);

  // Build Adjacency Lists and Calculate Topological Depth Columns across the entire project
  const { topologicalColumns, nodePositions, criticalChainPath } = useMemo(() => {
    const taskMap = {};
    tasks.forEach(t => {
      taskMap[t.task_id] = t;
      taskMap[t.id] = t;
    });

    const predMap = {};
    const succMap = {};
    tasks.forEach(t => {
      predMap[t.task_id] = [];
      succMap[t.task_id] = [];
    });

    dependencies.forEach(d => {
      const pTask = taskMap[d.pred_task_id || d.predecessor_task_id];
      const sTask = taskMap[d.succ_task_id || d.successor_task_id];
      if (pTask && sTask) {
        if (!succMap[pTask.task_id]) succMap[pTask.task_id] = [];
        if (!predMap[sTask.task_id]) predMap[sTask.task_id] = [];
        succMap[pTask.task_id].push({ taskId: sTask.task_id, type: d.dependency_type || 'FS', lag: d.lag_days || 0 });
        predMap[sTask.task_id].push({ taskId: pTask.task_id, type: d.dependency_type || 'FS', lag: d.lag_days || 0 });
      }
    });

    // Compute topological depth (level) for each node across all milestones
    const depth = {};
    const getDepth = (tId, visited = new Set()) => {
      if (depth[tId] !== undefined) return depth[tId];
      if (visited.has(tId)) return 0;
      visited.add(tId);

      const preds = predMap[tId] || [];
      if (preds.length === 0) {
        depth[tId] = 0;
        return 0;
      }
      let maxPredDepth = 0;
      for (const p of preds) {
        maxPredDepth = Math.max(maxPredDepth, getDepth(p.taskId, new Set(visited)) + 1);
      }
      depth[tId] = maxPredDepth;
      return maxPredDepth;
    };

    tasks.forEach(t => getDepth(t.task_id));

    // Group tasks into topological columns
    const columns = [];
    tasks.forEach(t => {
      if (viewMode === 'CRITICAL_CHAIN' && !t.is_critical_path) return;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const match = t.task_id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
        if (!match && !t.is_critical_path) return;
      }

      const colIdx = depth[t.task_id] || 0;
      if (!columns[colIdx]) columns[colIdx] = [];
      columns[colIdx].push(t);
    });

    const activeColumns = columns.filter(col => col && col.length > 0);

    const CARD_WIDTH = 295;
    const CARD_HEIGHT = 175;
    const GAP_X = 110;
    const GAP_Y = 30;
    const PADDING_TOP = 40;
    const PADDING_LEFT = 40;

    const positions = {};
    activeColumns.forEach((colTasks, colIdx) => {
      const x = PADDING_LEFT + colIdx * (CARD_WIDTH + GAP_X);
      colTasks.forEach((t, rowIdx) => {
        const y = PADDING_TOP + rowIdx * (CARD_HEIGHT + GAP_Y);
        positions[t.task_id] = {
          x,
          y,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          outputX: x + CARD_WIDTH,
          outputY: y + CARD_HEIGHT / 2,
          inputX: x,
          inputY: y + CARD_HEIGHT / 2,
          task: t,
        };
      });
    });

    const criticalChain = tasks
      .filter(t => t.is_critical_path)
      .sort((a, b) => (depth[a.task_id] || 0) - (depth[b.task_id] || 0));

    return { topologicalColumns: activeColumns, nodePositions: positions, criticalChainPath: criticalChain };
  }, [tasks, dependencies, viewMode, searchTerm]);

  // Find upstream predecessors and downstream successors of selected task
  const { upstreamPreds, downstreamSuccs } = useMemo(() => {
    if (!selectedTaskId) return { upstreamPreds: new Set(), downstreamSuccs: new Set() };
    
    const preds = new Set();
    const succs = new Set();

    const findPreds = (tId) => {
      dependencies.filter(d => d.successor_task_id === tId || d.succ_task_id === tId).forEach(d => {
        const pId = d.pred_task_id || d.predecessor_task_id;
        if (!preds.has(pId)) {
          preds.add(pId);
          findPreds(pId);
        }
      });
    };

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

  // Get active selected task object
  const activeTask = useMemo(() => {
    return tasks.find(t => t.task_id === selectedTaskId || t.id === selectedTaskId) || tasks[0];
  }, [tasks, selectedTaskId]);

  // Generate Simple Plain-English Explanation for any selected task
  const simpleExplanation = useMemo(() => {
    if (!activeTask) return null;

    const t = activeTask;
    const ms = milestoneMap[t.milestone_id];
    const isCritical = t.is_critical_path;
    const floatDays = t.total_float !== null && t.total_float !== undefined ? t.total_float : 0;
    const varDays = t.forecast_variance_current_wd || 0;

    const preds = dependencies.filter(d => d.successor_task_id === t.id || d.succ_task_id === t.task_id);
    const succs = dependencies.filter(d => d.predecessor_task_id === t.id || d.pred_task_id === t.task_id);
    const predIds = preds.map(p => p.pred_task_id || p.predecessor_task_id).join(', ');
    const succIds = succs.map(s => s.succ_task_id || s.successor_task_id).join(', ');

    let simpleText = '';
    let impactText = '';

    if (t.task_id === '1.1') {
      simpleText = 'Task 1.1 (POC Activity - Red Hat) took 40 extra working days to finish. Because SOW Finalization (Task 2.1) could not start until 1.1 finished, SOW Finalization got delayed from 10-Jun to 29-Jun. This delay used up all available extra time (buffer). Therefore, Task 1.1 is on the Critical Path.';
      impactText = 'Any further delay on Task 1.1 directly pushes back the final project completion date.';
    } else if (t.task_id === '2.1') {
      simpleText = 'Task 2.1 (SOW Finalization) started 13 days late because POC Activity (Task 1.1) was late. It finished 21 days late. Vendor Onboarding for RedHat (Task 2.3) was waiting on this sign-off to begin. Because there is zero spare time left, Task 2.1 is on the Critical Path.';
      impactText = 'Delaying Task 2.1 immediately delays RedHat Vendor Onboarding (2.3) and the rest of the project.';
    } else if (t.task_id === '2.3') {
      simpleText = 'Task 2.3 (Vendor Onboarding - RedHat) started late because SOW Sign-off (Task 2.1) was late. It is projected to finish 25 days late on 04-Sep. Platform Onboarding (Task 3.2) cannot start until Vendor Onboarding finishes. Since all buffer time is used up, Task 2.3 is on the Critical Path.';
      impactText = 'Every 1 day delay in completing Vendor Onboarding directly delays Platform Enablement (3.2).';
    } else if (t.task_id === '3.2') {
      simpleText = 'Task 3.2 (Dify.ai / RedHat Platform Onboarding) is waiting for Vendor Onboarding (Task 2.3) to complete. It is forecasted to finish on 18-Sep (35 days late). Core AI Platform Services (Tasks 5.1 & 5.2) cannot start without this platform ready. It has zero spare buffer, making it a Critical Path task.';
      impactText = 'Delays on 3.2 directly push back the start of AI Orchestrator & Embedding Services in Milestone 5.';
    } else if (t.task_id === '5.1' || t.task_id === '5.2') {
      simpleText = `Task ${t.task_id} (${t.name}) cannot start until Platform Onboarding (Task 3.2) finishes on 18-Sep. It is forecasted to complete in early October. Model Router (Task 5.3) is waiting on this task. Since there is zero spare buffer time left, it is on the Critical Path.`;
      impactText = `Any delay on ${t.task_id} directly delays Model Router (5.3) and Demo Launch (6.1).`;
    } else if (t.task_id === '5.3') {
      simpleText = 'Task 5.3 (Model Router & Registry) needs both RAG Orchestrator (5.1) and Embedding Service (5.2) to finish first. It is forecasted to finish on 10-Oct. Launch Demo (Task 6.1) requires Model Router to be ready. Because it has zero extra buffer, it is on the Critical Path.';
      impactText = 'Delaying 5.3 directly delays Launch Demo (6.1) and User Training.';
    } else if (t.task_id === '6.1' || t.task_id === '6.3') {
      simpleText = `Task ${t.task_id} (${t.name}) is part of the final handover sequence. It depends on Model Router (5.3) being ready. User Training and Handover finishes on 30-Oct. Legacy Migration (Tasks 8.3 & 8.4) depends on handover. It has zero spare buffer, so it is on the Critical Path.`;
      impactText = `Delaying ${t.task_id} directly delays Legacy Migration in Milestone 8.`;
    } else if (t.task_id === '8.3' || t.task_id === '8.4' || t.task_id === '8.6') {
      simpleText = `Task ${t.task_id} (${t.name}) is in the final Go-Live phase leading up to 27-Nov-2026. It is directly connected to the upstream critical chain from Milestone 1 through Milestone 6. Since it determines when the overall project finishes, it has zero float and is on the Critical Path.`;
      impactText = 'Any delay on this activity directly moves the final project completion date beyond 27-Nov-2026.';
    } else if (isCritical) {
      simpleText = `Task ${t.task_id} (${t.name}) has Total Float = 0 days. This means there is NO spare buffer time. It is waiting on ${predIds || 'upstream tasks'} and driving ${succIds || 'downstream tasks'}.`;
      impactText = `Any delay on Task ${t.task_id} will immediately delay the final project end date.`;
    } else {
      simpleText = `Task ${t.task_id} (${t.name}) is NOT on the Critical Path because it has ${floatDays} working days of extra buffer time (Total Float).`;
      impactText = `Task ${t.task_id} can be delayed by up to ${floatDays} working days without delaying the overall project completion date.`;
    }

    return {
      task: t,
      milestone: ms,
      isCritical,
      floatDays,
      varDays,
      predIds,
      succIds,
      simpleText,
      impactText,
    };
  }, [activeTask, milestoneMap, dependencies]);

  // Canvas dimensions
  const canvasWidth = useMemo(() => {
    return Math.max(1450, (topologicalColumns.length + 1) * 410);
  }, [topologicalColumns]);

  const canvasHeight = useMemo(() => {
    let maxRows = 1;
    topologicalColumns.forEach(c => {
      if (c.length > maxRows) maxRows = c.length;
    });
    return Math.max(750, maxRows * 210 + 100);
  }, [topologicalColumns]);

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Loading Dependency Network Flow Graph...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 'var(--space-3)' }}>
        <div>
          <h1>Dependency Network Graph &amp; Critical Path Explainer</h1>
          <div className="breadcrumb">
            Simple Plain-English Task Explanation &bull; Topological PERT Flow &bull; Critical Path Tracing
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className={`btn btn-sm ${viewMode === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('ALL')}
          >
            Full Project Network ({tasks.length} Nodes)
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'CRITICAL_CHAIN' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('CRITICAL_CHAIN')}
          >
            ⚡ Critical Path Only ({criticalTasks.length} Nodes)
          </button>
        </div>
      </div>

      {/* PROMINENT PLAIN-ENGLISH CRITICAL PATH EXPLAINER BOX */}
      <div style={{
        background: simpleExplanation?.isCritical 
          ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(15, 23, 42, 0.98))' 
          : 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(15, 23, 42, 0.98))',
        border: simpleExplanation?.isCritical ? '2px solid var(--color-red)' : '2px solid var(--color-green)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4) var(--space-5)',
        marginBottom: 'var(--space-4)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        {/* Selector Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
          <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: simpleExplanation?.isCritical ? 'var(--color-red)' : 'var(--color-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💡 CRITICAL PATH SIMPLE EXPLAINER:</span>
          </div>

          {/* Select / Type Task ID Input Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: '280px' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Select Task to Explain:</label>
            <select
              className="form-select"
              style={{ width: '100%', maxWidth: '400px', height: '36px', fontSize: 'var(--font-size-xs)', fontWeight: 700, borderColor: simpleExplanation?.isCritical ? 'var(--color-red)' : 'var(--color-green)' }}
              value={selectedTaskId || ''}
              onChange={(e) => setSelectedTaskId(e.target.value)}
            >
              <optgroup label="⚡ Critical Path Tasks (Zero Float)">
                {criticalTasks.map(t => (
                  <option key={t.id} value={t.task_id}>
                    ⚡ Task {t.task_id} - {t.name} (TF: 0 WD)
                  </option>
                ))}
              </optgroup>
              <optgroup label="🟢 Non-Critical Tasks (Has Float Buffer)">
                {tasks.filter(t => !t.is_critical_path).map(t => (
                  <option key={t.id} value={t.task_id}>
                    Task {t.task_id} - {t.name} (TF: {t.total_float} WD)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Simple Plain-English Explanation Content */}
        {simpleExplanation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Task {simpleExplanation.task.task_id}: {simpleExplanation.task.name}
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: '8px', fontWeight: 400 }}>
                  ({simpleExplanation.milestone ? simpleExplanation.milestone.milestone_id : 'Milestone'})
                </span>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontWeight: 800,
                  fontSize: 'var(--font-size-xs)',
                  background: simpleExplanation.isCritical ? 'var(--color-red-bg)' : 'var(--color-green-bg)',
                  color: simpleExplanation.isCritical ? 'var(--color-red)' : 'var(--color-green)',
                  border: simpleExplanation.isCritical ? '1px solid var(--color-red-border)' : '1px solid var(--color-green-border)'
                }}>
                  {simpleExplanation.isCritical ? '⚡ CRITICAL PATH TASK (Zero Buffer)' : '🟢 NON-CRITICAL TASK'}
                </span>

                <span style={{ padding: '3px 10px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                  Total Float: {simpleExplanation.floatDays} WD
                </span>
              </div>
            </div>

            {/* Plain-English Explanation Box */}
            <div style={{
              background: 'var(--color-bg-card)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              borderLeft: simpleExplanation.isCritical ? '4px solid var(--color-red)' : '4px solid var(--color-green)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-primary)',
              lineHeight: '1.5'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '4px', color: simpleExplanation.isCritical ? 'var(--color-red)' : 'var(--color-green)' }}>
                💬 Simple Language Explanation:
              </div>
              <div>{simpleExplanation.simpleText}</div>
            </div>

            {/* Chain Effect Box */}
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              background: 'var(--color-bg-tertiary)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>🔗 Project Chain Impact:</span>
              <span>{simpleExplanation.impactText}</span>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar & Controls */}
      <div className="filter-bar" style={{ background: 'var(--color-bg-card)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-4)' }}>
        <input
          type="text"
          className="search-input"
          placeholder="Filter activities in topological graph..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span>Zoom:</span>
          <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }} onClick={() => setZoomScale(Math.max(0.5, zoomScale - 0.1))}>-</button>
          <span>{Math.round(zoomScale * 100)}%</span>
          <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }} onClick={() => setZoomScale(Math.min(1.3, zoomScale + 0.1))}>+</button>
          <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }} onClick={() => setZoomScale(1.0)}>Reset</button>
        </div>

        {selectedTaskId && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 'auto', color: 'var(--color-accent)' }}
            onClick={() => setSelectedTaskId(null)}
          >
            Clear Selection ({selectedTaskId}) ✕
          </button>
        )}
      </div>

      {/* Main Canvas Container with SVG Dependency Arrows */}
      <div
        ref={containerRef}
        className="card"
        style={{
          overflow: 'auto',
          maxHeight: '65vh',
          background: '#090d16',
          position: 'relative',
          border: '1px solid var(--color-border)'
        }}
      >
        <div style={{
          position: 'relative',
          width: `${canvasWidth * zoomScale}px`,
          height: `${canvasHeight * zoomScale}px`,
          transform: `scale(${zoomScale})`,
          transformOrigin: 'top left'
        }}>
          {/* SVG Arrows Layer */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1
            }}
          >
            {dependencies.map((dep, depIdx) => {
              const pPos = nodePositions[dep.pred_task_id || dep.predecessor_task_id];
              const sPos = nodePositions[dep.succ_task_id || dep.successor_task_id];

              if (!pPos || !sPos) return null;

              const isCriticalLink = pPos.task.is_critical_path && sPos.task.is_critical_path;
              const isSelectedLink = selectedTaskId && (
                selectedTaskId === pPos.task.task_id || selectedTaskId === sPos.task.task_id ||
                (upstreamPreds.has(pPos.task.task_id) && upstreamPreds.has(sPos.task.task_id)) ||
                (downstreamSuccs.has(pPos.task.task_id) && downstreamSuccs.has(sPos.task.task_id))
              );

              // 1. Output anchor from predecessor right edge
              const x1 = pPos.outputX;
              const y1 = pPos.outputY;

              // 2. Arrowhead geometry (10px length, 12px height). Tip stops 3px BEFORE destination card border!
              const arrowLen = 10;
              const arrowHalfH = 5.5;
              const tipX = sPos.inputX - 3;
              const tipY = sPos.inputY;
              const baseX = tipX - arrowLen;

              // 3. Curve line terminates at exact center of arrowhead base
              const x2 = baseX;
              const y2 = tipY;
              const dx = Math.max(35, (x2 - x1) * 0.45);

              const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              let strokeColor = '#94a3b8'; // Bright silver-blue for high-visibility non-critical arrows
              let strokeWidth = 2.2;
              let strokeDasharray = '6 4';

              if (isCriticalLink) {
                strokeColor = '#ef4444'; // ALWAYS RED FOR CRITICAL PATH
                strokeWidth = isSelectedLink ? 3.8 : 2.8;
                strokeDasharray = 'none';
              } else if (isSelectedLink) {
                strokeColor = '#38bdf8'; // ELECTRIC CYAN BLUE FOR SELECTED NON-CRITICAL TRACE
                strokeWidth = 3.0;
                strokeDasharray = 'none';
              }

              return (
                <g key={depIdx} opacity={selectedTaskId && !isSelectedLink ? 0.45 : 1.0}>
                  {/* Curve Line into arrowhead base */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                  />

                  {/* Clean Arrowhead Triangle pointing right at card left border */}
                  <polygon
                    points={`${baseX},${y2 - arrowHalfH} ${tipX},${y2} ${baseX},${y2 + arrowHalfH}`}
                    fill={strokeColor}
                  />

                  {/* Link Tag text near midpoint */}
                  {dep.dependency_type && dep.dependency_type !== 'FS' && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 6}
                      fill="#94a3b8"
                      fontSize="10"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {dep.dependency_type}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* HTML Nodes Layer */}
          {Object.entries(nodePositions).map(([tId, pos]) => {
            const t = pos.task;
            const ms = milestoneMap[t.milestone_id];
            const isSelected = selectedTaskId === t.task_id;
            const isUpstream = upstreamPreds.has(t.task_id);
            const isDownstream = downstreamSuccs.has(t.task_id);

            const es = t.current_baseline_start || t.actual_start || '—';
            const ef = t.current_baseline_finish || t.actual_finish || '—';
            const ls = t.current_baseline_start || '—';
            const lf = t.current_baseline_finish || '—';
            const dur = t.duration_wd ?? 1;
            const tfVal = t.total_float !== null && t.total_float !== undefined ? t.total_float : 0;
            const ffVal = t.free_float !== null && t.free_float !== undefined ? t.free_float : 0;

            let borderStyle = '1px solid var(--color-border)';
            let boxShadow = 'var(--shadow-sm)';
            let bgColor = 'var(--color-bg-card)';

            if (t.is_critical_path) {
              borderStyle = '2px solid var(--color-red)';
              boxShadow = '0 0 12px rgba(239, 68, 68, 0.35)';
            }
            if (isSelected) {
              borderStyle = '2px solid var(--color-accent)';
              bgColor = 'var(--color-blue-bg)';
              boxShadow = '0 0 16px rgba(59, 130, 246, 0.6)';
            } else if (isUpstream) {
              borderStyle = '2px dashed var(--color-purple)';
              bgColor = 'var(--color-purple-bg)';
            } else if (isDownstream) {
              borderStyle = '2px dashed var(--color-teal)';
              bgColor = 'rgba(20, 184, 166, 0.15)';
            }

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTaskId(isSelected ? null : t.task_id)}
                style={{
                  position: 'absolute',
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${pos.width}px`,
                  height: `${pos.height}px`,
                  background: bgColor,
                  border: borderStyle,
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-3)',
                  cursor: 'pointer',
                  boxShadow: boxShadow,
                  zIndex: isSelected ? 10 : 2,
                  transition: 'all 0.15s ease',
                  opacity: selectedTaskId && !isSelected && !isUpstream && !isDownstream ? 0.35 : 1
                }}
              >
                {/* Node Header: Milestone Tag & Critical Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    fontWeight: 700,
                    background: 'var(--color-bg-tertiary)',
                    color: 'var(--color-accent)',
                    border: '1px solid var(--color-border)'
                  }}>
                    {ms ? ms.milestone_id : 'Milestone'}
                  </span>

                  <span style={{
                    fontSize: '0.65rem',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    fontWeight: 800,
                    background: t.total_float <= 0 ? 'var(--color-red-bg)' : 'var(--color-bg-tertiary)',
                    color: t.total_float <= 0 ? 'var(--color-red)' : 'var(--color-text-secondary)'
                  }}>
                    TF: {tfVal} WD {t.is_critical_path ? '⚡' : ''}
                  </span>
                </div>

                {/* Task ID & Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, color: t.is_critical_path ? 'var(--color-red)' : 'var(--color-accent)', fontSize: 'var(--font-size-xs)' }}>
                    {t.task_id}
                  </span>
                  <span style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} title={t.name}>
                    {t.name}
                  </span>
                </div>

                {/* Explicitly Labeled PMP 6-Box Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  background: 'var(--color-bg-input)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  fontSize: '0.62rem',
                  textAlign: 'center',
                  marginBottom: '6px'
                }}>
                  <div style={{ padding: '3px 2px', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }} title="Early Start (ES)">
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.55rem', fontWeight: 600 }}>ES (Early Start)</div>
                    <div style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{es.slice(5)}</div>
                  </div>

                  <div style={{ padding: '3px 2px', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }} title="Duration (WD)">
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.55rem', fontWeight: 600 }}>DUR (Duration)</div>
                    <div style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{dur} WD</div>
                  </div>

                  <div style={{ padding: '3px 2px', borderBottom: '1px solid var(--color-border)' }} title="Early Finish (EF)">
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.55rem', fontWeight: 600 }}>EF (Early Finish)</div>
                    <div style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{ef.slice(5)}</div>
                  </div>

                  <div style={{ padding: '3px 2px', borderRight: '1px solid var(--color-border)' }} title="Late Start (LS)">
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.55rem', fontWeight: 600 }}>LS (Late Start)</div>
                    <div style={{ color: 'var(--color-purple)', fontWeight: 700 }}>{ls.slice(5)}</div>
                  </div>

                  <div style={{ padding: '3px 2px', borderRight: '1px solid var(--color-border)' }} title="Total Float & Free Float">
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.55rem', fontWeight: 600 }}>FLOAT (TF / FF)</div>
                    <div style={{ fontWeight: 800, color: tfVal <= 0 ? 'var(--color-red)' : 'var(--color-green)' }}>
                      {tfVal}d <span style={{ fontSize: '0.55rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}>(FF:{ffVal}d)</span>
                    </div>
                  </div>

                  <div style={{ padding: '3px 2px' }} title="Late Finish (LF)">
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.55rem', fontWeight: 600 }}>LF (Late Finish)</div>
                    <div style={{ color: 'var(--color-purple)', fontWeight: 700 }}>{lf.slice(5)}</div>
                  </div>
                </div>

                {/* Node Footer: Owner & Task Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                    👤 {t.owner || 'PM'}
                  </span>
                  <StatusBadge status={t.task_status} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
