import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb, queryAll, queryOne, execute } from '../db/database.js';

const router = Router();

// GET /api/calendar/:projectId
router.get('/:projectId', async (req, res) => {
  try {
    await getDb();
    const config = queryOne('SELECT * FROM calendar_config WHERE project_id = ?', [req.params.projectId]);
    const holidays = queryAll('SELECT * FROM holidays WHERE project_id = ? ORDER BY date', [req.params.projectId]);
    res.json({ config, holidays });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/calendar/:projectId
router.patch('/:projectId', async (req, res) => {
  try {
    await getDb();
    const fields = ['working_monday', 'working_tuesday', 'working_wednesday',
      'working_thursday', 'working_friday', 'working_saturday', 'working_sunday'];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f] ? 1 : 0);
      }
    }
    if (updates.length > 0) {
      values.push(req.params.projectId);
      execute(`UPDATE calendar_config SET ${updates.join(', ')} WHERE project_id = ?`, values);
    }
    res.json(queryOne('SELECT * FROM calendar_config WHERE project_id = ?', [req.params.projectId]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/calendar/:projectId/holidays
router.post('/:projectId/holidays', async (req, res) => {
  try {
    await getDb();
    const { date, name, type } = req.body;
    execute('INSERT INTO holidays (id, project_id, date, name, type) VALUES (?, ?, ?, ?, ?)',
      [uuid(), req.params.projectId, date, name || '', type || 'public']);
    res.status(201).json({ message: 'Holiday added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/calendar/:projectId/holidays/:id
router.delete('/:projectId/holidays/:id', async (req, res) => {
  try {
    await getDb();
    execute('DELETE FROM holidays WHERE id = ? AND project_id = ?', [req.params.id, req.params.projectId]);
    res.json({ message: 'Holiday removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
