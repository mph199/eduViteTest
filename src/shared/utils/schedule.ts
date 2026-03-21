import type { ScheduleEntry } from '../../types';

/**
 * Build a default weekly schedule.
 *
 * @param weekdays  Array of weekday numbers to include (e.g. [1,2,3,4,5] or [0..6])
 * @param activeFn  Optional predicate – receives the weekday number, returns whether
 *                  the day should default to active. Defaults to `() => false`.
 */
export function buildDefaultSchedule(
  weekdays: number[],
  activeFn: (wd: number) => boolean = () => false,
): ScheduleEntry[] {
  return weekdays.map(wd => ({
    weekday: wd,
    start_time: '08:00',
    end_time: '14:00',
    active: activeFn(wd),
  }));
}

/**
 * Merge fetched schedule rows into a defaults array.
 * Missing weekdays keep their default values; existing rows have their
 * times normalised to HH:MM.
 */
export function mergeScheduleEntries(
  defaults: ScheduleEntry[],
  fetched: ScheduleEntry[],
): ScheduleEntry[] {
  return defaults.map(def => {
    const found = fetched.find(r => r.weekday === def.weekday);
    if (!found) return def;
    return {
      weekday: found.weekday,
      start_time: found.start_time?.toString().slice(0, 5) || def.start_time,
      end_time: found.end_time?.toString().slice(0, 5) || def.end_time,
      active: found.active,
    };
  });
}
