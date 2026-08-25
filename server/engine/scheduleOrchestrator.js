/**
 * Schedule Orchestrator
 * 
 * Orchestrates all engine calculations and produces the complete
 * dashboard dataset. This is the central coordination point that
 * calls Calendar, Dependency, CPM, Status, Narrative, and Health engines.
 */

import { getDb, queryAll, queryOne, execute, saveDb } from '../db/database.js';
import { buildCalendarConfig, buildHolidaySet, workingDaysBetween, calculateDurationWD, calculateRemainingDurationWD, parseDate, toISODate, formatDate } from './calendarEngine.js';
import { buildAdjacencyLists, topologicalSort, detectCircularDependencies } from './dependencyEngine.js';
import { calculateCriticalPath, calculateNetworkProjectFinish, getCriticalPathTasks } from './criticalPathEngine.js';
import { calculateTaskStatus, calculateMilestoneStatus, calculateProjectStatus, calculateCumulativeMilestoneSlippage, getMaxMilestoneVariance, calculateScheduleImpact, STATUS } from './statusEngine.js';
import { generateExecutiveNarrative, generateMilestoneMessage } from './narrativeEngine.js';
import { calculateHealthScore, getTopScheduleDrivers } from './healthScoreEngine.js';
import { v4 as uuid } from 'uuid';

/**
 * Recalculate all schedule data for a project.
 * This is the master recalculation function.
 */
export async function recalculateProject(projectId) {
  const db = await getDb();

  // Load project
  const project = queryOne('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) throw new Error(`Project ${projectId} not found`);

  // Load calendar
  const calConfig = queryOne('SELECT * FROM calendar_config WHERE project_id = ?', [projectId]);
  const calendar = buildCalendarConfig(calConfig);
  const holidays = queryAll('SELECT * FROM holidays WHERE project_id = ?', [projectId]);
  const holidaySet = buildHolidaySet(holidays);

  // Load tasks and dependencies
  const tasks = queryAll('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order', [projectId]);
  const dependencies = queryAll('SELECT * FROM dependencies WHERE project_id = ?', [projectId]);
  const milestones = queryAll('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order', [projectId]);
  const raidItems = queryAll('SELECT * FROM raid_items WHERE project_id = ?', [projectId]);
  const recoveryActions = queryAll('SELECT * FROM recovery_actions WHERE project_id = ?', [projectId]);
  const changeRequests = queryAll('SELECT * FROM change_requests WHERE project_id = ?', [projectId]);

  const toleranceDays = project.tolerance_days || 5;

  // ============================================================
  // 1. CPM CALCULATION
  // ============================================================
  const cpmResults = calculateCriticalPath(tasks, dependencies, calendar, holidaySet);
  const networkFinish = calculateNetworkProjectFinish(cpmResults);

  // ============================================================
  // 2. UPDATE TASKS WITH CALCULATED VALUES
  // ============================================================
  for (const task of tasks) {
    const cpm = cpmResults.get(task.id);

    // Get previous forecast for recovery detection
    const prevForecast = queryOne(
      'SELECT * FROM forecast_history WHERE task_id = ? ORDER BY created_at DESC LIMIT 1',
      [task.id]
    );

    // Calculate task status
    const statusResult = calculateTaskStatus(task, toleranceDays, calendar, holidaySet, prevForecast);

    // Calculate variances
    const currentBaselineFinish = parseDate(task.current_baseline_finish);
    const originalBaselineFinish = parseDate(task.original_baseline_finish);
    const currentBaselineStart = parseDate(task.current_baseline_start);
    const actualStart = parseDate(task.actual_start);
    const forecastFinish = parseDate(task.owner_forecast_finish);

    let startVariance = null;
    if (currentBaselineStart && actualStart) {
      startVariance = workingDaysBetween(currentBaselineStart, actualStart, calendar, holidaySet);
    }

    // Duration
    const effectiveStart = parseDate(task.actual_start) || parseDate(task.current_baseline_start);
    const effectiveFinish = parseDate(task.actual_finish) || parseDate(task.owner_forecast_finish) || parseDate(task.current_baseline_finish);
    const duration = effectiveStart && effectiveFinish
      ? calculateDurationWD(effectiveStart, effectiveFinish, calendar, holidaySet)
      : null;

    // Remaining duration
    const remaining = task.actual_finish ? 0 : calculateRemainingDurationWD(
      effectiveFinish,
      project.status_date,
      task.percent_complete,
      calendar,
      holidaySet
    );

    // Schedule impact
    const totalFloat = cpm ? cpm.totalFloat : null;
    const freeFloat = cpm ? cpm.freeFloat : null;
    const scheduleImpact = calculateScheduleImpact(statusResult.varianceWD, totalFloat);

    // Update task in DB
    execute(`
      UPDATE tasks SET
        task_status = ?,
        total_float = ?,
        free_float = ?,
        is_critical_path = ?,
        duration_wd = ?,
        remaining_duration_wd = ?,
        schedule_impact = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      statusResult.status,
      totalFloat,
      freeFloat,
      cpm ? (cpm.isCriticalPath ? 1 : 0) : 0,
      duration,
      remaining,
      scheduleImpact,
      task.id,
    ]);

    // Update task object for downstream calculations
    task.task_status = statusResult.status;
    task.total_float = totalFloat;
    task.free_float = freeFloat;
    task.is_critical_path = cpm ? cpm.isCriticalPath : false;
    task.duration_wd = duration;
    task.remaining_duration_wd = remaining;
    task.schedule_impact = scheduleImpact;
    task.forecast_variance_current_wd = statusResult.varianceWD;
    task.forecast_variance_original_wd = statusResult.varianceOriginalWD;
    task.start_variance_wd = startVariance;
  }

  // ============================================================
  // 3. UPDATE MILESTONES
  // ============================================================
  const milestoneStatuses = [];

  for (const ms of milestones) {
    const childTasks = tasks.filter(t => t.milestone_id === ms.id);

    // Calculate milestone forecast from controlling activity
    let calcForecast = null;
    if (childTasks.length > 0) {
      for (const ct of childTasks) {
        const finish = parseDate(ct.actual_finish) || parseDate(ct.owner_forecast_finish);
        if (finish && (!calcForecast || finish > calcForecast)) {
          calcForecast = finish;
        }
      }
    }

    // Milestone status
    const msWithCalcForecast = { ...ms, calculated_forecast_finish: calcForecast ? toISODate(calcForecast) : null };
    const msStatus = calculateMilestoneStatus(msWithCalcForecast, childTasks, toleranceDays, calendar, holidaySet);
    const mgtMessage = generateMilestoneMessage(ms, msStatus);

    // Impact to project finish
    const msImpact = calculateScheduleImpact(msStatus.varianceWD, null); // Simplified

    execute(`
      UPDATE milestones SET
        calculated_forecast_finish = ?,
        status = ?,
        management_message = ?,
        impact_to_project_finish = ?,
        percent_complete = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      calcForecast ? toISODate(calcForecast) : null,
      msStatus.status,
      mgtMessage,
      msImpact,
      childTasks.length > 0
        ? Math.round(childTasks.reduce((sum, t) => sum + (t.percent_complete || 0), 0) / childTasks.length)
        : ms.percent_complete,
      ms.id,
    ]);

    milestoneStatuses.push({
      ...msStatus,
      milestoneId: ms.milestone_id,
      name: ms.name,
      id: ms.id,
    });
  }

  // ============================================================
  // 4. UPDATE PROJECT
  // ============================================================
  const projectStatus = calculateProjectStatus(
    project, milestoneStatuses, networkFinish, toleranceDays, calendar, holidaySet
  );
  const cumulativeSlippage = calculateCumulativeMilestoneSlippage(milestoneStatuses);
  const maxVariance = getMaxMilestoneVariance(milestoneStatuses);

  // Health score
  const enrichedTasks = tasks.map(t => ({
    ...t,
    task_status: t.task_status,
    is_critical_path: t.is_critical_path,
    total_float: t.total_float,
    forecast_variance_current_wd: t.forecast_variance_current_wd,
  }));
  const healthScore = calculateHealthScore({
    tasks: enrichedTasks,
    milestoneStatuses,
    cpmResults,
    raidItems,
    recoveryActions,
    changeRequests,
    varianceWD: projectStatus.varianceWD || 0,
    cumulativeSlippage,
    toleranceDays,
  });

  // Executive narrative
  const narrative = generateExecutiveNarrative({
    projectName: project.name,
    overallStatus: projectStatus.status,
    forecastFinish: networkFinish,
    currentBaselineFinish: parseDate(project.current_baseline_finish),
    originalBaselineFinish: parseDate(project.original_baseline_finish),
    varianceWD: projectStatus.varianceWD || 0,
    varianceOriginalWD: projectStatus.varianceOriginalWD || 0,
    milestoneStatuses,
    cumulativeSlippage,
    maxVariance,
    criticalPathTasks: getCriticalPathTasks(cpmResults),
    recoveryActions,
    raidItems,
  });

  execute(`
    UPDATE projects SET
      forecast_finish = ?,
      overall_status = ?,
      schedule_health = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `, [
    networkFinish ? toISODate(networkFinish) : null,
    projectStatus.status,
    healthScore.level,
    projectId,
  ]);

  saveDb();

  return {
    project: { ...project, forecast_finish: networkFinish ? toISODate(networkFinish) : null, overall_status: projectStatus.status },
    projectStatus,
    milestoneStatuses,
    cumulativeSlippage,
    maxVariance,
    healthScore,
    narrative,
    networkFinish: networkFinish ? toISODate(networkFinish) : null,
    cpmResults: Object.fromEntries(cpmResults),
  };
}

/**
 * Get complete dashboard data for a project.
 */
export async function getDashboardData(projectId) {
  const db = await getDb();

  const project = queryOne('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) throw new Error(`Project ${projectId} not found`);

  // Recalculate everything
  const calcResult = await recalculateProject(projectId);

  // Load fresh data after recalc
  const tasks = queryAll('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order', [projectId]);
  const milestones = queryAll('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order', [projectId]);
  const raidItems = queryAll('SELECT * FROM raid_items WHERE project_id = ?', [projectId]);
  const recoveryActions = queryAll('SELECT * FROM recovery_actions WHERE project_id = ?', [projectId]);
  const changeRequests = queryAll('SELECT * FROM change_requests WHERE project_id = ?', [projectId]);
  const snapshots = queryAll('SELECT * FROM weekly_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 10', [projectId]);
  const alerts = queryAll('SELECT * FROM alert_log WHERE project_id = ? AND acknowledged = 0 ORDER BY created_at DESC LIMIT 20', [projectId]);

  const calConfig = queryOne('SELECT * FROM calendar_config WHERE project_id = ?', [projectId]);
  const calendar = buildCalendarConfig(calConfig);
  const holidays = queryAll('SELECT * FROM holidays WHERE project_id = ?', [projectId]);
  const holidaySet = buildHolidaySet(holidays);

  // Top schedule drivers
  const topDrivers = getTopScheduleDrivers(tasks, calcResult.milestoneStatuses, calcResult.cpmResults);

  // KPI calculations
  const openTasks = tasks.filter(t => !t.actual_finish);
  const completedTasks = tasks.filter(t => t.actual_finish);
  const criticalTasks = tasks.filter(t => t.is_critical_path);
  const criticalAtRisk = criticalTasks.filter(t => 
    t.task_status === 'DELAYED' || t.task_status === 'AT RISK'
  );
  const tasksNeedingForecast = openTasks.filter(t => !t.owner_forecast_finish);
  const completedLate = completedTasks.filter(t => t.task_status === 'COMPLETED - LATE');
  const recoveredTasks = tasks.filter(t => t.task_status === 'RECOVERED');
  const rebaselineRequired = tasks.filter(t => t.rebaseline_required);

  // Milestone KPIs
  const delayedMilestones = calcResult.milestoneStatuses.filter(m => m.status === 'DELAYED' || m.status === 'AT RISK');
  const completedMilestones = calcResult.milestoneStatuses.filter(m => m.status?.startsWith('COMPLETED'));
  const milestonesNeedForecast = calcResult.milestoneStatuses.filter(m => m.status === 'FORECAST REQUIRED');

  return {
    project: {
      ...project,
      forecast_finish: calcResult.networkFinish,
      overall_status: calcResult.projectStatus.status,
    },
    kpis: {
      overallStatus: calcResult.projectStatus.status,
      originalBaselineFinish: project.original_baseline_finish,
      currentBaselineFinish: project.current_baseline_finish,
      forecastFinish: calcResult.networkFinish,
      varianceCurrentWD: calcResult.projectStatus.varianceWD,
      varianceOriginalWD: calcResult.projectStatus.varianceOriginalWD,
      milestonesForcastLate: delayedMilestones.length,
      totalMilestones: milestones.length,
      cumulativeMilestoneSlippage: calcResult.cumulativeSlippage,
      maxMilestoneVariance: calcResult.maxVariance,
      criticalTasksAtRisk: criticalAtRisk.length,
      tasksRequiringForecast: tasksNeedingForecast.length,
      recoveryAchieved: recoveredTasks.length,
      rebaselineRequired: rebaselineRequired.length,
      completedLate: completedLate.length,
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
    },
    milestones: milestones.map(ms => {
      const msStatus = calcResult.milestoneStatuses.find(s => s.id === ms.id);
      return {
        ...ms,
        forecast_variance_wd: msStatus?.varianceWD ?? null,
        forecast_variance_original_wd: msStatus?.varianceOriginalWD ?? null,
        status: msStatus?.status ?? ms.status,
      };
    }),
    tasks,
    scheduleHealth: calcResult.healthScore,
    narrative: calcResult.narrative,
    topDrivers,
    snapshots,
    raidItems,
    recoveryActions,
    changeRequests,
    alerts,
  };
}
