/** Mo-Fr (5 entries, index 0 = Montag). Used by BL schedule and AdminTeachers. */
export const WEEKDAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'] as const;

/** Mo-So (7 entries, index 0 = Montag). Used by SSW counselors (0-based weekday). */
export const WEEKDAY_LABELS_FULL = [
  'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag',
] as const;

/** Short form Mo-Fr. */
export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr'] as const;

/** Short form Mo-So (7 entries). Used for calendar grid headers. */
export const WEEKDAY_SHORT_FULL = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
