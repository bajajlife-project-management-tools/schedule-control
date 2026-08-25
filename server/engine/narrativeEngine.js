/**
 * Narrative Engine
 * 
 * Auto-generates executive narratives from schedule data.
 * All statements are derived from actual data — never invented.
 */

import { formatDate } from './calendarEngine.js';
import { STATUS } from './statusEngine.js';

/**
 * Generate executive narrative paragraph.
 */
export function generateExecutiveNarrative(dashboardData) {
  const {
    projectName = 'The project',
    overallStatus,
    forecastFinish,
    currentBaselineFinish,
    originalBaselineFinish,
    varianceWD,
    varianceOriginalWD,
    milestoneStatuses = [],
    cumulativeSlippage,
    maxVariance,
    criticalPathTasks = [],
    recoveryActions = [],
    raidItems = [],
    topDrivers = [],
  } = dashboardData;

  const parts = [];

  // Opening: Project forecast position
  if (overallStatus === STATUS.COMPLETED_ON_TIME) {
    parts.push(`${projectName} has been completed on time, aligned to the baseline of ${formatDate(currentBaselineFinish)}.`);
    return parts.join(' ');
  }

  if (overallStatus === STATUS.COMPLETED_LATE) {
    parts.push(`${projectName} was completed on ${formatDate(forecastFinish)}, ${Math.abs(varianceWD)} working days beyond the baseline of ${formatDate(currentBaselineFinish)}.`);
    return parts.join(' ');
  }

  if (forecastFinish) {
    const forecastStr = formatDate(forecastFinish);
    const baselineStr = formatDate(currentBaselineFinish);

    if (varianceWD === 0) {
      parts.push(`Overall project completion remains forecast for ${forecastStr}, aligned to the current baseline.`);
    } else if (varianceWD < 0) {
      parts.push(`Overall project completion is forecast for ${forecastStr}, ${Math.abs(varianceWD)} working days ahead of the current baseline of ${baselineStr}.`);
    } else if (varianceWD > 0) {
      parts.push(`Overall project completion is now forecast for ${forecastStr}, representing a ${varianceWD} working day delay against the current baseline of ${baselineStr}.`);
    }
  } else {
    parts.push(`Project forecast finish has not been established. Forecast updates are required.`);
  }

  // Milestone pressure
  const delayedMs = milestoneStatuses.filter(m => m.status === STATUS.DELAYED);
  const atRiskMs = milestoneStatuses.filter(m => m.status === STATUS.AT_RISK);
  const forecastReqMs = milestoneStatuses.filter(m => m.status === STATUS.FORECAST_REQUIRED);
  const completedLateMs = milestoneStatuses.filter(m => m.status === STATUS.COMPLETED_LATE);
  const totalMs = milestoneStatuses.length;

  const forecastLateCount = delayedMs.length + atRiskMs.length;
  if (forecastLateCount > 0 && varianceWD <= 0) {
    parts.push(`However, ${forecastLateCount} of ${totalMs} milestones are currently forecast beyond baseline, with a cumulative milestone slippage of ${cumulativeSlippage} working days and a maximum individual milestone variance of +${maxVariance} working days.`);
    parts.push(`The final project date remains protected through parallel execution and available schedule buffer.`);
  } else if (forecastLateCount > 0) {
    parts.push(`${forecastLateCount} of ${totalMs} milestones are forecast beyond baseline, with a cumulative milestone slippage of ${cumulativeSlippage} working days.`);
  }

  // Schedule pressure areas
  const pressureAreas = [...delayedMs, ...atRiskMs]
    .sort((a, b) => (b.varianceWD || 0) - (a.varianceWD || 0))
    .slice(0, 3);
  
  if (pressureAreas.length > 0) {
    const names = pressureAreas.map(m => m.milestoneId || m.name).join(' and ');
    parts.push(`${names} represent${pressureAreas.length === 1 ? 's' : ''} the primary schedule pressure area${pressureAreas.length > 1 ? 's' : ''}.`);
  }

  // Recovery
  const activeRecoveries = recoveryActions.filter(r => r.status === 'In Progress' || r.status === 'Recovered');
  if (activeRecoveries.length > 0) {
    parts.push(`Recovery actions are being tracked${raidItems.length > 0 ? ' against the linked RAID items' : ''}.`);
  }

  // Forecast required
  if (forecastReqMs.length > 0) {
    parts.push(`${forecastReqMs.length} milestone${forecastReqMs.length > 1 ? 's' : ''} require${forecastReqMs.length === 1 ? 's' : ''} forecast updates.`);
  }

  // Critical path
  if (criticalPathTasks.length > 0) {
    const atRiskCritical = criticalPathTasks.filter(t => t.status === STATUS.AT_RISK || t.status === STATUS.DELAYED);
    if (atRiskCritical.length > 0) {
      parts.push(`${atRiskCritical.length} critical path task${atRiskCritical.length > 1 ? 's are' : ' is'} currently at risk.`);
    }
  }

  return parts.join(' ');
}

/**
 * Generate management message for a milestone.
 */
export function generateMilestoneMessage(milestone, milestoneStatus) {
  const { status, varianceWD } = milestoneStatus;

  switch (status) {
    case STATUS.COMPLETED_ON_TIME:
      return `Completed on time (${formatDate(milestone.actual_finish)}).`;
    case STATUS.COMPLETED_LATE:
      return `Completed ${Math.abs(varianceWD)} WD late (${formatDate(milestone.actual_finish)}). Variance absorbed.`;
    case STATUS.ON_TRACK:
      return `On track for baseline delivery.`;
    case STATUS.AT_RISK:
      return `At risk — forecast ${varianceWD} WD beyond baseline. Monitoring required.`;
    case STATUS.DELAYED:
      return `Delayed by ${varianceWD} WD. Recovery action required.`;
    case STATUS.RECOVERED:
      return `Previously delayed, now recovered to within tolerance.`;
    case STATUS.FORECAST_REQUIRED:
      return `Forecast update required from owner.`;
    default:
      return '';
  }
}
