/**
 * Shared time-window utilities (Frontend mirror of backend/utils/timeWindows.js)
 */

const pad2 = (n: number) => String(n).padStart(2, '0');
const toMins = (h: number, m: number) => h * 60 + m;
const fmt = (mins: number) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;

/** Parse "HH:MM" or "HH:MM:SS" to total minutes. Returns null on invalid input. */
export function parseTime(timeStr: string | null | undefined): number | null {
  if (typeof timeStr !== 'string') return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  return toMins(parseInt(match[1], 10), parseInt(match[2], 10));
}

export function buildHalfHourWindows(startHour: string | number, endHour: string | number): string[] {
  const windows: string[] = [];
  const start = typeof startHour === 'number' ? toMins(startHour, 0) : parseTime(startHour) ?? toMins(16, 0);
  const end = typeof endHour === 'number' ? toMins(endHour, 0) : parseTime(endHour) ?? toMins(19, 0);
  for (let m = start; m + 30 <= end; m += 30) {
    windows.push(`${fmt(m)} - ${fmt(m + 30)}`);
  }
  return windows;
}

/** Build 30-min windows from teacher's available_from/available_until. */
export function getTimeWindowsForTeacher(availableFrom?: string, availableUntil?: string): string[] {
  return buildHalfHourWindows(availableFrom || '16:00', availableUntil || '19:00');
}

export function formatDateDE(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}
