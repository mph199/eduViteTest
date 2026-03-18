/**
 * Normalizes a date field (string | Date) to "YYYY-MM-DD".
 */
export function normalizeDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
