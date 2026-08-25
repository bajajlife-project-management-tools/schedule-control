/**
 * Critical Path Engine
 * 
 * Implements the Critical Path Method (CPM):
 * - Forward pass: calculate Early Start (ES) and Early Finish (EF)
 * - Backward pass: calculate Late Start (LS) and Late Finish (LF)
 * - Total Float: TF = LS - ES = LF - EF
 * - Free Float: FF = min(ES_successor) - EF_current - lag
 * - Critical Path: TF <= 0
 * 
 * Uses the project calendar for all working-day calculations.
 */

import { parseDate, addWorkingDays, workingDaysBetween, calculateDurationWD, isWorkingDay } from './calendarEngine.js';
import { buildAdjacencyLists, topologicalSort, calculateConstraint } from './dependencyEngine.js';
import { isAfter, isBefore, isEqual, addDays } from 'date-fns';

/**
 * Run the full CPM analysis on a set of tasks with dependencies.
 * 
 * @param {Array} tasks - Task objects with dates
 * @param {Array} dependencies - Dependency records
 * @param {Object} calendar - Calendar config
 * @param {Set} holidaySet - Holiday set
 * @returns {Map<string, Object>} Map of taskId -> CPM results
 */
export function calculateCriticalPath(tasks, dependencies, calendar, holidaySet) {
  if (!tasks || tasks.length === 0) return new Map();

  const taskMap = new Map();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  const { successors, predecessors } = buildAdjacencyLists(dependencies);
  const taskIds = tasks.map(t => t.id);
  const { sorted, incomplete } = topologicalSort(taskIds, successors, predecessors);

  // If there are cycles, we can't compute CPM for those tasks
  const cpmResults = new Map();

  // Initialize CPM data for each task
  for (const t of tasks) {
    const effectiveStart = getEffectiveStart(t);
    const effectiveFinish = getEffectiveFinish(t);
    const duration = effectiveStart && effectiveFinish
      ? calculateDurationWD(effectiveStart, effectiveFinish, calendar, holidaySet) || 1
      : 1;

    cpmResults.set(t.id, {
      taskId: t.id,
      earlyStart: null,
      earlyFinish: null,
      lateStart: null,
      lateFinish: null,
      totalFloat: null,
      freeFloat: null,
      isCriticalPath: false,
      duration,
      effectiveStart,
      effectiveFinish,
      hasInsufficientData: !effectiveStart || !effectiveFinish,
    });
  }

  // ============================================================
  // FORWARD PASS: Calculate ES and EF
  // ============================================================
  for (const taskId of sorted) {
    const cpm = cpmResults.get(taskId);
    const task = taskMap.get(taskId);
    const preds = predecessors.get(taskId) || [];

    if (preds.length === 0) {
      // No predecessors: ES = task's effective start
      cpm.earlyStart = cpm.effectiveStart;
    } else {
      // ES = max constrained date from all predecessors
      let maxDate = null;

      for (const { taskId: predId, type, lag } of preds) {
        const predCpm = cpmResults.get(predId);
        if (!predCpm) continue;

        const { constrainedStart, constrainedFinish } = calculateConstraint(
          type,
          predCpm.earlyStart,
          predCpm.earlyFinish,
          lag,
          calendar,
          holidaySet
        );

        const constrained = constrainedStart || constrainedFinish;
        if (constrained && (!maxDate || isAfter(constrained, maxDate))) {
          maxDate = constrained;
        }
      }

      // ES = max(constrained predecessor dates, task's own start)
      if (maxDate) {
        cpm.earlyStart = cpm.effectiveStart && isAfter(cpm.effectiveStart, maxDate)
          ? cpm.effectiveStart
          : maxDate;
      } else {
        cpm.earlyStart = cpm.effectiveStart;
      }
    }

    // EF = ES + duration - 1 (in working days)
    if (cpm.earlyStart) {
      cpm.earlyFinish = addWorkingDays(cpm.earlyStart, cpm.duration - 1, calendar, holidaySet);
    }
  }

  // ============================================================
  // BACKWARD PASS: Calculate LS and LF
  // ============================================================
  // Find project finish (max EF)
  let projectFinish = null;
  for (const cpm of cpmResults.values()) {
    if (cpm.earlyFinish && (!projectFinish || isAfter(cpm.earlyFinish, projectFinish))) {
      projectFinish = cpm.earlyFinish;
    }
  }

  // Process in reverse topological order
  const reverseSorted = [...sorted].reverse();

  for (const taskId of reverseSorted) {
    const cpm = cpmResults.get(taskId);
    const succs = successors.get(taskId) || [];

    if (succs.length === 0) {
      // No successors: LF = project finish
      cpm.lateFinish = projectFinish;
    } else {
      // LF = min constrained date from all successors
      let minDate = null;

      for (const { taskId: succId, type, lag } of succs) {
        const succCpm = cpmResults.get(succId);
        if (!succCpm || !succCpm.lateStart) continue;

        // Reverse constraint: what's the latest this task can end?
        let constrainedDate = null;
        switch (type) {
          case 'FS':
            // Pred must finish before succ starts - lag
            constrainedDate = lag !== 0
              ? addWorkingDays(succCpm.lateStart, -lag, calendar, holidaySet)
              : addWorkingDays(succCpm.lateStart, -1, calendar, holidaySet);
            break;
          case 'SS':
            // Pred start constrains succ start
            constrainedDate = succCpm.lateStart 
              ? addWorkingDays(succCpm.lateStart, -(lag || 0) + cpm.duration - 1, calendar, holidaySet)
              : null;
            break;
          case 'FF':
            constrainedDate = lag !== 0
              ? addWorkingDays(succCpm.lateFinish, -lag, calendar, holidaySet)
              : succCpm.lateFinish;
            break;
          case 'SF':
            constrainedDate = succCpm.lateFinish;
            break;
        }

        if (constrainedDate && (!minDate || isBefore(constrainedDate, minDate))) {
          minDate = constrainedDate;
        }
      }

      cpm.lateFinish = minDate || projectFinish;
    }

    // LS = LF - duration + 1 (in working days)
    if (cpm.lateFinish) {
      cpm.lateStart = addWorkingDays(cpm.lateFinish, -(cpm.duration - 1), calendar, holidaySet);
    }
  }

  // ============================================================
  // FLOAT CALCULATION
  // ============================================================
  for (const taskId of sorted) {
    const cpm = cpmResults.get(taskId);
    
    // Total Float = LS - ES (in working days)
    if (cpm.lateStart && cpm.earlyStart) {
      cpm.totalFloat = workingDaysBetween(cpm.earlyStart, cpm.lateStart, calendar, holidaySet);
    }

    // Free Float = min(ES_successor) - EF - lag_to_succ
    const succs = successors.get(taskId) || [];
    if (succs.length > 0 && cpm.earlyFinish) {
      let minSuccES = null;
      let minLag = 0;

      for (const { taskId: succId, lag } of succs) {
        const succCpm = cpmResults.get(succId);
        if (succCpm && succCpm.earlyStart) {
          if (!minSuccES || isBefore(succCpm.earlyStart, minSuccES)) {
            minSuccES = succCpm.earlyStart;
            minLag = lag || 0;
          }
        }
      }

      if (minSuccES) {
        const gap = workingDaysBetween(cpm.earlyFinish, minSuccES, calendar, holidaySet);
        cpm.freeFloat = gap !== null ? gap - 1 - minLag : null; // -1 because FS means next day
      }
    } else {
      cpm.freeFloat = cpm.totalFloat; // Terminal tasks: FF = TF
    }

    // Critical Path: TF <= 0
    cpm.isCriticalPath = cpm.totalFloat !== null && cpm.totalFloat <= 0;
  }

  return cpmResults;
}

/**
 * Get the effective start date for CPM calculation.
 * Priority: actual_start > owner_forecast_start > current_baseline_start > original_baseline_start
 */
function getEffectiveStart(task) {
  return parseDate(task.actual_start)
    || parseDate(task.owner_forecast_start)
    || parseDate(task.current_baseline_start)
    || parseDate(task.original_baseline_start);
}

/**
 * Get the effective finish date for CPM calculation.
 * Priority: actual_finish > owner_forecast_finish > current_baseline_finish > original_baseline_finish
 */
function getEffectiveFinish(task) {
  return parseDate(task.actual_finish)
    || parseDate(task.owner_forecast_finish)
    || parseDate(task.current_baseline_finish)
    || parseDate(task.original_baseline_finish);
}

/**
 * Extract critical path tasks (ordered).
 */
export function getCriticalPathTasks(cpmResults) {
  const criticalTasks = [];
  for (const [taskId, cpm] of cpmResults) {
    if (cpm.isCriticalPath) {
      criticalTasks.push({ taskId, ...cpm });
    }
  }
  return criticalTasks;
}

/**
 * Calculate project finish from the dependency network.
 * This is the max Early Finish of all terminal tasks.
 */
export function calculateNetworkProjectFinish(cpmResults) {
  let projectFinish = null;
  for (const cpm of cpmResults.values()) {
    if (cpm.earlyFinish && (!projectFinish || isAfter(cpm.earlyFinish, projectFinish))) {
      projectFinish = cpm.earlyFinish;
    }
  }
  return projectFinish;
}
