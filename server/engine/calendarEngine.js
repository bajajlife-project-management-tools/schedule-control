/**
 * Calendar Engine
 * 
 * Provides configurable working-day calculations for all schedule math.
 * Supports: weekday config, public/company/project holidays, working weekends.
 * All variance, float, and duration calculations go through this engine.
 */

import { addDays, differenceInCalendarDays, format, parse, isValid, isBefore, isAfter, isEqual, startOfDay } from 'date-fns';

// Default calendar: Mon-Fri working, Sat-Sun off
const DEFAULT_CALENDAR = {
  working_monday: true,
  working_tuesday: true,
  working_wednesday: true,
  working_thursday: true,
  working_friday: true,
  working_saturday: false,
  working_sunday: false,
};

/**
 * Parse a date string to a Date object. Supports ISO and common formats.
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isValid(dateStr) ? startOfDay(dateStr) : null;
  const d = new Date(dateStr);
  return isValid(d) ? startOfDay(d) : null;
}

/**
 * Format a date to 'dd-MMM-yyyy' for display (e.g., 07-Jul-2026)
 */
export function formatDate(date) {
  if (!date) return '';
  const d = parseDate(date);
  if (!d) return '';
  return format(d, 'dd-MMM-yyyy');
}

/**
 * Format a date to ISO string for storage
 */
export function toISODate(date) {
  if (!date) return null;
  const d = parseDate(date);
  if (!d) return null;
  return format(d, 'yyyy-MM-dd');
}

/**
 * Check if a given day is a working day based on calendar config and holidays.
 * 
 * @param {Date} date - The date to check
 * @param {Object} calendar - Calendar config object
 * @param {Set<string>} holidaySet - Set of ISO date strings that are holidays
 * @returns {boolean}
 */
export function isWorkingDay(date, calendar = DEFAULT_CALENDAR, holidaySet = new Set()) {
  const d = parseDate(date);
  if (!d) return false;

  // Check holidays first
  const isoStr = format(d, 'yyyy-MM-dd');
  if (holidaySet.has(isoStr)) return false;

  // Check day of week (0=Sunday, 6=Saturday)
  const dayOfWeek = d.getDay();
  const dayMap = [
    calendar.working_sunday ?? false,    // 0 = Sunday
    calendar.working_monday ?? true,     // 1 = Monday
    calendar.working_tuesday ?? true,    // 2 = Tuesday
    calendar.working_wednesday ?? true,  // 3 = Wednesday
    calendar.working_thursday ?? true,   // 4 = Thursday
    calendar.working_friday ?? true,     // 5 = Friday
    calendar.working_saturday ?? false,  // 6 = Saturday
  ];

  return !!dayMap[dayOfWeek];
}

/**
 * Count working days between two dates (exclusive of start, inclusive of end).
 * Returns positive if end > start, negative if end < start, 0 if equal.
 * 
 * This is the core variance calculation:
 *   negative = ahead of schedule
 *   zero     = on schedule
 *   positive = delay
 *
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {Object} calendar
 * @param {Set<string>} holidaySet
 * @returns {number} Working days between dates
 */
export function workingDaysBetween(startDate, endDate, calendar = DEFAULT_CALENDAR, holidaySet = new Set()) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return null;

  if (isEqual(start, end)) return 0;

  const direction = isAfter(end, start) ? 1 : -1;
  let count = 0;
  let current = addDays(start, direction);

  while (direction === 1 ? !isAfter(current, end) : !isBefore(current, end)) {
    if (isWorkingDay(current, calendar, holidaySet)) {
      count += direction;
    }
    current = addDays(current, direction);
  }

  return count;
}

/**
 * Add working days to a date.
 * Positive = forward, Negative = backward.
 * 
 * @param {Date|string} startDate
 * @param {number} workingDays - Number of working days to add
 * @param {Object} calendar
 * @param {Set<string>} holidaySet
 * @returns {Date}
 */
export function addWorkingDays(startDate, workingDays, calendar = DEFAULT_CALENDAR, holidaySet = new Set()) {
  const start = parseDate(startDate);
  if (!start || workingDays === 0) return start;

  const direction = workingDays > 0 ? 1 : -1;
  let remaining = Math.abs(workingDays);
  let current = start;

  while (remaining > 0) {
    current = addDays(current, direction);
    if (isWorkingDay(current, calendar, holidaySet)) {
      remaining--;
    }
  }

  return current;
}

/**
 * Calculate duration in working days between start and finish (inclusive of both).
 */
export function calculateDurationWD(startDate, finishDate, calendar = DEFAULT_CALENDAR, holidaySet = new Set()) {
  const start = parseDate(startDate);
  const end = parseDate(finishDate);
  if (!start || !end) return null;

  if (isEqual(start, end)) return isWorkingDay(start, calendar, holidaySet) ? 1 : 0;

  let count = 0;
  let current = new Date(start);

  while (!isAfter(current, end)) {
    if (isWorkingDay(current, calendar, holidaySet)) {
      count++;
    }
    current = addDays(current, 1);
  }

  return count;
}

/**
 * Calculate remaining duration in working days from today (or status date) to finish.
 */
export function calculateRemainingDurationWD(finishDate, statusDate, percentComplete = 0, calendar = DEFAULT_CALENDAR, holidaySet = new Set()) {
  const finish = parseDate(finishDate);
  const status = parseDate(statusDate) || startOfDay(new Date());
  if (!finish) return null;

  if (percentComplete >= 100) return 0;

  const remaining = workingDaysBetween(status, finish, calendar, holidaySet);
  return remaining !== null ? Math.max(0, remaining) : null;
}

/**
 * Build a holiday set from an array of holiday objects.
 * @param {Array} holidays - Array of { date: 'YYYY-MM-DD' }
 * @returns {Set<string>}
 */
export function buildHolidaySet(holidays = []) {
  const set = new Set();
  for (const h of holidays) {
    if (h.date) set.add(h.date);
  }
  return set;
}

/**
 * Get calendar config from DB records or return defaults.
 */
export function buildCalendarConfig(dbConfig) {
  if (!dbConfig) return { ...DEFAULT_CALENDAR };
  return {
    working_monday: !!dbConfig.working_monday,
    working_tuesday: !!dbConfig.working_tuesday,
    working_wednesday: !!dbConfig.working_wednesday,
    working_thursday: !!dbConfig.working_thursday,
    working_friday: !!dbConfig.working_friday,
    working_saturday: !!dbConfig.working_saturday,
    working_sunday: !!dbConfig.working_sunday,
  };
}
