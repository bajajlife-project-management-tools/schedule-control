import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import { getDb, queryAll, queryOne, execute, saveDb } from '../db/database.js';
import { parseExcel, autoDetectColumns, validateImport, enrichAndImport } from '../import/excelParser.js';
import { generateExportWorkbook, workbookToBuffer } from '../export/excelExporter.js';
import { getDashboardData, recalculateProject } from '../engine/scheduleOrchestrator.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// POST /api/import/parse — Parse Excel and return structure
router.post('/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = parseExcel(req.file.buffer);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/detect-columns — Auto-detect column mappings
router.post('/detect-columns', (req, res) => {
  try {
    const { headers } = req.body;
    const mapping = autoDetectColumns(headers);
    res.json(mapping);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/validate — Validate data with mapping
router.post('/validate', (req, res) => {
  try {
    const { rows, mapping } = req.body;
    const result = validateImport(rows, mapping);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/execute — Execute import
router.post('/execute', async (req, res) => {
  try {
    const db = await getDb();
    const { projectName, projectManager, rows, mapping, statusDate } = req.body;

    // Validate first
    const validation = validateImport(rows, mapping);
    if (validation.errors.length > 0) {
      return res.status(400).json({ error: 'Validation errors', errors: validation.errors });
    }

    // Create project
    const projectId = uuid();
    
    // Derive project dates from tasks
    let projectStart = null, projectEnd = null;
    for (const task of validation.tasks) {
      const ps = task.plannedStart ? new Date(task.plannedStart) : null;
      const pe = task.plannedEnd ? new Date(task.plannedEnd) : null;
      if (ps && (!projectStart || ps < projectStart)) projectStart = ps;
      if (pe && (!projectEnd || pe > projectEnd)) projectEnd = pe;
    }

    const pStartStr = projectStart ? projectStart.toISOString().split('T')[0] : null;
    const pEndStr = projectEnd ? projectEnd.toISOString().split('T')[0] : null;

    execute(`
      INSERT INTO projects (id, name, project_manager, status_date,
        original_baseline_start, original_baseline_finish,
        current_baseline_start, current_baseline_finish)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectId, projectName || 'Imported Project', projectManager || '',
      statusDate || new Date().toISOString().split('T')[0],
      pStartStr, pEndStr, pStartStr, pEndStr]);

    // Create default calendar
    execute('INSERT INTO calendar_config (id, project_id) VALUES (?, ?)', [uuid(), projectId]);

    // Enrich and import
    enrichAndImport(db, projectId, validation);

    // Audit
    execute(`INSERT INTO audit_events (id, project_id, entity_type, entity_id, action, source, user_name) VALUES (?, ?, 'Project', ?, 'Import', 'Import', 'system')`,
      [uuid(), projectId, projectId]);

    saveDb();

    // Recalculate
    await recalculateProject(projectId);

    const project = queryOne('SELECT * FROM projects WHERE id = ?', [projectId]);
    res.status(201).json({
      project,
      milestones: queryAll('SELECT * FROM milestones WHERE project_id = ?', [projectId]),
      tasks: queryAll('SELECT * FROM tasks WHERE project_id = ?', [projectId]),
      taskCount: validation.tasks.length,
      milestoneCount: validation.milestoneIds.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/import/export/:projectId — Export project to Excel
router.get('/export/:projectId', async (req, res) => {
  try {
    const dashData = await getDashboardData(req.params.projectId);
    const wb = generateExportWorkbook(dashData);
    const buffer = workbookToBuffer(wb);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="schedule-control-${Date.now()}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
