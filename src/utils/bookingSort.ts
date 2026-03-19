import type { TimeSlot } from '../types';

/** Parse ISO (YYYY-MM-DD) or German (DD.MM.YYYY) date strings to UTC ms. */
export function parseDateValue(value?: string | null): number | null {
  if (!value) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(value)) {
    const [y, m, d] = value.split('-').map((n) => Number(n));
    if (!y || !m || !d) return null;
    return Date.UTC(y, m - 1, d);
  }
  const de = /^\d{2}\.\d{2}\.\d{4}$/;
  if (de.test(value)) {
    const [d, m, y] = value.split('.').map((n) => Number(n));
    if (!y || !m || !d) return null;
    return Date.UTC(y, m - 1, d);
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback.getTime();
}

/** Parse "HH:MM" time strings to minutes since midnight. */
export function parseStartMinutes(value?: string | null): number | null {
  if (!value) return null;
  const m = value.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

/** Display label for a booking's visitor (parent name or company name). */
export function visitorLabel(b: Pick<TimeSlot, 'visitorType' | 'parentName' | 'companyName'>): string {
  if (b.visitorType === 'parent') return (b.parentName || '').trim();
  return (b.companyName || '').trim();
}
