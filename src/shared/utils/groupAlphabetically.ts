export interface AlphaGroup<T> {
  letter: string;
  items: T[];
}

/**
 * Gruppiert Elemente alphabetisch nach dem ersten Buchstaben eines Schlüssels.
 * Sortiert innerhalb jeder Gruppe stabil nach dem vollen Schlüssel.
 */
export function groupAlphabetically<T>(
  items: T[],
  getKey: (item: T) => string,
): AlphaGroup<T>[] {
  const sorted = [...items].sort((a, b) =>
    getKey(a).localeCompare(getKey(b), 'de')
  );
  const groups: AlphaGroup<T>[] = [];
  let current: AlphaGroup<T> | null = null;
  for (const item of sorted) {
    const letter = (getKey(item)[0] || '#').toUpperCase();
    if (!current || current.letter !== letter) {
      current = { letter, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }
  return groups;
}

/**
 * Erzeugt Initialen aus Vor- und Nachname (max. 2 Zeichen).
 */
export function getInitials(firstName: string, lastName: string): string {
  const f = firstName.trim();
  const l = lastName.trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  return ((f || l)[0] || '?').toUpperCase();
}

/**
 * Erzeugt Initialen aus einem zusammengesetzten Namen ("Max Mustermann").
 */
export function getInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}
