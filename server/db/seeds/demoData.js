/**
 * Demo Data Seed: Enterprise AI Platform
 * 
 * Seeds the database with a realistic project demonstrating:
 * - M1 COMPLETED - LATE (actual finish after baseline)
 * - M2 DELAYED (+25 WD)
 * - M3 DELAYED (+16 WD)
 * - M4 ON TRACK (-3 WD)
 * - M5 DELAYED (+16 WD)
 * - M6 DELAYED (+19 WD)
 * - M7 ON TRACK (0 WD)
 * - M8 ON TRACK (0 WD)
 * 
 * Cumulative milestone slippage = 89 WD
 * Overall project forecast variance = 0 WD (final date protected)
 */

import { getDb, queryAll, execute, saveDb } from '../database.js';
import { migrate } from '../migrations/001_initial.js';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding demo data...');
  const db = await getDb();
  migrate();

  // Clear existing data
  const tables = ['alert_log', 'audit_events', 'baseline_versions', 'change_requests',
    'raid_items', 'recovery_actions', 'weekly_snapshots', 'forecast_history',
    'holidays', 'calendar_config', 'dependencies', 'tasks', 'milestones', 'projects', 'users'];
  for (const t of tables) {
    try { db.run(`DELETE FROM ${t}`); } catch(e) {}
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
  db.run(`INSERT INTO users VALUES (?,?,?,?,?,?,1,datetime('now'),datetime('now'))`, [pmoId, 'pmo', hash, 'PMO Lead', 'pmo@corp.com', 'PMO']);
  db.run(`INSERT INTO users VALUES (?,?,?,?,?,?,1,datetime('now'),datetime('now'))`, [pmId, 'pm', hash, 'Project Manager', 'pm@corp.com', 'PROJECT_MANAGER']);
  db.run(`INSERT INTO users VALUES (?,?,?,?,?,?,1,datetime('now'),datetime('now'))`, [execId, 'cto', hash, 'CTO', 'cto@corp.com', 'EXECUTIVE']);

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
    'Enterprise-grade GenAI platform build including infrastructure, data foundation, application layer, and go-live readiness.',
    'Project Manager',
    '2026-08-22',
    '2026-06-16',
    '2026-11-27',
    '2026-06-16',
    '2026-11-27',
    5,
    adminId,
  ]);

  // Calendar
  db.run(`INSERT INTO calendar_config (id, project_id) VALUES (?, ?)`, [uuid(), projectId]);

  // ============================================================
  // MILESTONES & TASKS
  // ============================================================
  const milestones = [
    {
      msId: 'M1', name: 'Platform POC & Finalization',
      blStart: '2026-06-16', blFinish: '2026-07-07',
      actStart: '2026-06-16', actFinish: '2026-07-24',
      stage: 'Completed',
      tasks: [
        { id: '1.1', name: 'POC Activity - Red Hat Platform', blStart: '2026-06-16', blEnd: '2026-06-27', actStart: '2026-06-16', actEnd: '2026-07-04', owner: 'Infra Lead' },
        { id: '1.2', name: 'POC Activity - Dify.ai', blStart: '2026-06-16', blEnd: '2026-06-27', actStart: '2026-06-16', actEnd: '2026-07-07', owner: 'Platform Lead' },
        { id: '1.3', name: 'Platform Evaluation & Selection', blStart: '2026-06-30', blEnd: '2026-07-04', actStart: '2026-07-07', actEnd: '2026-07-14', owner: 'Architect', pred: '1.1,1.2' },
        { id: '1.4', name: 'Architecture Finalization', blStart: '2026-07-02', blEnd: '2026-07-07', actStart: '2026-07-14', actEnd: '2026-07-24', owner: 'Architect', pred: '1.3' },
      ],
    },
    {
      msId: 'M2', name: 'Commercials & Vendor Onboarding',
      blStart: '2026-07-07', blFinish: '2026-07-31',
      actStart: '2026-07-14', actFinish: null,
      forecast: '2026-09-04',
      stage: 'In Progress',
      tasks: [
        { id: '2.1', name: 'SOW Finalization', blStart: '2026-07-07', blEnd: '2026-07-18', actStart: '2026-07-14', actEnd: '2026-08-01', owner: 'Procurement', pred: '1.4' },
        { id: '2.2', name: 'Vendor Onboarding & Procurement', blStart: '2026-07-14', blEnd: '2026-07-25', actStart: '2026-08-01', actEnd: null, fcst: '2026-08-22', owner: 'Procurement', pred: '2.1' },
        { id: '2.3', name: 'License Provisioning', blStart: '2026-07-21', blEnd: '2026-07-31', actStart: null, actEnd: null, fcst: '2026-09-04', owner: 'Vendor Lead', pred: '2.2' },
      ],
    },
    {
      msId: 'M3', name: 'Infrastructure & Env Provisioning',
      blStart: '2026-07-21', blFinish: '2026-08-27',
      actStart: '2026-08-04', actFinish: null,
      forecast: '2026-09-18',
      stage: 'In Progress',
      tasks: [
        { id: '3.1', name: 'Cloud Infrastructure Setup', blStart: '2026-07-21', blEnd: '2026-08-04', actStart: '2026-08-04', actEnd: '2026-08-18', owner: 'Cloud Lead', pred: '2.1' },
        { id: '3.2', name: 'Network & Security Configuration', blStart: '2026-08-04', blEnd: '2026-08-14', actStart: '2026-08-18', actEnd: null, fcst: '2026-09-01', owner: 'Network Lead', pred: '3.1' },
        { id: '3.3', name: 'Dev/UAT/Prod Env Provisioning', blStart: '2026-08-11', blEnd: '2026-08-22', actStart: null, actEnd: null, fcst: '2026-09-12', owner: 'Infra Lead', pred: '3.2' },
        { id: '3.4', name: 'CI/CD Pipeline Setup', blStart: '2026-08-18', blEnd: '2026-08-27', actStart: null, actEnd: null, fcst: '2026-09-18', owner: 'DevOps Lead', pred: '3.3' },
      ],
    },
    {
      msId: 'M4', name: 'Core Platform Deployment',
      blStart: '2026-08-25', blFinish: '2026-09-15',
      actStart: null, actFinish: null,
      forecast: '2026-09-12',
      stage: 'Planned',
      tasks: [
        { id: '4.1', name: 'Platform Installation & Config', blStart: '2026-08-25', blEnd: '2026-09-04', actStart: null, actEnd: null, fcst: '2026-09-01', owner: 'Platform Lead', pred: '3.4' },
        { id: '4.2', name: 'Core Services Deployment', blStart: '2026-09-01', blEnd: '2026-09-08', actStart: null, actEnd: null, fcst: '2026-09-05', owner: 'Platform Lead', pred: '4.1' },
        { id: '4.3', name: 'Platform Integration Testing', blStart: '2026-09-08', blEnd: '2026-09-15', actStart: null, actEnd: null, fcst: '2026-09-12', owner: 'QA Lead', pred: '4.2' },
      ],
    },
    {
      msId: 'M5', name: 'Data Foundation & Integration',
      blStart: '2026-09-08', blFinish: '2026-10-04',
      actStart: null, actFinish: null,
      forecast: '2026-10-28',
      stage: 'Planned',
      tasks: [
        { id: '5.1', name: 'Data Pipeline Architecture', blStart: '2026-09-08', blEnd: '2026-09-15', actStart: null, actEnd: null, fcst: '2026-09-22', owner: 'Data Architect', pred: '4.2' },
        { id: '5.2', name: 'ETL Development', blStart: '2026-09-15', blEnd: '2026-09-26', actStart: null, actEnd: null, fcst: '2026-10-10', owner: 'Data Engineer', pred: '5.1' },
        { id: '5.3', name: 'Data Quality & Governance', blStart: '2026-09-22', blEnd: '2026-10-01', actStart: null, actEnd: null, fcst: '2026-10-20', owner: 'Data Lead', pred: '5.2' },
        { id: '5.4', name: 'Source System Integration', blStart: '2026-09-26', blEnd: '2026-10-04', actStart: null, actEnd: null, fcst: '2026-10-28', owner: 'Integration Lead', pred: '5.3' },
      ],
    },
    {
      msId: 'M6', name: 'Application Build & Testing',
      blStart: '2026-09-29', blFinish: '2026-11-01',
      actStart: null, actFinish: null,
      forecast: '2026-11-28',
      stage: 'Planned',
      tasks: [
        { id: '6.1', name: 'Application Development Sprint 1', blStart: '2026-09-29', blEnd: '2026-10-10', actStart: null, actEnd: null, fcst: '2026-10-24', owner: 'Dev Lead', pred: '4.3' },
        { id: '6.2', name: 'Application Development Sprint 2', blStart: '2026-10-10', blEnd: '2026-10-20', actStart: null, actEnd: null, fcst: '2026-11-07', owner: 'Dev Lead', pred: '6.1' },
        { id: '6.3', name: 'System Integration Testing', blStart: '2026-10-20', blEnd: '2026-10-28', actStart: null, actEnd: null, fcst: '2026-11-17', owner: 'QA Lead', pred: '6.2,5.4' },
        { id: '6.4', name: 'Performance & Security Testing', blStart: '2026-10-27', blEnd: '2026-11-01', actStart: null, actEnd: null, fcst: '2026-11-28', owner: 'QA Lead', pred: '6.3' },
      ],
    },
    {
      msId: 'M7', name: 'UAT & Go-Live Readiness',
      blStart: '2026-10-28', blFinish: '2026-11-15',
      actStart: null, actFinish: null,
      forecast: '2026-11-15',
      stage: 'Planned',
      tasks: [
        { id: '7.1', name: 'UAT Preparation', blStart: '2026-10-28', blEnd: '2026-11-03', actStart: null, actEnd: null, fcst: '2026-11-03', owner: 'BA Lead', pred: '6.3' },
        { id: '7.2', name: 'UAT Execution', blStart: '2026-11-03', blEnd: '2026-11-10', actStart: null, actEnd: null, fcst: '2026-11-10', owner: 'Business Lead', pred: '7.1' },
        { id: '7.3', name: 'Go-Live Readiness Assessment', blStart: '2026-11-10', blEnd: '2026-11-15', actStart: null, actEnd: null, fcst: '2026-11-15', owner: 'PM', pred: '7.2,6.4' },
      ],
    },
    {
      msId: 'M8', name: 'Go-Live & Hypercare',
      blStart: '2026-11-15', blFinish: '2026-11-27',
      actStart: null, actFinish: null,
      forecast: '2026-11-27',
      stage: 'Planned',
      tasks: [
        { id: '8.1', name: 'Production Deployment', blStart: '2026-11-15', blEnd: '2026-11-18', actStart: null, actEnd: null, fcst: '2026-11-18', owner: 'DevOps Lead', pred: '7.3' },
        { id: '8.2', name: 'Go-Live Cutover', blStart: '2026-11-18', blEnd: '2026-11-20', actStart: null, actEnd: null, fcst: '2026-11-20', owner: 'PM', pred: '8.1' },
        { id: '8.3', name: 'Hypercare & Stabilization', blStart: '2026-11-20', blEnd: '2026-11-27', actStart: null, actEnd: null, fcst: '2026-11-27', owner: 'Support Lead', pred: '8.2' },
      ],
    },
  ];

  const taskDbIds = {};

  for (let mi = 0; mi < milestones.length; mi++) {
    const ms = milestones[mi];
    const msDbId = uuid();

    db.run(`
      INSERT INTO milestones (id, project_id, milestone_id, name, sort_order,
        original_baseline_start, original_baseline_finish,
        current_baseline_start, current_baseline_finish,
        actual_start, actual_finish,
        owner_forecast_finish, stage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      msDbId, projectId, ms.msId, ms.name, mi,
      ms.blStart, ms.blFinish,
      ms.blStart, ms.blFinish,
      ms.actStart, ms.actFinish,
      ms.forecast || null,
      ms.stage || 'Planned',
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
        taskDbId, projectId, msDbId, t.id, t.name, mi * 100 + ti,
        t.owner || '',
        t.blStart, t.blEnd,
        t.blStart, t.blEnd,
        t.actStart || null, t.actEnd || null,
        t.actEnd ? null : (t.fcst || null),
        t.actEnd ? 100 : (t.fcst ? 50 : 0),
      ]);
    }
  }

  // Create dependencies
  for (const ms of milestones) {
    for (const t of ms.tasks) {
      if (!t.pred) continue;
      const predIds = t.pred.split(',').map(s => s.trim());
      for (const predId of predIds) {
        const predDbId = taskDbIds[predId];
        const succDbId = taskDbIds[t.id];
        if (predDbId && succDbId) {
          db.run(`INSERT INTO dependencies (id, project_id, predecessor_task_id, successor_task_id, dependency_type) VALUES (?, ?, ?, ?, 'FS')`,
            [uuid(), projectId, predDbId, succDbId]);
        }
      }
    }
  }

  // ============================================================
  // RAID ITEMS
  // ============================================================
  db.run(`INSERT INTO raid_items (id, project_id, raid_id, type, date_raised, description, probability, impact, owner, due_date, mitigation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, 'R-001', 'Risk', '2026-07-14', 'Vendor onboarding delay may impact infrastructure provisioning timeline', 'High', 'High', 'Procurement', '2026-08-15', 'Expedite procurement process; engage alternative vendors as backup', 'Monitoring']);
  
  db.run(`INSERT INTO raid_items (id, project_id, raid_id, type, date_raised, description, probability, impact, owner, due_date, mitigation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, 'R-002', 'Risk', '2026-08-04', 'Resource constraints in Data Engineering team may delay ETL development', 'Medium', 'High', 'Data Lead', '2026-09-15', 'Cross-train team members; consider contractor augmentation', 'Open']);

  db.run(`INSERT INTO raid_items (id, project_id, raid_id, type, date_raised, description, probability, impact, owner, due_date, mitigation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, 'I-001', 'Issue', '2026-07-24', 'Platform POC completed 13 WD late due to extended evaluation', 'High', 'Medium', 'Architect', '2026-08-01', 'Accepted — downstream schedule adjusted through parallel execution', 'Closed']);

  db.run(`INSERT INTO raid_items (id, project_id, raid_id, type, date_raised, description, probability, impact, owner, due_date, mitigation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, 'D-001', 'Dependency', '2026-06-16', 'License provisioning depends on vendor onboarding completion', 'High', 'High', 'Vendor Lead', '2026-09-04', 'Track weekly with vendor', 'Open']);

  db.run(`INSERT INTO raid_items (id, project_id, raid_id, type, date_raised, description, probability, impact, owner, due_date, mitigation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, 'A-001', 'Assumption', '2026-06-16', 'Cloud infrastructure will be available within 2 weeks of request', 'Medium', 'High', 'Cloud Lead', '2026-08-18', 'Pre-approved capacity allocation confirmed', 'Monitoring']);

  // ============================================================
  // RECOVERY ACTIONS
  // ============================================================
  db.run(`INSERT INTO recovery_actions (id, project_id, task_id, variance_cause, action_description, recovery_owner, recovery_date, expected_days_recovered, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, taskDbIds['2.2'], 'Vendor onboarding delays', 'Fast-track procurement approval process', 'Procurement', '2026-08-29', 5, 'In Progress']);

  db.run(`INSERT INTO recovery_actions (id, project_id, task_id, variance_cause, action_description, recovery_owner, recovery_date, expected_days_recovered, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, taskDbIds['3.2'], 'Late infrastructure handover', 'Parallel network configuration with partial infrastructure', 'Network Lead', '2026-09-05', 3, 'In Progress']);

  // ============================================================
  // WEEKLY SNAPSHOT (Week 1)
  // ============================================================
  db.run(`INSERT INTO weekly_snapshots (id, project_id, status_date, week_number, current_baseline_finish, project_forecast_finish, forecast_variance_current_wd, forecast_variance_original_wd, overall_status, historical_max_variance_wd, recovery_achieved_wd, top_schedule_driver, critical_path_risk, milestones_on_track, milestones_at_risk, milestones_delayed, milestones_completed, cumulative_milestone_slippage, schedule_health, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), projectId, '2026-08-22', 1, '2026-11-27', '2026-11-27', 0, 0, 'AT RISK - FINAL DATE PROTECTED', 25, 0, 'M2 - Vendor Onboarding Delay', '2 critical tasks at risk', 3, 0, 4, 1, 89, 'Watch', 'Initial weekly review. 5 milestones forecast late but project finish protected.', pmId]);

  saveDb();
  console.log('✅ Demo data seeded successfully.');
  console.log(`   Project: Enterprise AI Platform (${projectId})`);
  console.log('   Users: admin/pmo/pm/cto (password: password)');
}

// Run if called directly
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('demoData.js')) {
  seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}

export { seed };
