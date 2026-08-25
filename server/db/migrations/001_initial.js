import { getDb, execSQL } from '../database.js';

export function migrate() {
  execSQL(`
    -- ============================================================
    -- USERS & AUTH
    -- ============================================================
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','PMO','PROJECT_MANAGER','TASK_OWNER','EXECUTIVE','VIEWER')),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- PROJECTS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      project_manager TEXT,
      status_date TEXT,
      original_baseline_start TEXT,
      original_baseline_finish TEXT,
      current_baseline_start TEXT,
      current_baseline_finish TEXT,
      actual_start TEXT,
      actual_finish TEXT,
      forecast_start TEXT,
      forecast_finish TEXT,
      management_forecast_finish TEXT,
      overall_status TEXT DEFAULT 'NOT STARTED',
      schedule_health TEXT DEFAULT 'Healthy',
      tolerance_days INTEGER DEFAULT 5,
      working_saturday INTEGER DEFAULT 0,
      working_sunday INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- MILESTONES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      milestone_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      original_baseline_start TEXT,
      original_baseline_finish TEXT,
      current_baseline_start TEXT,
      current_baseline_finish TEXT,
      actual_start TEXT,
      actual_finish TEXT,
      owner_forecast_start TEXT,
      owner_forecast_finish TEXT,
      calculated_forecast_finish TEXT,
      forecast_source TEXT DEFAULT 'Network Calculated',
      status TEXT DEFAULT 'NOT STARTED',
      percent_complete REAL DEFAULT 0,
      stage TEXT,
      management_message TEXT,
      impact_to_project_finish INTEGER,
      owner TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, milestone_id)
    );

    -- ============================================================
    -- TASKS / ACTIVITIES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      milestone_id TEXT,
      task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      task_type TEXT DEFAULT 'Activity' CHECK(task_type IN ('Milestone','Activity')),
      sort_order INTEGER DEFAULT 0,
      owner TEXT,
      original_baseline_start TEXT,
      original_baseline_finish TEXT,
      current_baseline_start TEXT,
      current_baseline_finish TEXT,
      actual_start TEXT,
      actual_finish TEXT,
      owner_forecast_start TEXT,
      owner_forecast_finish TEXT,
      status_date TEXT,
      percent_complete REAL DEFAULT 0,
      duration_wd INTEGER,
      remaining_duration_wd INTEGER,
      lag INTEGER DEFAULT 0,
      lead INTEGER DEFAULT 0,
      total_float INTEGER,
      free_float INTEGER,
      is_critical_path INTEGER DEFAULT 0,
      critical_path_manual_override INTEGER DEFAULT 0,
      schedule_impact INTEGER,
      task_status TEXT DEFAULT 'NOT STARTED',
      variance_cause TEXT,
      recovery_action TEXT,
      recovery_date TEXT,
      rebaseline_required INTEGER DEFAULT 0,
      rebaseline_reason TEXT,
      comments TEXT,
      last_updated_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
      UNIQUE(project_id, task_id)
    );

    -- ============================================================
    -- DEPENDENCIES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS dependencies (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      predecessor_task_id TEXT NOT NULL,
      successor_task_id TEXT NOT NULL,
      dependency_type TEXT DEFAULT 'FS' CHECK(dependency_type IN ('FS','SS','FF','SF')),
      lag_days INTEGER DEFAULT 0,
      lead_days INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (predecessor_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (successor_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      UNIQUE(predecessor_task_id, successor_task_id)
    );

    -- ============================================================
    -- CALENDAR CONFIG
    -- ============================================================
    CREATE TABLE IF NOT EXISTS calendar_config (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      working_monday INTEGER DEFAULT 1,
      working_tuesday INTEGER DEFAULT 1,
      working_wednesday INTEGER DEFAULT 1,
      working_thursday INTEGER DEFAULT 1,
      working_friday INTEGER DEFAULT 1,
      working_saturday INTEGER DEFAULT 0,
      working_sunday INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- ============================================================
    -- HOLIDAYS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      date TEXT NOT NULL,
      name TEXT,
      type TEXT DEFAULT 'public' CHECK(type IN ('public','company','project')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, date)
    );

    -- ============================================================
    -- FORECAST HISTORY
    -- ============================================================
    CREATE TABLE IF NOT EXISTS forecast_history (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      forecast_start TEXT,
      forecast_finish TEXT,
      percent_complete REAL,
      status TEXT,
      variance_wd INTEGER,
      updated_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- ============================================================
    -- WEEKLY SNAPSHOTS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS weekly_snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      status_date TEXT NOT NULL,
      week_number INTEGER,
      current_baseline_finish TEXT,
      project_forecast_finish TEXT,
      forecast_variance_current_wd INTEGER,
      forecast_variance_original_wd INTEGER,
      overall_status TEXT,
      historical_max_variance_wd INTEGER,
      recovery_achieved_wd INTEGER,
      rebaseline_decision TEXT,
      top_schedule_driver TEXT,
      critical_path_risk TEXT,
      executive_decision_required TEXT,
      milestones_on_track INTEGER DEFAULT 0,
      milestones_at_risk INTEGER DEFAULT 0,
      milestones_delayed INTEGER DEFAULT 0,
      milestones_completed INTEGER DEFAULT 0,
      cumulative_milestone_slippage INTEGER DEFAULT 0,
      schedule_health TEXT,
      executive_narrative TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- ============================================================
    -- RECOVERY ACTIONS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS recovery_actions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      task_id TEXT,
      milestone_id TEXT,
      variance_cause TEXT,
      action_description TEXT NOT NULL,
      recovery_owner TEXT,
      recovery_date TEXT,
      expected_days_recovered INTEGER,
      actual_days_recovered INTEGER,
      forecast_before TEXT,
      forecast_after TEXT,
      status TEXT DEFAULT 'Not Started' CHECK(status IN ('Not Started','In Progress','Recovered','Failed','Closed')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL
    );

    -- ============================================================
    -- RAID ITEMS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS raid_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      raid_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Risk','Assumption','Issue','Dependency','Change Request')),
      date_raised TEXT,
      description TEXT NOT NULL,
      affected_task_id TEXT,
      affected_milestone_id TEXT,
      probability TEXT CHECK(probability IN ('Low','Medium','High')),
      impact TEXT CHECK(impact IN ('Low','Medium','High','Critical')),
      owner TEXT,
      due_date TEXT,
      mitigation TEXT,
      status TEXT DEFAULT 'Open' CHECK(status IN ('Open','Monitoring','Mitigated','Closed','Rejected')),
      linked_schedule_id TEXT,
      rebaseline_trigger INTEGER DEFAULT 0,
      rebaseline_requested_date TEXT,
      approval_decision TEXT,
      outcome_closure TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (affected_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (affected_milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
      UNIQUE(project_id, raid_id)
    );

    -- ============================================================
    -- CHANGE REQUESTS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS change_requests (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      change_id TEXT NOT NULL,
      request_date TEXT,
      requested_by TEXT,
      change_type TEXT,
      description TEXT NOT NULL,
      reason TEXT,
      affected_scope TEXT,
      affected_tasks TEXT,
      affected_milestones TEXT,
      schedule_impact_wd INTEGER,
      cost_impact TEXT,
      resource_impact TEXT,
      risk_impact TEXT,
      original_baseline_finish TEXT,
      current_baseline_finish TEXT,
      proposed_new_baseline TEXT,
      recommendation TEXT,
      approval_status TEXT DEFAULT 'Draft' CHECK(approval_status IN ('Draft','Impact Assessment','Pending Approval','Approved','Rejected','Implemented','Closed')),
      approver TEXT,
      approval_date TEXT,
      effective_date TEXT,
      decision_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, change_id)
    );

    -- ============================================================
    -- BASELINE VERSIONS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS baseline_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      version_date TEXT NOT NULL,
      reason TEXT,
      change_request_id TEXT,
      baseline_data TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (change_request_id) REFERENCES change_requests(id) ON DELETE SET NULL
    );

    -- ============================================================
    -- AUDIT EVENTS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      field_changed TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      source TEXT CHECK(source IN ('Owner Update','PMO Update','Change Control','System Calculation','Import','Admin')),
      user_id TEXT,
      user_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- ALERT LOG
    -- ============================================================
    CREATE TABLE IF NOT EXISTS alert_log (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT DEFAULT 'Warning' CHECK(severity IN ('Info','Warning','Critical')),
      title TEXT NOT NULL,
      description TEXT,
      entity_type TEXT,
      entity_id TEXT,
      acknowledged INTEGER DEFAULT 0,
      acknowledged_by TEXT,
      acknowledged_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- ============================================================
    -- INDEXES
    -- ============================================================
    CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone_id);
    CREATE INDEX IF NOT EXISTS idx_dependencies_project ON dependencies(project_id);
    CREATE INDEX IF NOT EXISTS idx_dependencies_predecessor ON dependencies(predecessor_task_id);
    CREATE INDEX IF NOT EXISTS idx_dependencies_successor ON dependencies(successor_task_id);
    CREATE INDEX IF NOT EXISTS idx_forecast_history_task ON forecast_history(task_id);
    CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_project ON weekly_snapshots(project_id);
    CREATE INDEX IF NOT EXISTS idx_raid_items_project ON raid_items(project_id);
    CREATE INDEX IF NOT EXISTS idx_change_requests_project ON change_requests(project_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_project ON audit_events(project_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_alert_log_project ON alert_log(project_id);
  `);

  console.log('✅ Database migration completed successfully.');
}
