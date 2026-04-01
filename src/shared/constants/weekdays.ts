/**
 * Mo-Fr (5 entries, index 0 = Montag). Used by BL schedule and AdminTeachers.
 *
 * HINWEIS Weekday-Indexierung:
 * - BL (beratungslehrer): DB speichert 1-basiert (1=Mo … 5=Fr, PostgreSQL-Konvention).
 *   → Zugriff: WEEKDAY_SHORT[s.weekday - 1]
 * - SSW (schulsozialarbeit): DB speichert 0-basiert (0=Mo … 6=So).
 *   → Zugriff: WEEKDAY_LABELS_FULL[entry.weekday]
 * Beide Varianten sind korrekt; die Differenz liegt in den jeweiligen Migrationen.
 */
export const WEEKDAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'] as const;

/** Mo-So (7 entries, index 0 = Montag). Used by SSW counselors (0-based weekday). */
export const WEEKDAY_LABELS_FULL = [
  'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag',
] as const;

/** Short form Mo-Fr. BL uses 1-based DB weekday → access via WEEKDAY_SHORT[weekday - 1]. */
export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr'] as const;

/** Short form Mo-So (7 entries). Used for calendar grid headers. */
export const WEEKDAY_SHORT_FULL = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
