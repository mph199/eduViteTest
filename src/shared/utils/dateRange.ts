/**
 * Returns the first and last day of a given month as YYYY-MM-DD strings.
 */
export function getMonthRange(year: number, month: number): { dateFrom: string; dateUntil: string } {
  const mm = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    dateFrom: `${year}-${mm}-01`,
    dateUntil: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}
