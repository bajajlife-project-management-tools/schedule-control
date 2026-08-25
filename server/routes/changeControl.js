import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb, queryAll, queryOne, execute, saveDb } from '../db/database.js';
import { toISODate } from '../engine/calendarEngine.js';

const router = Router();

// GET /api/change-requests?project_id=xxx
router.get('/', async (req, res) => {
  try {
    await getDb();
    const { project_id } = req.query;
    let sql = 'SELECT * FROM change_requests';
    const params = [];
    if (project_id) { sql += ' WHERE project_id = ?'; params.push(project_id); }
    sql += ' ORDER BY created_at DESC';
    res.json(queryAll(sql, params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/change-requests — Create change request
router.post('/', async (req, res) => {
  try {
    await getDb();
    const id = uuid();
    const { project_id, change_id, requested_by, change_type, description, reason,
      affected_scope, affected_tasks, affected_milestones,
      schedule_impact_wd, cost_impact, resource_impact, risk_impact,
      original_baseline_finish, current_baseline_finish, proposed_new_baseline,
      recommendation } = req.body;

    execute(`
      INSERT INTO change_requests (id, project_id, change_id, request_date, requested_by,
        change_type, description, reason, affected_scope, affected_tasks, affected_milestones,
        schedule_impact_wd, cost_impact, resource_impact, risk_impact,
        original_baseline_finish, current_baseline_finish, proposed_new_baseline,
        recommendation, approval_status)
      VALUES (?, ?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft')
    `, [id, project_id, change_id || `CR-${Date.now()}`, requested_by || '',
      change_type || 'Schedule', description, reason || '',
      affected_scope || '', affected_tasks || '', affected_milestones || '',
      schedule_impact_wd || 0, cost_impact || '', resource_impact || '', risk_impact || '',
      original_baseline_finish || '', current_baseline_finish || '', proposed_new_baseline || '',
      recommendation || '']);

    execute(`INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, source, user_name) VALUES (?, ?, 'ChangeRequest', ?, 'Create', 'PMO Update', ?)`,
      [uuid(), project_id, id, requested_by || 'system']);

    res.status(201).json(queryOne('SELECT * FROM change_requests WHERE id = ?', [id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/change-requests/:id/approve — Approve and apply rebaseline
router.post('/:id/approve', async (req, res) => {
  try {
    await getDb();
    const cr = queryOne('SELECT * FROM change_requests WHERE id = ?', [req.params.id]);
    if (!cr) return res.status(404).json({ error: 'Change request not found' });

    const { approver, decision_notes } = req.body;

    // Update change request status
    execute(`
      UPDATE change_requests SET
        approval_status = 'Approved',
        approver = ?,
        approval_date = date('now'),
        effective_date = date('now'),
        decision_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [approver || 'PMO', decision_notes || '', req.params.id]);

    // If there's a proposed new baseline, apply it
    if (cr.proposed_new_baseline) {
      // Save current baseline as a version
      const project = queryOne('SELECT * FROM projects WHERE id = ?', [cr.project_id]);
      const versionCount = queryAll('SELECT COUNT(*) as cnt FROM baseline_versions WHERE project_id = ?', [cr.project_id]);
      const versionNum = (versionCount[0]?.cnt || 0) + 1;

      // Capture all current baseline data
      const tasks = queryAll('SELECT * FROM tasks WHERE project_id = ?', [cr.project_id]);
      const milestones = queryAll('SELECT * FROM milestones WHERE project_id = ?', [cr.project_id]);
      const baselineData = JSON.stringify({ tasks, milestones, project });

      execute(`
        INSERT INTO baseline_versions (id, project_id, version_number, version_date, reason, change_request_id, baseline_data, created_by)
        VALUES (?, ?, ?, date('now'), ?, ?, ?, ?)
      `, [uuid(), cr.project_id, versionNum, cr.reason || '', req.params.id, baselineData, approver || 'system']);

      // Update project current baseline
      execute(`
        UPDATE projects SET
          current_baseline_finish = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `, [cr.proposed_new_baseline, cr.project_id]);

      // If specific tasks/milestones are affected, update their baselines
      if (cr.affected_tasks) {
        const taskIds = cr.affected_tasks.split(',').map(s => s.trim());
        for (const taskId of taskIds) {
          const task = queryOne('SELECT * FROM tasks WHERE project_id = ? AND task_id = ?', [cr.project_id, taskId]);
          if (task && task.owner_forecast_finish) {
            execute(`
              UPDATE tasks SET
                current_baseline_start = COALESCE(owner_forecast_start, current_baseline_start),
                current_baseline_finish = COALESCE(owner_forecast_finish, current_baseline_finish),
                updated_at = datetime('now')
              WHERE id = ?
            `, [task.id]);
          }
        }
      }

      // Audit trail for rebaseline
      execute(`
        INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, field_changed, old_value, new_value, reason, source, user_name)
        VALUES (?, ?, 'Project', ?, 'Rebaseline', 'current_baseline_finish', ?, ?, ?, 'Change Control', ?)
      `, [uuid(), cr.project_id, cr.project_id, cr.current_baseline_finish || '', cr.proposed_new_baseline, cr.reason || '', approver || 'system']);
    }

    res.json(queryOne('SELECT * FROM change_requests WHERE id = ?', [req.params.id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/change-requests/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    await getDb();
    execute(`
      UPDATE change_requests SET
        approval_status = 'Rejected',
        approver = ?,
        approval_date = date('now'),
        decision_notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [req.body.approver || '', req.body.decision_notes || '', req.params.id]);

    res.json(queryOne('SELECT * FROM change_requests WHERE id = ?', [req.params.id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/change-requests/:id
router.patch('/:id', async (req, res) => {
  try {
    await getDb();
    const allowed = ['description', 'reason', 'affected_scope', 'affected_tasks',
      'affected_milestones', 'schedule_impact_wd', 'proposed_new_baseline',
      'recommendation', 'approval_status', 'decision_notes'];
    const updates = [];
    const values = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);
      execute(`UPDATE change_requests SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    res.json(queryOne('SELECT * FROM change_requests WHERE id = ?', [req.params.id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
