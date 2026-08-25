import { Router } from 'express';
import { getDb, queryAll } from '../db/database.js';

const router = Router();

// GET /api/audit?project_id=xxx
router.get('/', async (req, res) => {
  try {
    await getDb();
    const { project_id, entity_type, entity_id, limit } = req.query;
    let sql = 'SELECT * FROM audit_events WHERE 1=1';
    const params = [];
    if (project_id) { sql += ' AND project_id = ?'; params.push(project_id); }
    if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
    if (entity_id) { sql += ' AND entity_id = ?'; params.push(entity_id); }
    sql += ' ORDER BY created_at DESC';
    sql += ` LIMIT ${parseInt(limit) || 100}`;
    res.json(queryAll(sql, params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
