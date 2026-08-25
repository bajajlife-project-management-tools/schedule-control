/**
 * Excel Export Engine
 * 
 * Exports the complete schedule-control pack to a multi-tab Excel workbook.
 * Tabs: Executive Dashboard, Schedule Tracker, Weekly Snapshot, RAID & Change Control,
 *       Dependencies, Baseline History, Audit Log, Governance Guide
 */

import * as XLSX from 'xlsx';
import { formatDate } from '../engine/calendarEngine.js';

/**
 * Generate the complete export workbook.
 */
export function generateExportWorkbook(dashboardData) {
  const wb = XLSX.utils.book_new();

  // Tab 1: Executive Dashboard
  addExecutiveDashboardSheet(wb, dashboardData);

  // Tab 2: Schedule Tracker
  addScheduleTrackerSheet(wb, dashboardData);

  // Tab 3: Milestone Summary
  addMilestoneSheet(wb, dashboardData);

  // Tab 4: Weekly Snapshots
  addWeeklySnapshotSheet(wb, dashboardData);

  // Tab 5: RAID & Change Control
  addRAIDSheet(wb, dashboardData);

  // Tab 6: Dependencies
  addDependencySheet(wb, dashboardData);

  // Tab 7: Audit Log
  addAuditSheet(wb, dashboardData);

  // Tab 8: Governance Guide
  addGovernanceSheet(wb);

  return wb;
}

function addExecutiveDashboardSheet(wb, data) {
  const { project, kpis, narrative } = data;
  const rows = [
    ['EXECUTIVE SCHEDULE DASHBOARD'],
    [''],
    ['Project', project.name],
    ['Project Manager', project.project_manager || ''],
    ['Status Date', formatDate(project.status_date) || ''],
    [''],
    ['KEY PERFORMANCE INDICATORS'],
    ['Overall Project Status', kpis.overallStatus],
    ['Original Baseline Finish', formatDate(kpis.originalBaselineFinish)],
    ['Current Baseline Finish', formatDate(kpis.currentBaselineFinish)],
    ['Project Forecast Finish', formatDate(kpis.forecastFinish)],
    ['Forecast Variance vs Current Baseline', kpis.varianceCurrentWD !== null ? `${kpis.varianceCurrentWD} WD` : 'N/A'],
    ['Variance vs Original Baseline', kpis.varianceOriginalWD !== null ? `${kpis.varianceOriginalWD} WD` : 'N/A'],
    ['Milestones Forecast Late', `${kpis.milestonesForcastLate}/${kpis.totalMilestones}`],
    ['Cumulative Milestone Slippage', `${kpis.cumulativeMilestoneSlippage} WD`],
    ['Maximum Milestone Variance', `${kpis.maxMilestoneVariance} WD`],
    ['Critical Tasks At Risk', kpis.criticalTasksAtRisk],
    ['Tasks Requiring Forecast', kpis.tasksRequiringForecast],
    ['Recovery Achieved', kpis.recoveryAchieved],
    ['Rebaseline Required', kpis.rebaselineRequired],
    [''],
    ['EXECUTIVE NARRATIVE'],
    [narrative || ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Executive Dashboard');
}

function addScheduleTrackerSheet(wb, data) {
  const headers = [
    'Task ID', 'Milestone', 'Task Name', 'Type', 'Owner',
    'Orig Baseline Start', 'Orig Baseline Finish',
    'Curr Baseline Start', 'Curr Baseline Finish',
    'Actual Start', 'Actual Finish',
    'Owner Forecast Finish', '% Complete',
    'Start Variance (WD)', 'Forecast Var vs Curr BL (WD)', 'Forecast Var vs Orig BL (WD)',
    'Duration (WD)', 'Remaining (WD)',
    'Total Float (WD)', 'Free Float (WD)', 'Schedule Impact (WD)',
    'Critical Path', 'Task Status',
    'Variance Cause', 'Recovery Action', 'Recovery Date',
    'Predecessor', 'Rebaseline Required', 'Comments'
  ];

  const rows = data.tasks.map(t => [
    t.task_id, t.milestone_id || '', t.name, t.task_type, t.owner || '',
    formatDate(t.original_baseline_start), formatDate(t.original_baseline_finish),
    formatDate(t.current_baseline_start), formatDate(t.current_baseline_finish),
    formatDate(t.actual_start), formatDate(t.actual_finish),
    formatDate(t.owner_forecast_finish), t.percent_complete || 0,
    t.start_variance_wd ?? '', t.forecast_variance_current_wd ?? '', t.forecast_variance_original_wd ?? '',
    t.duration_wd ?? '', t.remaining_duration_wd ?? '',
    t.total_float ?? '', t.free_float ?? '', t.schedule_impact ?? '',
    t.is_critical_path ? 'YES' : '', t.task_status || '',
    t.variance_cause || '', t.recovery_action || '', formatDate(t.recovery_date),
    '', t.rebaseline_required ? 'YES' : '', t.comments || ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Schedule Tracker');
}

function addMilestoneSheet(wb, data) {
  const headers = [
    'Milestone ID', 'Milestone Name',
    'Planned Start', 'Actual Start',
    'Current Baseline Finish', 'Actual Finish',
    'Owner Forecast', 'Forecast Variance (WD)',
    'Stage', 'Status', 'Management Message',
    'Impact to Project Finish'
  ];

  const rows = data.milestones.map(m => [
    m.milestone_id, m.name,
    formatDate(m.original_baseline_start), formatDate(m.actual_start),
    formatDate(m.current_baseline_finish), formatDate(m.actual_finish),
    formatDate(m.owner_forecast_finish || m.calculated_forecast_finish),
    m.forecast_variance_wd ?? '',
    m.stage || '', m.status || '', m.management_message || '',
    m.impact_to_project_finish ?? ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Milestones');
}

function addWeeklySnapshotSheet(wb, data) {
  const headers = [
    'Status Date', 'Current BL Finish', 'Forecast Finish',
    'Var vs Current BL (WD)', 'Var vs Original BL (WD)',
    'Overall Status', 'Hist Max Variance (WD)', 'Recovery (WD)',
    'Rebaseline Decision', 'Top Schedule Driver',
    'Critical Path Risk', 'Executive Decision Required', 'Notes'
  ];

  const rows = (data.snapshots || []).map(s => [
    formatDate(s.status_date), formatDate(s.current_baseline_finish),
    formatDate(s.project_forecast_finish),
    s.forecast_variance_current_wd ?? '', s.forecast_variance_original_wd ?? '',
    s.overall_status || '', s.historical_max_variance_wd ?? '',
    s.recovery_achieved_wd ?? '', s.rebaseline_decision || '',
    s.top_schedule_driver || '', s.critical_path_risk || '',
    s.executive_decision_required || '', s.notes || ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Weekly Snapshots');
}

function addRAIDSheet(wb, data) {
  const headers = [
    'ID', 'Type', 'Date Raised', 'Description',
    'Affected Task/Milestone', 'Probability', 'Impact',
    'Owner', 'Due Date', 'Mitigation / Recovery',
    'Status', 'Linked Schedule ID',
    'Rebaseline Trigger', 'Rebaseline Requested',
    'Approval / Decision', 'Outcome / Closure'
  ];

  const rows = (data.raidItems || []).map(r => [
    r.raid_id, r.type, formatDate(r.date_raised), r.description,
    '', r.probability, r.impact,
    r.owner, formatDate(r.due_date), r.mitigation,
    r.status, r.linked_schedule_id || '',
    r.rebaseline_trigger ? 'YES' : '', formatDate(r.rebaseline_requested_date),
    r.approval_decision || '', r.outcome_closure || ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'RAID & Change Control');
}

function addDependencySheet(wb, data) {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Predecessor', 'Successor', 'Type', 'Lag (WD)'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Dependencies');
}

function addAuditSheet(wb, data) {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Timestamp', 'User', 'Entity', 'Field', 'Old Value', 'New Value', 'Source', 'Reason'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
}

function addGovernanceSheet(wb) {
  const rules = [
    ['SCHEDULE GOVERNANCE RULES'],
    [''],
    ['1', 'Original Baseline dates are immutable.'],
    ['2', 'Current Baseline initially equals Original Baseline.'],
    ['3', 'Forecast dates can change every week based on owner/project-team updates.'],
    ['4', 'Actual dates are factual and must never be overwritten by forecast dates.'],
    ['5', 'A missed baseline date does NOT automatically trigger rebaseline.'],
    ['6', 'Current Baseline can only change through formal Change Control / Rebaseline approval.'],
    ['7', 'Every rebaseline must retain: Original Baseline, Previous/New Current Baseline, Reason, Impact, Approvals.'],
    ['8', 'The application must preserve historical schedule versions.'],
    ['9', 'Do not interpret blank actual/forecast dates as Green.'],
    ['10', 'If an open task/milestone does not have an owner-confirmed forecast, show: FORECAST REQUIRED.'],
    [''],
    ['STATUS DEFINITIONS'],
    ['COMPLETED - ON TIME', 'Actual Finish <= Current Baseline Finish'],
    ['COMPLETED - LATE', 'Actual Finish > Current Baseline Finish'],
    ['ON TRACK', 'Forecast Finish <= Current Baseline Finish'],
    ['AT RISK', 'Forecast Variance <= Tolerance (default 5 WD)'],
    ['DELAYED', 'Forecast Variance > Tolerance'],
    ['RECOVERED', 'Previously delayed, now back within baseline/tolerance'],
    ['FORECAST REQUIRED', 'Open task/milestone without owner-confirmed forecast'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rules);
  XLSX.utils.book_append_sheet(wb, ws, 'Governance Guide');
}

/**
 * Export workbook to buffer.
 */
export function workbookToBuffer(wb) {
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
