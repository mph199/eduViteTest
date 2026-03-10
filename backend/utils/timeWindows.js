/**
 * Shared time-window utilities used by index.js, teacher.js, and scripts.
 */

const pad2 = (n) => String(n).padStart(2, '0');
const toMins = (h, m) => h * 60 + m;
const fmt = (mins) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;

export function buildHalfHourWindows(startHour, endHour) {
  const windows = [];
  const start = toMins(startHour, 0);
  const end = toMins(endHour, 0);
  for (let m = start; m + 30 <= end; m += 30) {
    windows.push(`${fmt(m)} - ${fmt(m + 30)}`);
  }
  return windows;
}

export function buildQuarterHourWindows(startHour, endHour, slotMinutes = 15) {
  const dur = [10, 15, 20, 30].includes(slotMinutes) ? slotMinutes : 15;
  const windows = [];
  const start = toMins(startHour, 0);
  const end = toMins(endHour, 0);
  for (let m = start; m + dur <= end; m += dur) {
    windows.push(`${fmt(m)} - ${fmt(m + dur)}`);
  }
  return windows;
}

export function getRequestedTimeWindowsForSystem(system) {
  if (system === 'vollzeit') {
    return buildHalfHourWindows(17, 19);
  }
  return buildHalfHourWindows(16, 18);
}

export function formatDateDE(isoOrDate) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}
