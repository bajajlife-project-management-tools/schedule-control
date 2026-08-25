/**
 * Status Engine
 * 
 * Derives task, milestone, and project status from schedule data.
 * Implements strict governance rules:
 * - Completed tasks use actual finish for status
 * - Open tasks use forecast for status  
 * - Missing forecast = FORECAST REQUIRED
 * - RECOVERED = was delayed, now back within tolerance
 */

import { parseDate, workingDaysBetween } from './calendarEngine.js';
import { isAfter, isBefore, isEqual } from 'date-fns';

// Status constants
export const STATUS = {
  COMPLETED_ON_TIME: 'COMPLETED - ON TIME',
  COMPLETED_LATE: 'COMPLETED - LATE',
  ON_TRACK: 'ON TRACK',
  AT_RISK: 'AT RISK',
  DELAYED: 'DELAYED',
  RECOVERED: 'RECOVERED',
  FORECAST_REQUIRED: 'FORECAST REQUIRED',
  NOT_STARTED: 'NOT STARTED',
  AT_RISK_FINAL_PROTECTED: 'AT RISK - FINAL DATE PROTECTED',
};

/**
 * Determine task status based on governance rules.
 * 
 * @param {Object} task - Task record
 * @param {number} toleranceDays - Configured tolerance in working days
 * @param {Object} calendar - Calendar config
 * @param {Set} holidaySet - Holiday set
 * @param {Object} previousForecast - Previous forecast data for recovery detection
 * @returns {{ status: string, varianceWD: number|null, varianceOriginalWD: number|null }}
 */
export function calculateTaskStatus(task, toleranceDays = 5, calendar, holidaySet, previousForecast = null) {
  const actualFinish = parseDate(task.actual_finish);
  const currentBaselineFinish = parseDate(task.current_baseline_finish);
  const originalBaselineFinish = parseDate(task.original_baseline_finish);
  const forecastFinish = parseDate(task.owner_forecast_finish);
  const currentBaselineStart = parseDate(task.current_baseline_start);
  const actualStart = parseDate(task.actual_start);

  let varianceWD = null;  // vs current baseline
  let varianceOriginalWD = null;  // vs original baseline

  // RULE: If actual finish exists, task is complete
  if (actualFinish) {
    if (currentBaselineFinish) {
      varianceWD = workingDaysBetween(currentBaselineFinish, actualFinish, calendar, holidaySet);
    }
    if (originalBaselineFinish) {
      varianceOriginalWD = workingDaysBetween(originalBaselineFinish, actualFinish, calendar, holidaySet);
    }

    if (currentBaselineFinish && (isBefore(actualFinish, currentBaselineFinish) || isEqual(actualFinish, currentBaselineFinish))) {
      return { status: STATUS.COMPLETED_ON_TIME, varianceWD, varianceOriginalWD };
    }
    return { status: STATUS.COMPLETED_LATE, varianceWD, varianceOriginalWD };
  }

  // RULE: No forecast = FORECAST REQUIRED
  if (!forecastFinish) {
    return { status: STATUS.FORECAST_REQUIRED, varianceWD: null, varianceOriginalWD: null };
  }

  // Calculate variance
  if (currentBaselineFinish) {
    varianceWD = workingDaysBetween(currentBaselineFinish, forecastFinish, calendar, holidaySet);
  }
  if (originalBaselineFinish) {
    varianceOriginalWD = workingDaysBetween(originalBaselineFinish, forecastFinish, calendar, holidaySet);
  }

  // RULE: Check for RECOVERED status
  if (previousForecast) {
    const prevForecastFinish = parseDate(previousForecast.forecast_finish);
    if (prevForecastFinish && currentBaselineFinish) {
      const prevVariance = workingDaysBetween(currentBaselineFinish, prevForecastFinish, calendar, holidaySet);
      // Was previously beyond baseline, now within tolerance
      if (prevVariance > toleranceDays && varianceWD !== null && varianceWD <= toleranceDays) {
        return { status: STATUS.RECOVERED, varianceWD, varianceOriginalWD };
      }
    }
  }

  // RULE: Forecast within baseline = ON TRACK
  if (varianceWD !== null && varianceWD <= 0) {
    return { status: STATUS.ON_TRACK, varianceWD, varianceOriginalWD };
  }

  // RULE: Forecast within tolerance = AT RISK
  if (varianceWD !== null && varianceWD <= toleranceDays) {
    return { status: STATUS.AT_RISK, varianceWD, varianceOriginalWD };
  }

  // RULE: Forecast beyond tolerance = DELAYED
  return { status: STATUS.DELAYED, varianceWD, varianceOriginalWD };
}

/**
 * Calculate milestone status from its child tasks and own dates.
 * 
 * @param {Object} milestone - Milestone record
 * @param {Array} childTasks - Tasks belonging to this milestone
 * @param {number} toleranceDays - Configured tolerance
 * @param {Object} calendar - Calendar config
 * @param {Set} holidaySet - Holiday set
 * @returns {Object} Status object
 */
export function calculateMilestoneStatus(milestone, childTasks, toleranceDays, calendar, holidaySet) {
  const actualFinish = parseDate(milestone.actual_finish);
  const currentBaselineFinish = parseDate(milestone.current_baseline_finish);
  const originalBaselineFinish = parseDate(milestone.original_baseline_finish);
  const ownerForecast = parseDate(milestone.owner_forecast_finish);
  const calculatedForecast = parseDate(milestone.calculated_forecast_finish);
  const forecastFinish = ownerForecast || calculatedForecast;

  let varianceWD = null;
  let varianceOriginalWD = null;

  // Completed milestone
  if (actualFinish) {
    if (currentBaselineFinish) {
      varianceWD = workingDaysBetween(currentBaselineFinish, actualFinish, calendar, holidaySet);
    }
    if (originalBaselineFinish) {
      varianceOriginalWD = workingDaysBetween(originalBaselineFinish, actualFinish, calendar, holidaySet);
    }

    if (currentBaselineFinish && (isBefore(actualFinish, currentBaselineFinish) || isEqual(actualFinish, currentBaselineFinish))) {
      return { status: STATUS.COMPLETED_ON_TIME, varianceWD, varianceOriginalWD };
    }
    return { status: STATUS.COMPLETED_LATE, varianceWD, varianceOriginalWD };
  }

  // No forecast
  if (!forecastFinish) {
    return { status: STATUS.FORECAST_REQUIRED, varianceWD: null, varianceOriginalWD: null };
  }

  // Calculate variance
  if (currentBaselineFinish) {
    varianceWD = workingDaysBetween(currentBaselineFinish, forecastFinish, calendar, holidaySet);
  }
  if (originalBaselineFinish) {
    varianceOriginalWD = workingDaysBetween(originalBaselineFinish, forecastFinish, calendar, holidaySet);
  }

  if (varianceWD !== null && varianceWD <= 0) {
    return { status: STATUS.ON_TRACK, varianceWD, varianceOriginalWD };
  }
  if (varianceWD !== null && varianceWD <= toleranceDays) {
    return { status: STATUS.AT_RISK, varianceWD, varianceOriginalWD };
  }
  return { status: STATUS.DELAYED, varianceWD, varianceOriginalWD };
}

/**
 * Calculate overall project status.
 * 
 * @param {Object} project - Project record
 * @param {Array} milestoneStatuses - Array of milestone status results
 * @param {Date} networkProjectFinish - Calculated project finish from CPM
 * @param {number} toleranceDays - Configured tolerance
 * @param {Object} calendar - Calendar config
 * @param {Set} holidaySet - Holiday set
 * @returns {Object} Project status
 */
export function calculateProjectStatus(project, milestoneStatuses, networkProjectFinish, toleranceDays, calendar, holidaySet) {
  const actualFinish = parseDate(project.actual_finish);
  const currentBaselineFinish = parseDate(project.current_baseline_finish);
  const originalBaselineFinish = parseDate(project.original_baseline_finish);
  const forecastFinish = networkProjectFinish || parseDate(project.forecast_finish);

  let varianceWD = null;
  let varianceOriginalWD = null;

  // Project completed
  if (actualFinish) {
    if (currentBaselineFinish) {
      varianceWD = workingDaysBetween(currentBaselineFinish, actualFinish, calendar, holidaySet);
    }
    if (originalBaselineFinish) {
      varianceOriginalWD = workingDaysBetween(originalBaselineFinish, actualFinish, calendar, holidaySet);
    }
    const status = varianceWD <= 0 ? STATUS.COMPLETED_ON_TIME : STATUS.COMPLETED_LATE;
    return { status, varianceWD, varianceOriginalWD };
  }

  // No forecast
  if (!forecastFinish) {
    return { status: STATUS.FORECAST_REQUIRED, varianceWD: null, varianceOriginalWD: null };
  }

  // Calculate variance
  if (currentBaselineFinish) {
    varianceWD = workingDaysBetween(currentBaselineFinish, forecastFinish, calendar, holidaySet);
  }
  if (originalBaselineFinish) {
    varianceOriginalWD = workingDaysBetween(originalBaselineFinish, forecastFinish, calendar, holidaySet);
  }

  // Count milestone delays
  const delayedMilestones = milestoneStatuses.filter(m => 
    m.status === STATUS.DELAYED || m.status === STATUS.AT_RISK
  ).length;
  const totalMilestones = milestoneStatuses.length;

  // AT RISK - FINAL DATE PROTECTED
  // Multiple milestones delayed but project finish still within baseline
  if (delayedMilestones > 0 && varianceWD !== null && varianceWD <= 0) {
    return {
      status: STATUS.AT_RISK_FINAL_PROTECTED,
      varianceWD,
      varianceOriginalWD,
      delayedMilestones,
      totalMilestones,
    };
  }

  if (varianceWD !== null && varianceWD <= 0) {
    return { status: STATUS.ON_TRACK, varianceWD, varianceOriginalWD };
  }
  if (varianceWD !== null && varianceWD <= toleranceDays) {
    return { status: STATUS.AT_RISK, varianceWD, varianceOriginalWD };
  }
  return { status: STATUS.DELAYED, varianceWD, varianceOriginalWD };
}

/**
 * Calculate cumulative milestone slippage.
 * This is the SUM of individual milestone delays (for reporting only).
 * NOT to be confused with project delay.
 */
export function calculateCumulativeMilestoneSlippage(milestoneStatuses) {
  let total = 0;
  for (const ms of milestoneStatuses) {
    if (ms.varianceWD && ms.varianceWD > 0) {
      total += ms.varianceWD;
    }
  }
  return total;
}

/**
 * Find maximum milestone variance.
 */
export function getMaxMilestoneVariance(milestoneStatuses) {
  let max = 0;
  for (const ms of milestoneStatuses) {
    if (ms.varianceWD && ms.varianceWD > max) {
      max = ms.varianceWD;
    }
  }
  return max;
}

/**
 * Calculate schedule impact to project finish for a specific task.
 * 
 * Returns:
 *   0 WD - delay absorbed by float
 *   +X WD - delay propagates to project finish
 *   null - insufficient data (TBD)
 */
export function calculateScheduleImpact(taskVarianceWD, totalFloat) {
  if (taskVarianceWD === null || totalFloat === null) return null;
  if (taskVarianceWD <= 0) return 0;
  
  const impact = taskVarianceWD - Math.max(0, totalFloat);
  return Math.max(0, impact);
}
