import { describe, it, expect } from 'vitest';
import {
  isWorkingDay,
  workingDaysBetween,
  addWorkingDays,
  calculateDurationWD,
  buildHolidaySet,
  buildCalendarConfig,
  parseDate,
  toISODate
} from '../engine/calendarEngine.js';

import {
  buildAdjacencyLists,
  detectCircularDependencies,
  topologicalSort,
  calculateConstraint
} from '../engine/dependencyEngine.js';

import {
  calculateCriticalPath,
  calculateNetworkProjectFinish
} from '../engine/criticalPathEngine.js';

import {
  calculateTaskStatus,
  calculateMilestoneStatus,
  calculateProjectStatus,
  calculateCumulativeMilestoneSlippage,
  STATUS
} from '../engine/statusEngine.js';

import { calculateHealthScore } from '../engine/healthScoreEngine.js';
import { generateExecutiveNarrative } from '../engine/narrativeEngine.js';

describe('Calendar Engine', () => {
  const calendar = buildCalendarConfig();
  const holidays = buildHolidaySet([{ date: '2026-07-03' }]); // Friday holiday

  it('correctly identifies working days and weekends', () => {
    // 2026-07-06 is Monday
    expect(isWorkingDay('2026-07-06', calendar, holidays)).toBe(true);
    // 2026-07-04 is Saturday
    expect(isWorkingDay('2026-07-04', calendar, holidays)).toBe(false);
    // 2026-07-05 is Sunday
    expect(isWorkingDay('2026-07-05', calendar, holidays)).toBe(false);
    // 2026-07-03 is Holiday Friday
    expect(isWorkingDay('2026-07-03', calendar, holidays)).toBe(false);
  });

  it('calculates working days between dates including negative variance', () => {
    // Monday 06-Jul to Friday 10-Jul = 4 working days
    const wd = workingDaysBetween('2026-07-06', '2026-07-10', calendar);
    expect(wd).toBe(4);

    // Negative variance: ahead of schedule (finish earlier than baseline)
    const negativeWd = workingDaysBetween('2026-07-10', '2026-07-06', calendar);
    expect(negativeWd).toBe(-4);
  });

  it('adds working days correctly skipping weekends', () => {
    // Friday 10-Jul + 1 working day -> Monday 13-Jul
    const nextWd = addWorkingDays('2026-07-10', 1, calendar);
    expect(toISODate(nextWd)).toBe('2026-07-13');
  });
});

describe('Dependency & Critical Path Engine', () => {
  const calendar = buildCalendarConfig();
  const holidays = new Set();

  it('detects circular dependencies', () => {
    const deps = [
      { predecessor_task_id: 'A', successor_task_id: 'B' },
      { predecessor_task_id: 'B', successor_task_id: 'C' },
      { predecessor_task_id: 'C', successor_task_id: 'A' }, // Circular!
    ];
    const { successors } = buildAdjacencyLists(deps);
    const result = detectCircularDependencies(successors, ['A', 'B', 'C']);
    expect(result.hasCircular).toBe(true);
  });

  it('calculates CPM forward/backward pass, float, and critical path', () => {
    const tasks = [
      { id: 'T1', original_baseline_start: '2026-07-06', original_baseline_finish: '2026-07-10' }, // 5 WD
      { id: 'T2', original_baseline_start: '2026-07-13', original_baseline_finish: '2026-07-17' }, // 5 WD
      { id: 'T3_parallel', original_baseline_start: '2026-07-13', original_baseline_finish: '2026-07-14' }, // 2 WD (has float)
    ];

    const dependencies = [
      { predecessor_task_id: 'T1', successor_task_id: 'T2', dependency_type: 'FS', lag_days: 0 },
      { predecessor_task_id: 'T1', successor_task_id: 'T3_parallel', dependency_type: 'FS', lag_days: 0 },
    ];

    const cpm = calculateCriticalPath(tasks, dependencies, calendar, holidays);
    
    // T1 and T2 must be on critical path (Total Float = 0)
    expect(cpm.get('T1').isCriticalPath).toBe(true);
    expect(cpm.get('T2').isCriticalPath).toBe(true);
    expect(cpm.get('T1').totalFloat).toBe(0);

    // T3 has float because it finishes earlier than T2 (the terminal driving task)
    expect(cpm.get('T3_parallel').totalFloat).toBeGreaterThan(0);
    expect(cpm.get('T3_parallel').isCriticalPath).toBe(false);
  });
});

describe('Status Engine & Governance Rules', () => {
  const calendar = buildCalendarConfig();
  const holidays = new Set();

  it('RULE 4 & 9: Factual actual dates drive status; late actual finish is COMPLETED - LATE', () => {
    const lateCompletedTask = {
      original_baseline_finish: '2026-07-07',
      current_baseline_finish: '2026-07-07',
      actual_finish: '2026-07-24', // 13 WD late
    };
    const result = calculateTaskStatus(lateCompletedTask, 5, calendar, holidays);
    expect(result.status).toBe(STATUS.COMPLETED_LATE);
    expect(result.varianceWD).toBe(13);
  });

  it('RULE 10: Open task with blank forecast returns FORECAST REQUIRED', () => {
    const task = {
      current_baseline_finish: '2026-08-15',
      owner_forecast_finish: null,
      actual_finish: null,
    };
    const result = calculateTaskStatus(task, 5, calendar, holidays);
    expect(result.status).toBe(STATUS.FORECAST_REQUIRED);
  });

  it('Correctly identifies AT RISK - FINAL DATE PROTECTED', () => {
    const milestoneStatuses = [
      { status: STATUS.DELAYED, varianceWD: 25 },
      { status: STATUS.DELAYED, varianceWD: 16 },
      { status: STATUS.DELAYED, varianceWD: 16 },
      { status: STATUS.DELAYED, varianceWD: 19 },
      { status: STATUS.COMPLETED_LATE, varianceWD: 13 },
      { status: STATUS.ON_TRACK, varianceWD: 0 },
      { status: STATUS.ON_TRACK, varianceWD: 0 },
      { status: STATUS.ON_TRACK, varianceWD: 0 },
    ];

    const project = {
      current_baseline_finish: '2026-11-27',
      original_baseline_finish: '2026-11-27',
      actual_finish: null,
    };

    const networkFinish = parseDate('2026-11-27'); // Overall project forecast finishes on baseline date!

    const projStatus = calculateProjectStatus(project, milestoneStatuses, networkFinish, 5, calendar, holidays);
    
    // Crucial requirement: status MUST be AT RISK - FINAL DATE PROTECTED
    expect(projStatus.status).toBe(STATUS.AT_RISK_FINAL_PROTECTED);
    expect(projStatus.varianceWD).toBe(0);

    // Cumulative slippage must be sum (89 WD) but distinct from project variance (0 WD)
    const cumulativeSlippage = calculateCumulativeMilestoneSlippage(milestoneStatuses);
    expect(cumulativeSlippage).toBe(89);
  });
});
