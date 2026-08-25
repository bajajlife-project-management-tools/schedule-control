import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb, queryAll, queryOne, execute, saveDb } from '../db/database.js';
import { toISODate } from '../engine/calendarEngine.js';

const router = Router();

// GET /api/tasks?project_id=xxx — List tasks for a project
router.get('/', async (req, res) => {
  try {
    await getDb();
    const { project_id, milestone_id, status, critical_path } = req.query;
    let sql = 'SELECT t.*, m.milestone_id as milestone_code, m.name as milestone_name FROM tasks t LEFT JOIN milestones m ON t.milestone_id = m.id WHERE 1=1';
    const params = [];

    if (project_id) { sql += ' AND t.project_id = ?'; params.push(project_id); }
    if (milestone_id) { sql += ' AND t.milestone_id = ?'; params.push(milestone_id); }
    if (status) { sql += ' AND t.task_status = ?'; params.push(status); }
    if (critical_path === 'true') { sql += ' AND t.is_critical_path = 1'; }

    sql += ' ORDER BY t.sort_order';
    const tasks = queryAll(sql, params);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id — Get single task
router.get('/:id', async (req, res) => {
  try {
    await getDb();
    const task = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id — Update task
router.patch('/:id', async (req, res) => {
  try {
    await getDb();
    const task = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Prevent direct current baseline modification
    if (req.body.current_baseline_start !== undefined || req.body.current_baseline_finish !== undefined) {
      if (!req.body._change_control_override) {
        return res.status(403).json({
          error: 'Current Baseline can only be changed through approved Change Control.',
          action: 'Create Rebaseline Request',
        });
      }
    }

    // Prevent original baseline modification
    if (req.body.original_baseline_start !== undefined || req.body.original_baseline_finish !== undefined) {
      return res.status(403).json({
        error: 'Original Baseline dates are immutable and cannot be changed.',
      });
    }

    const allowed = [
      'name', 'owner', 'actual_start', 'actual_finish',
      'owner_forecast_start', 'owner_forecast_finish',
      'percent_complete', 'variance_cause', 'recovery_action',
      'recovery_date', 'rebaseline_required', 'rebaseline_reason',
      'comments', 'lag', 'lead',
    ];

    const updates = [];
    const values = [];
    const auditEntries = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        const oldVal = task[field];
        const newVal = req.body[field];
        updates.push(`${field} = ?`);
        values.push(newVal);

        if (oldVal !== newVal) {
          auditEntries.push({ field, old: oldVal, new: newVal });
        }
      }
    }

    if (updates.length > 0) {
      updates.push("last_updated_by = ?");
      values.push(req.body.updated_by || 'system');
      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);
      execute(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);

      // Create audit entries
      for (const entry of auditEntries) {
        execute(`
          INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, field_changed, old_value, new_value, source, user_name, created_at)
          VALUES (?, ?, 'Task', ?, 'Update', ?, ?, ?, ?, ?, datetime('now'))
        `, [uuid(), task.project_id, req.params.id, entry.field, String(entry.old ?? ''), String(entry.new ?? ''), req.body.source || 'Owner Update', req.body.updated_by || 'system']);
      }
    }

    // If forecast was updated, save to forecast history
    if (req.body.owner_forecast_finish !== undefined) {
      execute(`
        INSERT INTO forecast_history (id, task_id, project_id, snapshot_date, forecast_finish, percent_complete, status, updated_by)
        VALUES (?, ?, ?, date('now'), ?, ?, ?, ?)
      `, [uuid(), req.params.id, task.project_id, req.body.owner_forecast_finish, req.body.percent_complete || task.percent_complete, task.task_status, req.body.updated_by || 'system']);
    }

    const updated = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/forecast — Update forecast (dedicated endpoint)
router.post('/:id/forecast', async (req, res) => {
  try {
    await getDb();
    const task = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { forecast_finish, percent_complete, variance_cause, recovery_action, recovery_date, comments, updated_by } = req.body;

    execute(`
      UPDATE tasks SET
        owner_forecast_finish = ?,
        percent_complete = ?,
        variance_cause = ?,
        recovery_action = ?,
        recovery_date = ?,
        comments = ?,
        last_updated_by = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [forecast_finish, percent_complete ?? task.percent_complete, variance_cause ?? task.variance_cause,
      recovery_action ?? task.recovery_action, recovery_date ?? task.recovery_date,
      comments ?? task.comments, updated_by || 'system', req.params.id]);

    // Save forecast history
    execute(`
      INSERT INTO forecast_history (id, task_id, project_id, snapshot_date, forecast_finish, percent_complete, updated_by)
      VALUES (?, ?, ?, date('now'), ?, ?, ?)
    `, [uuid(), req.params.id, task.project_id, forecast_finish, percent_complete ?? task.percent_complete, updated_by || 'system']);

    // Audit
    execute(`
      INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, field_changed, old_value, new_value, source, user_name)
      VALUES (?, ?, 'Task', ?, 'Forecast Update', 'owner_forecast_finish', ?, ?, 'Owner Update', ?)
    `, [uuid(), task.project_id, req.params.id, task.owner_forecast_finish || '', forecast_finish || '', updated_by || 'system']);

    const updated = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id/forecast-history — Get forecast history
router.get('/:id/forecast-history', async (req, res) => {
  try {
    await getDb();
    const history = queryAll('SELECT * FROM forecast_history WHERE task_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/bulk-update — Bulk update tasks
router.post('/bulk-update', async (req, res) => {
  try {
    await getDb();
    const { updates } = req.body; // Array of { id, ...fields }
    const results = [];

    for (const update of updates) {
      const { id, ...fields } = update;
      const task = queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
      if (!task) continue;

      const allowed = ['owner_forecast_finish', 'percent_complete', 'variance_cause', 'recovery_action', 'comments'];
      const updates = [];
      const values = [];

      for (const field of allowed) {
        if (fields[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(fields[field]);
        }
      }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        values.push(id);
        execute(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);
        results.push({ id, updated: true });
      }
    }

    res.json({ updated: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
