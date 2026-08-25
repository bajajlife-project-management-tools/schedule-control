/**
 * Health Score Engine
 * 
 * Calculates a Schedule Health Score from multiple dimensions.
 * Score: Healthy | Watch | At Risk | Critical
 * All drivers are transparent — no black box.
 */

import { STATUS } from './statusEngine.js';

/**
 * Calculate Schedule Health Score.
 * Returns score, level, and individual dimension scores with explanations.
 */
export function calculateHealthScore(dashboardData) {
  const {
    tasks = [],
    milestoneStatuses = [],
    cpmResults = new Map(),
    raidItems = [],
    recoveryActions = [],
    changeRequests = [],
    varianceWD = 0,
    cumulativeSlippage = 0,
    toleranceDays = 5,
  } = dashboardData;

  const dimensions = [];
  let totalScore = 0;
  let maxScore = 0;

  // 1. Overdue Tasks (weight: 20)
  const overdueTasks = tasks.filter(t => 
    !t.actual_finish && t.task_status === STATUS.DELAYED
  );
  const overdueScore = overdueTasks.length === 0 ? 20
    : overdueTasks.length <= 2 ? 12
    : overdueTasks.length <= 5 ? 6 : 0;
  dimensions.push({
    name: 'Overdue Tasks',
    score: overdueScore,
    maxScore: 20,
    detail: `${overdueTasks.length} task(s) overdue`,
    items: overdueTasks.map(t => t.task_id),
  });
  totalScore += overdueScore;
  maxScore += 20;

  // 2. Forecast Variance (weight: 15)
  const varScore = varianceWD <= 0 ? 15
    : varianceWD <= toleranceDays ? 10
    : varianceWD <= toleranceDays * 2 ? 5 : 0;
  dimensions.push({
    name: 'Project Forecast Variance',
    score: varScore,
    maxScore: 15,
    detail: `${varianceWD > 0 ? '+' : ''}${varianceWD} WD vs baseline`,
  });
  totalScore += varScore;
  maxScore += 15;

  // 3. Critical Path Exposure (weight: 15)
  const criticalTasks = tasks.filter(t => t.is_critical_path);
  const criticalAtRisk = criticalTasks.filter(t => 
    t.task_status === STATUS.DELAYED || t.task_status === STATUS.AT_RISK
  );
  const cpScore = criticalAtRisk.length === 0 ? 15
    : criticalAtRisk.length === 1 ? 8
    : criticalAtRisk.length <= 3 ? 4 : 0;
  dimensions.push({
    name: 'Critical Path Exposure',
    score: cpScore,
    maxScore: 15,
    detail: `${criticalAtRisk.length} critical task(s) at risk`,
    items: criticalAtRisk.map(t => t.task_id),
  });
  totalScore += cpScore;
  maxScore += 15;

  // 4. Float Consumption (weight: 10)
  const tasksWithFloat = tasks.filter(t => t.total_float !== null && t.total_float !== undefined);
  const zeroFloat = tasksWithFloat.filter(t => t.total_float <= 0);
  const floatPct = tasksWithFloat.length > 0 ? zeroFloat.length / tasksWithFloat.length : 0;
  const floatScore = floatPct === 0 ? 10
    : floatPct <= 0.2 ? 7
    : floatPct <= 0.5 ? 4 : 0;
  dimensions.push({
    name: 'Float Consumption',
    score: floatScore,
    maxScore: 10,
    detail: `${Math.round(floatPct * 100)}% of tasks have zero/negative float`,
  });
  totalScore += floatScore;
  maxScore += 10;

  // 5. Missing Forecasts (weight: 10)
  const openTasks = tasks.filter(t => !t.actual_finish);
  const noForecast = openTasks.filter(t => !t.owner_forecast_finish);
  const forecastPct = openTasks.length > 0 ? noForecast.length / openTasks.length : 0;
  const fcstScore = forecastPct === 0 ? 10
    : forecastPct <= 0.1 ? 7
    : forecastPct <= 0.3 ? 3 : 0;
  dimensions.push({
    name: 'Missing Forecasts',
    score: fcstScore,
    maxScore: 10,
    detail: `${noForecast.length} open task(s) without forecast`,
  });
  totalScore += fcstScore;
  maxScore += 10;

  // 6. Unresolved RAID (weight: 10)
  const openRaid = raidItems.filter(r => r.status === 'Open');
  const highRaid = openRaid.filter(r => r.impact === 'High' || r.impact === 'Critical');
  const raidScore = openRaid.length === 0 ? 10
    : highRaid.length === 0 ? 7
    : highRaid.length <= 2 ? 4 : 0;
  dimensions.push({
    name: 'Unresolved RAID Items',
    score: raidScore,
    maxScore: 10,
    detail: `${openRaid.length} open (${highRaid.length} high/critical)`,
  });
  totalScore += raidScore;
  maxScore += 10;

  // 7. Recovery Effectiveness (weight: 10)
  const failedRecoveries = recoveryActions.filter(r => r.status === 'Failed');
  const activeRecoveries = recoveryActions.filter(r => r.status === 'In Progress' || r.status === 'Recovered');
  const recoveryScore = recoveryActions.length === 0 ? 10
    : failedRecoveries.length === 0 ? 8
    : failedRecoveries.length <= 1 ? 5 : 0;
  dimensions.push({
    name: 'Recovery Effectiveness',
    score: recoveryScore,
    maxScore: 10,
    detail: `${activeRecoveries.length} active, ${failedRecoveries.length} failed`,
  });
  totalScore += recoveryScore;
  maxScore += 10;

  // 8. Rebaseline Frequency (weight: 10)
  const rebaselineCount = changeRequests.filter(cr => 
    cr.approval_status === 'Approved' || cr.approval_status === 'Implemented'
  ).length;
  const rebaseScore = rebaselineCount === 0 ? 10
    : rebaselineCount === 1 ? 8
    : rebaselineCount <= 3 ? 5 : 2;
  dimensions.push({
    name: 'Rebaseline Frequency',
    score: rebaseScore,
    maxScore: 10,
    detail: `${rebaselineCount} approved rebaseline(s)`,
  });
  totalScore += rebaseScore;
  maxScore += 10;

  // Calculate overall percentage and level
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  let level;
  if (percentage >= 80) level = 'Healthy';
  else if (percentage >= 60) level = 'Watch';
  else if (percentage >= 40) level = 'At Risk';
  else level = 'Critical';

  return {
    score: totalScore,
    maxScore,
    percentage,
    level,
    dimensions,
  };
}

/**
 * Get top schedule drivers (factors causing most schedule pressure).
 */
export function getTopScheduleDrivers(tasks, milestoneStatuses, cpmResults) {
  const drivers = [];

  // Critical path tasks that are delayed
  const criticalDelayed = tasks.filter(t => 
    t.is_critical_path && (t.task_status === 'DELAYED' || t.task_status === 'AT RISK')
  );
  for (const t of criticalDelayed.slice(0, 3)) {
    drivers.push({
      type: 'Critical Path Delay',
      taskId: t.task_id,
      name: t.name,
      varianceWD: t.forecast_variance_current_wd,
      severity: 'Critical',
    });
  }

  // Highest variance tasks
  const byVariance = tasks
    .filter(t => !t.actual_finish && t.forecast_variance_current_wd > 0)
    .sort((a, b) => (b.forecast_variance_current_wd || 0) - (a.forecast_variance_current_wd || 0));
  
  for (const t of byVariance.slice(0, 3)) {
    if (!drivers.find(d => d.taskId === t.task_id)) {
      drivers.push({
        type: 'High Variance',
        taskId: t.task_id,
        name: t.name,
        varianceWD: t.forecast_variance_current_wd,
        severity: t.forecast_variance_current_wd > 10 ? 'High' : 'Medium',
      });
    }
  }

  // Lowest float tasks
  const byFloat = tasks
    .filter(t => !t.actual_finish && t.total_float !== null && t.total_float <= 2)
    .sort((a, b) => (a.total_float ?? 999) - (b.total_float ?? 999));
  
  for (const t of byFloat.slice(0, 3)) {
    if (!drivers.find(d => d.taskId === t.task_id)) {
      drivers.push({
        type: 'Low Float',
        taskId: t.task_id,
        name: t.name,
        totalFloat: t.total_float,
        severity: t.total_float <= 0 ? 'Critical' : 'Medium',
      });
    }
  }

  return drivers.slice(0, 10);
}
