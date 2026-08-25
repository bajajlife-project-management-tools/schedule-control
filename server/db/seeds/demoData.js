/**
 * Exact Enterprise AI Platform Schedule Data Loader
 * 
 * Accurately loads all 8 milestones and 36 activities with exact planned,
 * actual, forecast dates, percent complete, status date (24-Aug-2026),
 * start variances, finish variances, and network dependencies.
 */

import { getDb, queryAll, execute, saveDb } from '../database.js';
import { migrate } from '../migrations/001_initial.js';
import { recalculateProject } from '../../engine/scheduleOrchestrator.js';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Loading exact Enterprise AI Platform schedule dataset...');
  const db = await getDb();
  migrate();

  // Clear existing project data
  const tables = ['alert_log', 'audit_events', 'baseline_versions', 'change_requests',
    'raid_items', 'recovery_actions', 'weekly_snapshots', 'forecast_history',
    'holidays', 'calendar_config', 'dependencies', 'tasks', 'milestones', 'projects', 'users'];
  for (const t of tables) {
    try { db.run(`DELETE FROM ${t}`); } catch (e) {}
  }

  // ============================================================
  // USERS
  // ============================================================
  const adminId = uuid();
  const pmoId = uuid();
  const pmId = uuid();
  const execId = uuid();
  const hash = bcrypt.hashSync('password', 10);

  db.run(`INSERT INTO users VALUES (?,?,?,?,?,?,1,datetime('now'),datetime('now'))`, [adminId, 'admin', hash, 'System Admin', 'admin@corp.com', 'ADMIN']);
  db.run(`INSERT INTO users VALUES (?,?,?,?,?,?,1,datetime('now'),datetime('now'))`, [pmoId, 'pmo', hash, 'PMO Director', 'pmo@corp.com', 'PMO']);
  db.run(`INSERT INTO users VALUES (?,?,?,?,?,?,1,datetime('now'),datetime('now'))`, [pmId, 'pm', hash, 'Lead Project Manager', 'pm@corp.com', 'PROJECT_MANAGER']);
  db.run(`INSERT INTO users VALUES (?,?,?,?,?,?,1,datetime('now'),datetime('now'))`, [execId, 'cto', hash, 'Chief Technology Officer', 'cto@corp.com', 'EXECUTIVE']);

  // ============================================================
  // PROJECT
  // ============================================================
  const projectId = uuid();
  db.run(`
    INSERT INTO projects (id, name, description, project_manager, status_date,
      original_baseline_start, original_baseline_finish,
      current_baseline_start, current_baseline_finish,
      tolerance_days, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    projectId,
    'Enterprise AI Platform',
    'Enterprise-grade GenAI & Agentic AI Platform — Complete schedule control, forecasting, float & critical path governance.',
    'Lead Project Manager',
    '2026-08-24',
    '2026-05-04',
    '2026-11-27',
    '2026-05-04',
    '2026-11-27',
    5,
    adminId,
  ]);

  // Calendar
  db.run(`INSERT INTO calendar_config (id, project_id) VALUES (?, ?)`, [uuid(), projectId]);

  // ============================================================
  // EXACT MILESTONES & ACTIVITIES
  // ============================================================
  const rawMilestones = [
    {
      code: 'M1',
      idNum: '1',
      name: 'Platform POC & Finalization',
      blStart: '2026-05-04',
      blFinish: '2026-07-07',
      actStart: '2026-05-04',
      actFinish: '2026-07-24',
      forecast: '2026-07-24',
      percent: 100,
      status: 'COMPLETED - LATE',
      tasks: [
        { id: '1.1', name: 'POC Activity - Red Hat Platform', blStart: '2026-05-04', blEnd: '2026-05-29', actStart: '2026-05-04', actEnd: '2026-07-24', fcst: null, pct: 100, owner: 'RedHat Lead', pred: '' },
        { id: '1.2', name: 'POC Activity - Dify.ai', blStart: '2026-05-04', blEnd: '2026-06-26', actStart: '2026-05-04', actEnd: '2026-06-26', fcst: null, pct: 100, owner: 'Platform Lead', pred: '' },
        { id: '1.3', name: 'Platform & Services Evaluation - Shakti Studio & Cloud', blStart: '2026-05-04', blEnd: '2026-05-30', actStart: '2026-05-04', actEnd: '2026-05-30', fcst: null, pct: 100, owner: 'Architect', pred: '' },
        { id: '1.4', name: 'Platform & Services Evaluation - NTT Data & Niveus', blStart: '2026-06-15', blEnd: '2026-06-30', actStart: '2026-06-17', actEnd: '2026-06-30', fcst: null, pct: 100, owner: 'Architect', pred: '' },
        { id: '1.5', name: 'Platform & Services Evaluation - Tata Communications - Vayu', blStart: '2026-06-22', blEnd: '2026-07-07', actStart: '2026-06-22', actEnd: '2026-07-11', fcst: '2026-07-11', pct: 100, owner: 'Infra Lead', pred: '' },
        { id: '1.6', name: 'Platform & Services Evaluation - IBM WatsonX', blStart: '2026-06-22', blEnd: '2026-07-05', actStart: '2026-06-25', actEnd: '2026-07-09', fcst: '2026-07-09', pct: 100, owner: 'AI Lead', pred: '' },
      ],
    },
    {
      code: 'M2',
      idNum: '2',
      name: 'Commercials & Vendor Onboarding',
      blStart: '2026-06-10',
      blFinish: '2026-07-31',
      actStart: '2026-06-29',
      actFinish: null,
      forecast: '2026-09-04',
      percent: 75,
      status: 'AT RISK',
      tasks: [
        { id: '2.1', name: 'SOW Finalization & sign-off (Yotta & RedHat)', blStart: '2026-06-10', blEnd: '2026-06-19', actStart: '2026-06-29', actEnd: '2026-07-20', fcst: '2026-07-20', pct: 100, owner: 'Procurement Lead', pred: '1.1,1.2,1.3' },
        { id: '2.2', name: 'Vendor On-boarding (Shakti Cloud [Yotta] / NTT Data / Vayu)', blStart: '2026-06-10', blEnd: '2026-07-31', actStart: '2026-07-13', actEnd: null, fcst: '2026-08-28', pct: 80, owner: 'Vendor Lead', pred: '2.1' },
        { id: '2.3', name: 'Vendor On-boarding (RedHat - OpenShift AI)', blStart: '2026-06-10', blEnd: '2026-07-31', actStart: '2026-07-13', actEnd: null, fcst: '2026-09-04', pct: 40, owner: 'Vendor Lead', pred: '2.1' },
      ],
    },
    {
      code: 'M3',
      idNum: '3',
      name: 'Foundational Infra & Platform Enablement',
      blStart: '2026-06-10',
      blFinish: '2026-08-27',
      actStart: '2026-06-10',
      actFinish: null,
      forecast: '2026-09-18',
      percent: 35,
      status: 'AT RISK',
      tasks: [
        { id: '3.1', name: 'DB Setup (Vector, Caching, Metadata)', blStart: '2026-06-10', blEnd: '2026-06-30', actStart: '2026-06-10', actEnd: '2026-06-30', fcst: null, pct: 100, owner: 'Data Engineer', pred: '' },
        { id: '3.2', name: 'Dify.ai / RedHat Platform Onboarding', blStart: '2026-07-15', blEnd: '2026-07-31', actStart: null, actEnd: null, fcst: '2026-09-18', pct: 0, owner: 'Platform Lead', pred: '2.3' },
        { id: '3.3', name: 'Infra Setup - Raja Lite VPC / DC', blStart: '2026-07-15', blEnd: '2026-07-31', actStart: null, actEnd: null, fcst: '2026-09-18', pct: 0, owner: 'Infra Lead', pred: '2.2' },
        { id: '3.4', name: 'Infra Setup - Shakti Cloud (Yotta)', blStart: '2026-07-20', blEnd: '2026-08-05', actStart: null, actEnd: null, fcst: '2026-09-11', pct: 0, owner: 'Cloud Lead', pred: '2.2' },
        { id: '3.5', name: 'Guardrails Configuration', blStart: '2026-07-20', blEnd: '2026-08-27', actStart: '2026-07-20', actEnd: '2026-08-21', fcst: null, pct: 100, owner: 'Security Lead', pred: '3.1' },
        { id: '3.6', name: 'Network Setup', blStart: '2026-08-05', blEnd: '2026-08-20', actStart: null, actEnd: null, fcst: '2026-09-11', pct: 0, owner: 'Network Lead', pred: '3.3' },
      ],
    },
    {
      code: 'M4',
      idNum: '4',
      name: 'Feature Engineering',
      blStart: '2026-07-10',
      blFinish: '2026-09-30',
      actStart: '2026-07-10',
      actFinish: null,
      forecast: '2026-09-30',
      percent: 31,
      status: 'ON TRACK',
      tasks: [
        { id: '4.1', name: 'Feature Store - PL - Sales Intelligence Mart', blStart: '2026-07-10', blEnd: '2026-08-31', actStart: '2026-07-10', actEnd: null, fcst: '2026-08-31', pct: 40, owner: 'Data Lead', pred: '3.1' },
        { id: '4.2', name: 'Feature Store - PL - Ops Features Mart', blStart: '2026-07-10', blEnd: '2026-08-28', actStart: '2026-07-10', actEnd: null, fcst: '2026-08-28', pct: 40, owner: 'Data Lead', pred: '3.1' },
        { id: '4.3', name: 'Feature Store - PL - Bureau Features Mart', blStart: '2026-07-10', blEnd: '2026-08-28', actStart: '2026-07-10', actEnd: null, fcst: '2026-08-28', pct: 40, owner: 'Data Lead', pred: '3.1' },
        { id: '4.4', name: 'Feature Store - PL - KPI Mart (Phase 1)', blStart: '2026-07-10', blEnd: '2026-08-28', actStart: '2026-07-10', actEnd: null, fcst: '2026-08-28', pct: 40, owner: 'Data Lead', pred: '3.1' },
        { id: '4.5', name: 'Feature Store - PL - Customer Features Mart', blStart: '2026-07-10', blEnd: '2026-09-30', actStart: '2026-07-10', actEnd: null, fcst: '2026-09-30', pct: 20, owner: 'Data Lead', pred: '4.1' },
        { id: '4.6', name: 'AI Agents - Sales Insights Generator', blStart: '2026-07-15', blEnd: '2026-09-30', actStart: '2026-07-15', actEnd: null, fcst: '2026-09-30', pct: 20, owner: 'AI Engineer', pred: '4.1' },
        { id: '4.7', name: 'AI Agents - Data Analysis Agent (Data Lens)', blStart: '2026-07-15', blEnd: '2026-09-30', actStart: '2026-07-15', actEnd: null, fcst: '2026-09-30', pct: 20, owner: 'AI Engineer', pred: '4.2' },
      ],
    },
    {
      code: 'M5',
      idNum: '5',
      name: 'Core AI Platform Services',
      blStart: '2026-08-31',
      blFinish: '2026-09-17',
      actStart: null,
      actFinish: null,
      forecast: '2026-10-10',
      percent: 0,
      status: 'AT RISK',
      tasks: [
        { id: '5.1', name: 'RAG Orchestrator Configuration', blStart: '2026-08-31', blEnd: '2026-09-15', actStart: null, actEnd: null, fcst: '2026-10-05', pct: 0, owner: 'AI Lead', pred: '3.2,3.4' },
        { id: '5.2', name: 'Embedding Service Development / Config', blStart: '2026-08-31', blEnd: '2026-09-07', actStart: null, actEnd: null, fcst: '2026-10-05', pct: 0, owner: 'AI Lead', pred: '3.2,3.4' },
        { id: '5.3', name: 'Model Router / Serving / Registry / Eval', blStart: '2026-09-01', blEnd: '2026-09-17', actStart: null, actEnd: null, fcst: '2026-10-10', pct: 0, owner: 'MLOps Lead', pred: '5.1,5.2' },
      ],
    },
    {
      code: 'M6',
      idNum: '6',
      name: 'POC Demo, Handover & AI/ML Ops',
      blStart: '2026-09-18',
      blFinish: '2026-10-05',
      actStart: null,
      actFinish: null,
      forecast: '2026-10-30',
      percent: 0,
      status: 'AT RISK',
      tasks: [
        { id: '6.1', name: 'Launch Demo', blStart: '2026-09-18', blEnd: '2026-09-18', actStart: null, actEnd: null, fcst: '2026-10-16', pct: 0, owner: 'PM', pred: '5.3' },
        { id: '6.2', name: 'CI/CD Setup (GitLab)', blStart: '2026-09-18', blEnd: '2026-10-05', actStart: null, actEnd: null, fcst: '2026-10-30', pct: 0, owner: 'DevOps Lead', pred: '5.3' },
        { id: '6.3', name: 'User Training & Handover', blStart: '2026-09-21', blEnd: '2026-10-05', actStart: null, actEnd: null, fcst: '2026-10-30', pct: 0, owner: 'Support Lead', pred: '6.1' },
      ],
    },
    {
      code: 'M7',
      idNum: '7',
      name: 'BRD Generation for Tech (Use Case 1)',
      blStart: '2026-08-20',
      blFinish: '2026-10-16',
      actStart: '2026-08-14',
      actFinish: null,
      forecast: '2026-10-16',
      percent: 6,
      status: 'ON TRACK',
      tasks: [
        { id: '7.1', name: 'BRD - Use Case Discovery', blStart: '2026-08-20', blEnd: '2026-08-31', actStart: '2026-08-14', actEnd: null, fcst: '2026-08-31', pct: 10, owner: 'BA Lead', pred: '' },
        { id: '7.2', name: 'BRD - Requirement Doc & Sign-off', blStart: '2026-09-01', blEnd: '2026-09-15', actStart: null, actEnd: null, fcst: '2026-09-15', pct: 0, owner: 'BA Lead', pred: '7.1' },
        { id: '7.3', name: 'BRD - Onboarding / Development', blStart: '2026-09-16', blEnd: '2026-10-05', actStart: null, actEnd: null, fcst: '2026-10-05', pct: 0, owner: 'Dev Lead', pred: '7.2,6.2' },
        { id: '7.4', name: 'BRD - Testing & Go-Live', blStart: '2026-10-06', blEnd: '2026-10-16', actStart: null, actEnd: null, fcst: '2026-10-16', pct: 0, owner: 'QA Lead', pred: '7.3' },
      ],
    },
    {
      code: 'M8',
      idNum: '8',
      name: 'Legacy Use Case Migration (Analytics + Enterprise)',
      blStart: '2026-09-28',
      blFinish: '2026-11-27',
      actStart: null,
      actFinish: null,
      forecast: '2026-11-27',
      percent: 0,
      status: 'ON TRACK',
      tasks: [
        { id: '8.1', name: 'Analytics - Discovery & Migration Plan', blStart: '2026-09-28', blEnd: '2026-10-12', actStart: null, actEnd: null, fcst: '2026-10-12', pct: 0, owner: 'Data Architect', pred: '7.2' },
        { id: '8.2', name: 'Enterprise - Discovery & Migration Plan', blStart: '2026-09-28', blEnd: '2026-10-12', actStart: null, actEnd: null, fcst: '2026-10-12', pct: 0, owner: 'Enterprise Arch', pred: '7.2' },
        { id: '8.3', name: 'Analytics - On-boarding', blStart: '2026-10-13', blEnd: '2026-11-10', actStart: null, actEnd: null, fcst: '2026-11-10', pct: 0, owner: 'Data Engineer', pred: '8.1,6.3' },
        { id: '8.4', name: 'Analytics - Testing & Go-Live', blStart: '2026-10-28', blEnd: '2026-11-10', actStart: null, actEnd: null, fcst: '2026-11-10', pct: 0, owner: 'QA Lead', pred: '8.3' },
        { id: '8.5', name: 'Enterprise - On-boarding', blStart: '2026-10-13', blEnd: '2026-11-10', actStart: null, actEnd: null, fcst: '2026-11-10', pct: 0, owner: 'Integration Lead', pred: '8.2,6.3' },
        { id: '8.6', name: 'Enterprise - Testing & Go-Live', blStart: '2026-11-11', blEnd: '2026-11-27', actStart: null, actEnd: null, fcst: '2026-11-27', pct: 0, owner: 'Release PM', pred: '8.4,8.5' },
      ],
    },
  ];

  const taskDbIds = {};
  let taskOrder = 0;

  for (let mi = 0; mi < rawMilestones.length; mi++) {
    const ms = rawMilestones[mi];
    const msDbId = uuid();

    db.run(`
      INSERT INTO milestones (id, project_id, milestone_id, name, sort_order,
        original_baseline_start, original_baseline_finish,
        current_baseline_start, current_baseline_finish,
        actual_start, actual_finish,
        owner_forecast_finish, stage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      msDbId, projectId, ms.code, ms.name, mi,
      ms.blStart, ms.blFinish,
      ms.blStart, ms.blFinish,
      ms.actStart || null, ms.actFinish || null,
      ms.forecast || null,
      ms.actFinish ? 'Completed' : (ms.actStart ? 'In Progress' : 'Planned'),
    ]);

    for (let ti = 0; ti < ms.tasks.length; ti++) {
      const t = ms.tasks[ti];
      const taskDbId = uuid();
      taskDbIds[t.id] = taskDbId;

      db.run(`
        INSERT INTO tasks (id, project_id, milestone_id, task_id, name, task_type, sort_order,
          owner, original_baseline_start, original_baseline_finish,
          current_baseline_start, current_baseline_finish,
          actual_start, actual_finish, owner_forecast_finish,
          percent_complete)
        VALUES (?, ?, ?, ?, ?, 'Activity', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        taskDbId, projectId, msDbId, t.id, t.name, taskOrder++,
        t.owner || '',
        t.blStart, t.blEnd,
        t.blStart, t.blEnd,
        t.actStart || null, t.actEnd || null,
        t.actEnd ? null : (t.fcst || null),
        t.pct || 0,
      ]);
    }
  }

  // ============================================================
  // DEPENDENCIES (Linking Predecessors to Successors)
  // ============================================================
  for (const ms of rawMilestones) {
    for (const t of ms.tasks) {
      if (!t.pred) continue;
      const predIds = t.pred.split(',').map(s => s.trim()).filter(Boolean);
      for (const predId of predIds) {
        const predDbId = taskDbIds[predId];
        const succDbId = taskDbIds[t.id];
        if (predDbId && succDbId) {
          db.run(`
            INSERT INTO dependencies (id, project_id, predecessor_task_id, successor_task_id, dependency_type, lag_days)
            VALUES (?, ?, ?, ?, 'FS', 0)
          `, [uuid(), projectId, predDbId, succDbId]);
        }
      }
    }
  }

  // ============================================================
  // RAID ITEMS
  // ============================================================
  db.run(`INSERT INTO raid_items (id, project_id, raid_id, type, date_raised, description, probability, impact, owner, due_date, mitigation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, 'R-001', 'Risk', '2026-06-29', 'Vendor on-boarding delay (RedHat OpenShift AI & Yotta) impacting platform enablement timeline', 'High', 'High', 'Vendor Lead', '2026-09-04', 'Daily vendor standups, expedited procurement escalation, parallel infra preparation', 'Open']);

  db.run(`INSERT INTO raid_items (id, project_id, raid_id, type, date_raised, description, probability, impact, owner, due_date, mitigation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, 'R-002', 'Risk', '2026-07-20', 'Infra setup & VPC provisioning dependencies with Raja Lite and Shakti Cloud', 'High', 'High', 'Infra Lead', '2026-09-18', 'Pre-provision baseline VM network and security configurations', 'Monitoring']);

  db.run(`INSERT INTO raid_items (id, project_id, raid_id, type, date_raised, description, probability, impact, owner, due_date, mitigation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, 'I-001', 'Issue', '2026-07-24', 'POC Activity - Red Hat Platform completed 40 working days late due to extensive evaluation', 'High', 'Medium', 'RedHat Lead', '2026-07-24', 'Accepted — downstream tasks fast-tracked via parallel execution', 'Closed']);

  // ============================================================
  // RECOVERY ACTIONS
  // ============================================================
  db.run(`INSERT INTO recovery_actions (id, project_id, task_id, variance_cause, action_description, recovery_owner, recovery_date, expected_days_recovered, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, taskDbIds['2.3'], 'Vendor contract negotiations delay', 'Accelerated executive sign-off & parallel cloud workspace setup', 'Vendor Lead', '2026-09-04', 5, 'In Progress']);

  db.run(`INSERT INTO recovery_actions (id, project_id, task_id, variance_cause, action_description, recovery_owner, recovery_date, expected_days_recovered, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, taskDbIds['3.2'], 'Upstream vendor onboarding lag', 'Crash onboarding schedule with dedicated vendor engineers', 'Platform Lead', '2026-09-18', 4, 'In Progress']);

  // ============================================================
  // WEEKLY SNAPSHOT
  // ============================================================
  db.run(`INSERT INTO weekly_snapshots (id, project_id, status_date, week_number, current_baseline_finish, project_forecast_finish, forecast_variance_current_wd, forecast_variance_original_wd, overall_status, historical_max_variance_wd, recovery_achieved_wd, top_schedule_driver, critical_path_risk, milestones_on_track, milestones_at_risk, milestones_delayed, milestones_completed, cumulative_milestone_slippage, schedule_health, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, '2026-08-24', 1, '2026-11-27', '2026-11-27', 0, 0, 'AT RISK - FINAL DATE PROTECTED', 25, 0, 'M2/M3 - Vendor Onboarding & Platform Enablement', '3 critical tasks at risk', 3, 4, 0, 1, 91, 'Watch', 'Weekly review as of 24-Aug-2026. M1 completed late; M2, M3, M5, M6 under pressure but downstream path absorbs variance to 27-Nov-2026.', pmId]);

  saveDb();

  // Run full schedule recalculation to derive CPM, Total Float, Free Float, and Variances
  console.log('⚡ Running schedule calculation engine...');
  await recalculateProject(projectId);

  console.log('✅ Exact Enterprise AI Platform schedule successfully loaded & calculated.');
  console.log(`   Project ID: ${projectId}`);
  console.log(`   Milestones: ${rawMilestones.length} (M1 to M8)`);
  console.log(`   Activities: ${taskOrder}`);
}

// Run if called directly
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('demoData.js')) {
  seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}

export { seed };
