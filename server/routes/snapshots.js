import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb, queryAll, queryOne, execute } from '../db/database.js';
import { getDashboardData } from '../engine/scheduleOrchestrator.js';
import { generateExecutiveNarrative } from '../engine/narrativeEngine.js';
import { calculateCumulativeMilestoneSlippage, getMaxMilestoneVariance } from '../engine/statusEngine.js';

const router = Router();

// GET /api/snapshots?project_id=xxx
router.get('/', async (req, res) => {
  try {
    await getDb();
    const { project_id } = req.query;
    let sql = 'SELECT * FROM weekly_snapshots';
    const params = [];
    if (project_id) { sql += ' WHERE project_id = ?'; params.push(project_id); }
    sql += ' ORDER BY created_at DESC';
    res.json(queryAll(sql, params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/snapshots — Create weekly snapshot ("Close Weekly Review")
router.post('/', async (req, res) => {
  try {
    const { project_id, notes, created_by } = req.body;
    const dashData = await getDashboardData(project_id);

    const id = uuid();
    const snapshots = queryAll('SELECT * FROM weekly_snapshots WHERE project_id = ? ORDER BY created_at DESC', [project_id]);
    const weekNum = snapshots.length + 1;

    // Find historical max variance
    let histMax = Math.abs(dashData.kpis.varianceCurrentWD || 0);
    for (const s of snapshots) {
      if (Math.abs(s.forecast_variance_current_wd || 0) > histMax) {
        histMax = Math.abs(s.forecast_variance_current_wd);
      }
    }

    // Find top schedule driver
    const topDriver = dashData.topDrivers.length > 0 ? dashData.topDrivers[0].name : '';

    // Determine recovery achieved
    let recoveryWD = 0;
    if (snapshots.length > 0) {
      const prevVar = snapshots[0].forecast_variance_current_wd || 0;
      const currVar = dashData.kpis.varianceCurrentWD || 0;
      if (currVar < prevVar) recoveryWD = prevVar - currVar;
    }

    // Pending change requests
    const pendingCR = queryAll('SELECT * FROM change_requests WHERE project_id = ? AND approval_status IN (?, ?)', [project_id, 'Pending Approval', 'Impact Assessment']);
    const executiveDecision = pendingCR.length > 0 ? `${pendingCR.length} change request(s) pending approval` : 'None';

    execute(`
      INSERT INTO weekly_snapshots (id, project_id, status_date, week_number,
        current_baseline_finish, project_forecast_finish,
        forecast_variance_current_wd, forecast_variance_original_wd,
        overall_status, historical_max_variance_wd, recovery_achieved_wd,
        rebaseline_decision, top_schedule_driver, critical_path_risk,
        executive_decision_required,
        milestones_on_track, milestones_at_risk, milestones_delayed, milestones_completed,
        cumulative_milestone_slippage, schedule_health,
        executive_narrative, notes, created_by)
      VALUES (?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, project_id, weekNum,
      dashData.project.current_baseline_finish,
      dashData.kpis.forecastFinish,
      dashData.kpis.varianceCurrentWD,
      dashData.kpis.varianceOriginalWD,
      dashData.kpis.overallStatus,
      histMax,
      recoveryWD,
      '', // rebaseline decision
      topDriver,
      dashData.kpis.criticalTasksAtRisk > 0 ? `${dashData.kpis.criticalTasksAtRisk} critical task(s) at risk` : 'None',
      executiveDecision,
      dashData.milestones.filter(m => m.status === 'ON TRACK').length,
      dashData.milestones.filter(m => m.status === 'AT RISK').length,
      dashData.milestones.filter(m => m.status === 'DELAYED').length,
      dashData.milestones.filter(m => m.status?.startsWith('COMPLETED')).length,
      dashData.kpis.cumulativeMilestoneSlippage,
      dashData.scheduleHealth.level,
      dashData.narrative,
      notes || '',
      created_by || 'system',
    ]);

    // Also snapshot all task forecasts
    const tasks = queryAll('SELECT * FROM tasks WHERE project_id = ? AND actual_finish IS NULL', [project_id]);
    for (const t of tasks) {
      execute(`
        INSERT INTO forecast_history (id, task_id, project_id, snapshot_date, forecast_finish, percent_complete, status, updated_by)
        VALUES (?, ?, ?, date('now'), ?, ?, ?, ?)
      `, [uuid(), t.id, project_id, t.owner_forecast_finish, t.percent_complete, t.task_status, created_by || 'system']);
    }

    execute(`INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, source, user_name) VALUES (?, ?, 'Snapshot', ?, 'Weekly Snapshot Created', 'PMO Update', ?)`,
      [uuid(), project_id, id, created_by || 'system']);

    res.status(201).json(queryOne('SELECT * FROM weekly_snapshots WHERE id = ?', [id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
