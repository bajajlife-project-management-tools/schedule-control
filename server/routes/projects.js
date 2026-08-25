import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb, queryAll, queryOne, execute, saveDb } from '../db/database.js';
import { getDashboardData, recalculateProject } from '../engine/scheduleOrchestrator.js';

const router = Router();

// GET /api/projects — List all projects
router.get('/', async (req, res) => {
  try {
    await getDb();
    const projects = queryAll('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id — Get project details
router.get('/:id', async (req, res) => {
  try {
    await getDb();
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/dashboard — Full dashboard data
router.get('/:id/dashboard', async (req, res) => {
  try {
    const data = await getDashboardData(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects — Create new project
router.post('/', async (req, res) => {
  try {
    await getDb();
    const id = uuid();
    const { name, description, project_manager, status_date,
      original_baseline_start, original_baseline_finish, tolerance_days } = req.body;

    execute(`
      INSERT INTO projects (id, name, description, project_manager, status_date,
        original_baseline_start, original_baseline_finish,
        current_baseline_start, current_baseline_finish,
        tolerance_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, description || '', project_manager || '', status_date || null,
      original_baseline_start || null, original_baseline_finish || null,
      original_baseline_start || null, original_baseline_finish || null,
      tolerance_days || 5]);

    // Create default calendar
    execute(`
      INSERT INTO calendar_config (id, project_id) VALUES (?, ?)
    `, [uuid(), id]);

    const project = queryOne('SELECT * FROM projects WHERE id = ?', [id]);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:id — Update project
router.patch('/:id', async (req, res) => {
  try {
    await getDb();
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const fields = ['name', 'description', 'project_manager', 'status_date',
      'management_forecast_finish', 'tolerance_days'];
    const updates = [];
    const values = [];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);
      execute(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const updated = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/recalculate — Trigger recalculation
router.post('/:id/recalculate', async (req, res) => {
  try {
    const result = await recalculateProject(req.params.id);
    res.json({ message: 'Recalculation complete', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id — Delete project
router.delete('/:id', async (req, res) => {
  try {
    await getDb();
    execute('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/milestones — Get milestones
router.get('/:id/milestones', async (req, res) => {
  try {
    await getDb();
    const milestones = queryAll('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order', [req.params.id]);
    res.json(milestones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/schedule — Get full schedule
router.get('/:id/schedule', async (req, res) => {
  try {
    await getDb();
    const tasks = queryAll('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order', [req.params.id]);
    const milestones = queryAll('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order', [req.params.id]);
    const dependencies = queryAll('SELECT * FROM dependencies WHERE project_id = ?', [req.params.id]);
    res.json({ tasks, milestones, dependencies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/dependencies — Get dependencies
router.get('/:id/dependencies', async (req, res) => {
  try {
    await getDb();
    const deps = queryAll(`
      SELECT d.*, 
        t1.task_id as pred_task_id, t1.name as pred_name,
        t2.task_id as succ_task_id, t2.name as succ_name
      FROM dependencies d
      JOIN tasks t1 ON d.predecessor_task_id = t1.id
      JOIN tasks t2 ON d.successor_task_id = t2.id
      WHERE d.project_id = ?
    `, [req.params.id]);
    res.json(deps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
