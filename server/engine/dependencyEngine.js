/**
 * Dependency Engine
 * 
 * Handles FS/SS/FF/SF dependency types with lag/lead.
 * Provides topological sort, circular dependency detection,
 * and dependency graph construction.
 */

import { addWorkingDays, parseDate } from './calendarEngine.js';

/**
 * Dependency types and their constraint logic:
 * FS (Finish-to-Start): Successor can't start until predecessor finishes (+ lag)
 * SS (Start-to-Start):  Successor can't start until predecessor starts (+ lag)
 * FF (Finish-to-Finish): Successor can't finish until predecessor finishes (+ lag)
 * SF (Start-to-Finish):  Successor can't finish until predecessor starts (+ lag)
 */

/**
 * Build adjacency lists from dependency records.
 * @param {Array} dependencies - Array of { predecessor_task_id, successor_task_id, dependency_type, lag_days }
 * @returns {{ successors: Map, predecessors: Map }}
 */
export function buildAdjacencyLists(dependencies) {
  const successors = new Map();   // taskId -> [{ taskId, type, lag }]
  const predecessors = new Map(); // taskId -> [{ taskId, type, lag }]

  for (const dep of dependencies) {
    const predId = dep.predecessor_task_id;
    const succId = dep.successor_task_id;
    const type = dep.dependency_type || 'FS';
    const lag = dep.lag_days || 0;

    if (!successors.has(predId)) successors.set(predId, []);
    successors.get(predId).push({ taskId: succId, type, lag });

    if (!predecessors.has(succId)) predecessors.set(succId, []);
    predecessors.get(succId).push({ taskId: predId, type, lag });
  }

  return { successors, predecessors };
}

const WHITE = 0, GRAY = 1, BLACK = 2;

/**
 * Detect circular dependencies using DFS.
 * @param {Map} successors - Adjacency list of successors
 * @param {Array} taskIds - All task IDs
 * @returns {{ hasCircular: boolean, cycle: string[] }}
 */
export function detectCircularDependencies(successors, taskIds) {
  const color = new Map();
  const parent = new Map();
  
  for (const id of taskIds) {
    color.set(id, WHITE);
  }

  for (const id of taskIds) {
    if (color.get(id) === WHITE) {
      const result = dfsVisit(id, successors, color, parent);
      if (result) return result;
    }
  }

  return { hasCircular: false, cycle: [] };
}

function dfsVisit(u, successors, color, parent) {
  color.set(u, GRAY);
  const neighbors = successors.get(u) || [];
  
  for (const { taskId: v } of neighbors) {
    if (color.get(v) === GRAY) {
      // Found cycle - reconstruct it
      const cycle = [v, u];
      let current = u;
      while (parent.has(current) && parent.get(current) !== v) {
        current = parent.get(current);
        cycle.push(current);
      }
      cycle.reverse();
      return { hasCircular: true, cycle };
    }
    if (color.get(v) === undefined) continue; // task not in our set
    if (color.get(v) === 0) {
      parent.set(v, u);
      const result = dfsVisit(v, successors, color, parent);
      if (result) return result;
    }
  }
  
  color.set(u, BLACK);
  return null;
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns tasks in dependency order (predecessors first).
 * 
 * @param {Array} taskIds - All task IDs
 * @param {Map} successors - task -> successors map
 * @param {Map} predecessors - task -> predecessors map
 * @returns {string[]} Sorted task IDs
 */
export function topologicalSort(taskIds, successors, predecessors) {
  const inDegree = new Map();
  
  for (const id of taskIds) {
    inDegree.set(id, 0);
  }
  
  for (const id of taskIds) {
    const preds = predecessors.get(id) || [];
    // Only count predecessors that are in our task set
    const validPreds = preds.filter(p => inDegree.has(p.taskId));
    inDegree.set(id, validPreds.length);
  }

  const queue = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const u = queue.shift();
    sorted.push(u);
    
    const succs = successors.get(u) || [];
    for (const { taskId: v } of succs) {
      if (!inDegree.has(v)) continue;
      inDegree.set(v, inDegree.get(v) - 1);
      if (inDegree.get(v) === 0) {
        queue.push(v);
      }
    }
  }

  // If sorted doesn't contain all tasks, there's a cycle
  if (sorted.length < taskIds.length) {
    const missing = taskIds.filter(id => !sorted.includes(id));
    return { sorted, incomplete: true, cyclicTasks: missing };
  }

  return { sorted, incomplete: false, cyclicTasks: [] };
}

/**
 * Calculate the constraint date imposed by a predecessor on a successor.
 * 
 * @param {string} depType - FS, SS, FF, SF
 * @param {Date} predStart - Predecessor's start date
 * @param {Date} predFinish - Predecessor's finish date
 * @param {number} lag - Lag in working days (positive = delay, negative = lead)
 * @param {Object} calendar - Calendar config
 * @param {Set} holidaySet - Holiday set
 * @returns {{ constrainedStart: Date|null, constrainedFinish: Date|null }}
 */
export function calculateConstraint(depType, predStart, predFinish, lag = 0, calendar, holidaySet) {
  const pStart = parseDate(predStart);
  const pFinish = parseDate(predFinish);

  switch (depType) {
    case 'FS': {
      // Successor can't start until predecessor finishes + lag
      if (!pFinish) return { constrainedStart: null, constrainedFinish: null };
      const constrainedStart = lag !== 0 
        ? addWorkingDays(pFinish, lag, calendar, holidaySet)
        : addWorkingDays(pFinish, 1, calendar, holidaySet); // Next working day after finish
      return { constrainedStart, constrainedFinish: null };
    }
    case 'SS': {
      // Successor can't start until predecessor starts + lag
      if (!pStart) return { constrainedStart: null, constrainedFinish: null };
      const constrainedStart = lag !== 0
        ? addWorkingDays(pStart, lag, calendar, holidaySet)
        : pStart;
      return { constrainedStart, constrainedFinish: null };
    }
    case 'FF': {
      // Successor can't finish until predecessor finishes + lag
      if (!pFinish) return { constrainedStart: null, constrainedFinish: null };
      const constrainedFinish = lag !== 0
        ? addWorkingDays(pFinish, lag, calendar, holidaySet)
        : pFinish;
      return { constrainedStart: null, constrainedFinish };
    }
    case 'SF': {
      // Successor can't finish until predecessor starts + lag
      if (!pStart) return { constrainedStart: null, constrainedFinish: null };
      const constrainedFinish = lag !== 0
        ? addWorkingDays(pStart, lag, calendar, holidaySet)
        : pStart;
      return { constrainedStart: null, constrainedFinish };
    }
    default:
      return { constrainedStart: null, constrainedFinish: null };
  }
}

/**
 * Validate dependencies for import.
 * @param {Array} dependencies - Raw dependency data
 * @param {Set<string>} validTaskIds - Set of valid task IDs
 * @returns {Array} Array of validation error strings
 */
export function validateDependencies(dependencies, validTaskIds) {
  const errors = [];

  for (const dep of dependencies) {
    if (!validTaskIds.has(dep.predecessor_task_id)) {
      errors.push(`Predecessor "${dep.predecessor_task_id}" does not exist (referenced by successor "${dep.successor_task_id}").`);
    }
    if (!validTaskIds.has(dep.successor_task_id)) {
      errors.push(`Successor "${dep.successor_task_id}" does not exist (referenced by predecessor "${dep.predecessor_task_id}").`);
    }
    if (dep.predecessor_task_id === dep.successor_task_id) {
      errors.push(`Task "${dep.predecessor_task_id}" references itself as both predecessor and successor.`);
    }
    if (dep.dependency_type && !['FS', 'SS', 'FF', 'SF'].includes(dep.dependency_type)) {
      errors.push(`Invalid dependency type "${dep.dependency_type}" between "${dep.predecessor_task_id}" and "${dep.successor_task_id}". Must be FS, SS, FF, or SF.`);
    }
  }

  return errors;
}

/**
 * Get all predecessors for a task (transitive).
 */
export function getAllPredecessors(taskId, predecessorsMap, visited = new Set()) {
  if (visited.has(taskId)) return visited;
  visited.add(taskId);
  const preds = predecessorsMap.get(taskId) || [];
  for (const { taskId: predId } of preds) {
    getAllPredecessors(predId, predecessorsMap, visited);
  }
  return visited;
}

/**
 * Get all successors for a task (transitive).
 */
export function getAllSuccessors(taskId, successorsMap, visited = new Set()) {
  if (visited.has(taskId)) return visited;
  visited.add(taskId);
  const succs = successorsMap.get(taskId) || [];
  for (const { taskId: succId } of succs) {
    getAllSuccessors(succId, successorsMap, visited);
  }
  return visited;
}
