/**
 * Shared time-window utilities used by index.js, teacher.js, and scripts.
 */

const pad2 = (n) => String(n).padStart(2, '0');
const toMins = (h, m) => h * 60 + m;
const fmt = (mins) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;

/** Format total minutes as "HH:MM". */
export const fmtMinutes = fmt;

/** Parse "HH:MM - HH:MM" time window string to { start, end } in total minutes. Returns null on invalid input. */
export function parseTimeWindow(timeWindow) {
  if (typeof timeWindow !== 'string') return null;
  const m = timeWindow.trim().match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
  if (!m) return null;
  const start = Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
  const end = Number.parseInt(m[3], 10) * 60 + Number.parseInt(m[4], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

/** Parse "HH:MM" or "HH:MM:SS" string to total minutes. Returns null on invalid input. */
export function parseTime(timeStr) {
  if (typeof timeStr !== 'string') return null;
  const m = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  return toMins(parseInt(m[1], 10), parseInt(m[2], 10));
}

export function buildHalfHourWindows(startHour, endHour) {
  const windows = [];
  const start = typeof startHour === 'number' ? toMins(startHour, 0) : parseTime(startHour) ?? toMins(16, 0);
  const end = typeof endHour === 'number' ? toMins(endHour, 0) : parseTime(endHour) ?? toMins(19, 0);
  for (let m = start; m + 30 <= end; m += 30) {
    windows.push(`${fmt(m)} - ${fmt(m + 30)}`);
  }
  return windows;
}

export function buildQuarterHourWindows(startHour, endHour, slotMinutes = 15) {
  const dur = [10, 15, 20, 30].includes(slotMinutes) ? slotMinutes : 15;
  const windows = [];
  const start = typeof startHour === 'number' ? toMins(startHour, 0) : parseTime(startHour) ?? toMins(16, 0);
  const end = typeof endHour === 'number' ? toMins(endHour, 0) : parseTime(endHour) ?? toMins(19, 0);
  for (let m = start; m + dur <= end; m += dur) {
    windows.push(`${fmt(m)} - ${fmt(m + dur)}`);
  }
  return windows;
}

/** Build 30-min windows from teacher's available_from/available_until. */
export function getTimeWindowsForTeacher(availableFrom, availableUntil) {
  return buildHalfHourWindows(availableFrom || '16:00', availableUntil || '19:00');
}

/** Generate slots with configurable duration from teacher's time range. */
export function generateTimeSlotsForTeacher(availableFrom, availableUntil, slotMinutes = 15) {
  return buildQuarterHourWindows(availableFrom || '16:00', availableUntil || '19:00', slotMinutes);
}

export function formatDateDE(isoOrDate) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}
