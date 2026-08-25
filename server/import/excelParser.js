/**
 * Excel Import Engine
 * 
 * Parses Excel files, auto-detects columns, validates data,
 * and enriches basic plans into the full schedule model.
 */

import * as XLSX from 'xlsx';
import { v4 as uuid } from 'uuid';
import { parseDate, toISODate } from '../engine/calendarEngine.js';
import { validateDependencies, detectCircularDependencies, buildAdjacencyLists } from '../engine/dependencyEngine.js';

// Common column header patterns for auto-detection
const COLUMN_PATTERNS = {
  task_id: [/task\s*id/i, /activity\s*id/i, /id/i, /wbs/i, /^#$/i],
  milestone: [/milestone/i, /phase/i, /stage/i, /^ms$/i],
  task_name: [/task\s*name/i, /activity\s*name/i, /name/i, /description/i, /task/i, /activity/i],
  planned_start: [/plan.*start/i, /baseline.*start/i, /start\s*date/i, /^start$/i, /planned\s*start/i],
  planned_end: [/plan.*end/i, /plan.*finish/i, /baseline.*end/i, /baseline.*finish/i, /end\s*date/i, /finish\s*date/i, /^end$/i, /^finish$/i, /planned\s*end/i],
  actual_start: [/actual\s*start/i, /act.*start/i],
  actual_end: [/actual\s*end/i, /actual\s*finish/i, /act.*end/i, /act.*finish/i],
  owner: [/owner/i, /assigned/i, /resource/i, /responsible/i],
  predecessor: [/predecessor/i, /pred/i, /depends\s*on/i],
  successor: [/successor/i, /succ/i],
  dependency_type: [/dependency\s*type/i, /dep.*type/i, /link\s*type/i, /type/i],
  percent_complete: [/percent/i, /%\s*complete/i, /progress/i, /completion/i],
};

/**
 * Parse an uploaded Excel file and return sheet data.
 */
export function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheets = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    if (data.length > 1) {
      sheets.push({
        name: sheetName,
        headers: data[0] || [],
        rows: data.slice(1),
        rowCount: data.length - 1,
      });
    }
  }

  return { sheets, sheetNames: workbook.SheetNames };
}

/**
 * Auto-detect column mappings from headers.
 */
export function autoDetectColumns(headers) {
  const mapping = {};
  const used = new Set();

  for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
    for (const pattern of patterns) {
      const idx = headers.findIndex((h, i) => !used.has(i) && pattern.test(String(h || '').trim()));
      if (idx !== -1) {
        mapping[field] = idx;
        used.add(idx);
        break;
      }
    }
  }

  return mapping;
}

/**
 * Validate imported data and return errors/warnings.
 */
export function validateImport(rows, mapping) {
  const errors = [];
  const warnings = [];
  const taskIds = new Set();
  const milestoneIds = new Set();
  const tasks = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for header row and 0-index

    // Skip empty rows
    const hasData = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
    if (!hasData) continue;

    const taskId = mapping.task_id !== undefined ? String(row[mapping.task_id] || '').trim() : '';
    const milestone = mapping.milestone !== undefined ? String(row[mapping.milestone] || '').trim() : '';
    const taskName = mapping.task_name !== undefined ? String(row[mapping.task_name] || '').trim() : '';
    const plannedStart = mapping.planned_start !== undefined ? row[mapping.planned_start] : null;
    const plannedEnd = mapping.planned_end !== undefined ? row[mapping.planned_end] : null;
    const actualStart = mapping.actual_start !== undefined ? row[mapping.actual_start] : null;
    const actualEnd = mapping.actual_end !== undefined ? row[mapping.actual_end] : null;
    const predecessor = mapping.predecessor !== undefined ? String(row[mapping.predecessor] || '').trim() : '';
    const successor = mapping.successor !== undefined ? String(row[mapping.successor] || '').trim() : '';

    // Missing task ID
    if (!taskId) {
      errors.push({ row: rowNum, field: 'Task ID', message: 'Missing Task ID' });
      continue;
    }

    // Duplicate task ID
    if (taskIds.has(taskId)) {
      errors.push({ row: rowNum, field: 'Task ID', message: `Duplicate Task ID: ${taskId}` });
    }
    taskIds.add(taskId);

    // Missing task name
    if (!taskName) {
      warnings.push({ row: rowNum, field: 'Task Name', message: `Missing task name for ${taskId}` });
    }

    // Validate dates
    if (plannedStart && !parseDate(plannedStart)) {
      errors.push({ row: rowNum, field: 'Planned Start', message: `Invalid planned start date for ${taskId}` });
    }
    if (plannedEnd && !parseDate(plannedEnd)) {
      errors.push({ row: rowNum, field: 'Planned End', message: `Invalid planned end date for ${taskId}` });
    }
    if (!plannedStart && !plannedEnd) {
      errors.push({ row: rowNum, field: 'Dates', message: `Missing both planned start and end dates for ${taskId}` });
    }

    // Actual dates
    if (actualStart && !parseDate(actualStart)) {
      warnings.push({ row: rowNum, field: 'Actual Start', message: `Invalid actual start date for ${taskId}` });
    }
    if (actualEnd && !parseDate(actualEnd)) {
      warnings.push({ row: rowNum, field: 'Actual End', message: `Invalid actual end date for ${taskId}` });
    }

    // Actual finish before actual start
    if (actualStart && actualEnd) {
      const aStart = parseDate(actualStart);
      const aEnd = parseDate(actualEnd);
      if (aStart && aEnd && aEnd < aStart) {
        errors.push({ row: rowNum, field: 'Actual Dates', message: `Actual finish before actual start for ${taskId}` });
      }
    }

    // Planned finish before planned start
    if (plannedStart && plannedEnd) {
      const pStart = parseDate(plannedStart);
      const pEnd = parseDate(plannedEnd);
      if (pStart && pEnd && pEnd < pStart) {
        errors.push({ row: rowNum, field: 'Planned Dates', message: `Planned finish before planned start for ${taskId}` });
      }
    }

    if (milestone) milestoneIds.add(milestone);

    tasks.push({
      rowNum,
      taskId,
      milestone,
      taskName,
      plannedStart,
      plannedEnd,
      actualStart,
      actualEnd,
      predecessor,
      successor,
      owner: mapping.owner !== undefined ? String(row[mapping.owner] || '').trim() : '',
      dependencyType: mapping.dependency_type !== undefined ? String(row[mapping.dependency_type] || '').trim() : 'FS',
      percentComplete: mapping.percent_complete !== undefined ? parseFloat(row[mapping.percent_complete]) || 0 : 0,
    });
  }

  // Validate predecessor/successor references
  for (const task of tasks) {
    if (task.predecessor) {
      const predIds = task.predecessor.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      for (const predId of predIds) {
        const cleanId = predId.replace(/\s*(FS|SS|FF|SF)\s*/i, '').trim();
        if (!taskIds.has(cleanId)) {
          warnings.push({ row: task.rowNum, field: 'Predecessor', message: `Predecessor "${cleanId}" does not exist for task ${task.taskId}` });
        }
      }
    }
  }

  // Check for milestones without activities
  const tasksPerMilestone = {};
  for (const task of tasks) {
    if (task.milestone) {
      tasksPerMilestone[task.milestone] = (tasksPerMilestone[task.milestone] || 0) + 1;
    }
  }
  for (const msId of milestoneIds) {
    if (!tasksPerMilestone[msId] || tasksPerMilestone[msId] === 0) {
      warnings.push({ field: 'Milestone', message: `Milestone "${msId}" has no activities` });
    }
  }

  return { errors, warnings, tasks, milestoneIds: [...milestoneIds], taskIds: [...taskIds] };
}

/**
 * Enrich basic plan data into full schedule model and insert into database.
 */
export function enrichAndImport(db, projectId, validatedData) {
  const { tasks, milestoneIds } = validatedData;

  // Create milestones
  const milestoneMap = {};
  let msOrder = 0;

  for (const msId of milestoneIds) {
    const id = uuid();
    const msTasks = tasks.filter(t => t.milestone === msId);
    
    // Derive milestone dates from its tasks
    let msStart = null, msEnd = null, msActStart = null, msActEnd = null;
    let allComplete = msTasks.length > 0;

    for (const t of msTasks) {
      const ps = parseDate(t.plannedStart);
      const pe = parseDate(t.plannedEnd);
      const as = parseDate(t.actualStart);
      const ae = parseDate(t.actualEnd);

      if (ps && (!msStart || ps < msStart)) msStart = ps;
      if (pe && (!msEnd || pe > msEnd)) msEnd = pe;
      if (as && (!msActStart || as < msActStart)) msActStart = as;
      if (ae && (!msActEnd || ae > msActEnd)) msActEnd = ae;
      if (!ae) allComplete = false;
    }

    const msName = msTasks.length > 0 ? `${msId}` : msId;

    db.run(`
      INSERT INTO milestones (id, project_id, milestone_id, name, sort_order,
        original_baseline_start, original_baseline_finish,
        current_baseline_start, current_baseline_finish,
        actual_start, actual_finish)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, projectId, msId, msName, msOrder++,
      msStart ? toISODate(msStart) : null,
      msEnd ? toISODate(msEnd) : null,
      msStart ? toISODate(msStart) : null,  // Current = Original initially
      msEnd ? toISODate(msEnd) : null,
      msActStart ? toISODate(msActStart) : null,
      allComplete && msActEnd ? toISODate(msActEnd) : null,
    ]);

    milestoneMap[msId] = id;
  }

  // Create tasks
  const taskDbIds = {};
  let taskOrder = 0;

  for (const task of tasks) {
    const id = uuid();
    const milestoneDbId = milestoneMap[task.milestone] || null;
    const pStart = parseDate(task.plannedStart);
    const pEnd = parseDate(task.plannedEnd);
    const aStart = parseDate(task.actualStart);
    const aEnd = parseDate(task.actualEnd);

    db.run(`
      INSERT INTO tasks (id, project_id, milestone_id, task_id, name, task_type, sort_order,
        owner, original_baseline_start, original_baseline_finish,
        current_baseline_start, current_baseline_finish,
        actual_start, actual_finish, owner_forecast_finish,
        percent_complete, task_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, projectId, milestoneDbId, task.taskId, task.taskName, 'Activity', taskOrder++,
      task.owner,
      pStart ? toISODate(pStart) : null,
      pEnd ? toISODate(pEnd) : null,
      pStart ? toISODate(pStart) : null,  // Current = Original
      pEnd ? toISODate(pEnd) : null,
      aStart ? toISODate(aStart) : null,
      aEnd ? toISODate(aEnd) : null,
      aEnd ? null : null,  // Don't set forecast for completed tasks
      task.percentComplete || (aEnd ? 100 : 0),
      aEnd ? 'COMPLETED' : 'NOT STARTED',
    ]);

    taskDbIds[task.taskId] = id;
  }

  // Create dependencies
  for (const task of tasks) {
    if (!task.predecessor) continue;

    const predEntries = task.predecessor.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    
    for (const entry of predEntries) {
      // Parse "1.1 FS" or "1.1" format
      const match = entry.match(/^(.+?)\s*(FS|SS|FF|SF)?\s*$/i);
      if (!match) continue;

      const predTaskId = match[1].trim();
      const depType = (match[2] || task.dependencyType || 'FS').toUpperCase();
      const predDbId = taskDbIds[predTaskId];
      const succDbId = taskDbIds[task.taskId];

      if (predDbId && succDbId) {
        try {
          db.run(`
            INSERT INTO dependencies (id, project_id, predecessor_task_id, successor_task_id, dependency_type, lag_days)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [uuid(), projectId, predDbId, succDbId, depType, 0]);
        } catch (e) {
          // Ignore duplicate dependencies
        }
      }
    }
  }

  return { milestoneMap, taskDbIds };
}
