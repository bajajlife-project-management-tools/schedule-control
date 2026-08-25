import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb, queryAll, queryOne, execute } from '../db/database.js';

const router = Router();

// GET /api/raid?project_id=xxx
router.get('/', async (req, res) => {
  try {
    await getDb();
    const { project_id, type, status } = req.query;
    let sql = 'SELECT * FROM raid_items WHERE 1=1';
    const params = [];
    if (project_id) { sql += ' AND project_id = ?'; params.push(project_id); }
    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    res.json(queryAll(sql, params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/raid
router.post('/', async (req, res) => {
  try {
    await getDb();
    const id = uuid();
    const { project_id, raid_id, type, description, affected_task_id, affected_milestone_id,
      probability, impact, owner, due_date, mitigation, linked_schedule_id,
      rebaseline_trigger, date_raised } = req.body;

    execute(`
      INSERT INTO raid_items (id, project_id, raid_id, type, date_raised, description,
        affected_task_id, affected_milestone_id, probability, impact, owner, due_date,
        mitigation, linked_schedule_id, rebaseline_trigger)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, project_id, raid_id || `RAID-${Date.now()}`, type, date_raised || new Date().toISOString().split('T')[0],
      description, affected_task_id || null, affected_milestone_id || null,
      probability || 'Medium', impact || 'Medium', owner || '', due_date || null,
      mitigation || '', linked_schedule_id || null, rebaseline_trigger ? 1 : 0]);

    // Audit
    execute(`INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, source, user_name) VALUES (?, ?, 'RAID', ?, 'Create', 'PMO Update', ?)`,
      [uuid(), project_id, id, req.body.updated_by || 'system']);

    res.status(201).json(queryOne('SELECT * FROM raid_items WHERE id = ?', [id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/raid/:id
router.patch('/:id', async (req, res) => {
  try {
    await getDb();
    const item = queryOne('SELECT * FROM raid_items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'RAID item not found' });

    const allowed = ['type', 'description', 'affected_task_id', 'affected_milestone_id',
      'probability', 'impact', 'owner', 'due_date', 'mitigation', 'status',
      'linked_schedule_id', 'rebaseline_trigger', 'rebaseline_requested_date',
      'approval_decision', 'outcome_closure'];
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
      execute(`UPDATE raid_items SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    res.json(queryOne('SELECT * FROM raid_items WHERE id = ?', [req.params.id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/raid/:id
router.delete('/:id', async (req, res) => {
  try {
    await getDb();
    execute('DELETE FROM raid_items WHERE id = ?', [req.params.id]);
    res.json({ message: 'RAID item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
