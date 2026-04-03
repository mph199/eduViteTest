/**
 * Icon Registry – curated list of icons available in the IconPicker.
 *
 * Only icons listed here are importable; this keeps the bundle small.
 * Each entry maps an internal name (= lucide export name in kebab-case)
 * to a human-readable German label + category for filtering.
 */

export interface IconEntry {
  name: string;
  label: string;
  category: string;
}

export const ICON_CATEGORIES = [
  'Allgemein',
  'Schulfächer',
  'Organisation',
  'Kommunikation',
  'Personen',
  'Status',
  'Medien',
] as const;

export type IconCategory = (typeof ICON_CATEGORIES)[number];

/**
 * Curated icon list. The `name` must match the kebab-case filename
 * in lucide-react (e.g. "book-open" → `import { BookOpen } from 'lucide-react'`).
 */
export const ICON_REGISTRY: IconEntry[] = [
  // ── Schulfächer ──────────────────────────────────────────────────
  { name: 'book-open', label: 'Buch offen', category: 'Schulfächer' },
  { name: 'book', label: 'Buch', category: 'Schulfächer' },
  { name: 'graduation-cap', label: 'Abschluss', category: 'Schulfächer' },
  { name: 'pencil', label: 'Stift', category: 'Schulfächer' },
  { name: 'pen-tool', label: 'Zeichenstift', category: 'Schulfächer' },
  { name: 'calculator', label: 'Taschenrechner', category: 'Schulfächer' },
  { name: 'flask-conical', label: 'Reagenzglas', category: 'Schulfächer' },
  { name: 'atom', label: 'Atom', category: 'Schulfächer' },
  { name: 'microscope', label: 'Mikroskop', category: 'Schulfächer' },
  { name: 'dna', label: 'DNA', category: 'Schulfächer' },
  { name: 'globe', label: 'Globus', category: 'Schulfächer' },
  { name: 'map', label: 'Karte', category: 'Schulfächer' },
  { name: 'languages', label: 'Sprachen', category: 'Schulfächer' },
  { name: 'music', label: 'Musik', category: 'Schulfächer' },
  { name: 'palette', label: 'Palette', category: 'Schulfächer' },
  { name: 'drama', label: 'Theater', category: 'Schulfächer' },
  { name: 'dumbbell', label: 'Sport', category: 'Schulfächer' },
  { name: 'code', label: 'Informatik', category: 'Schulfächer' },
  { name: 'cpu', label: 'Prozessor', category: 'Schulfächer' },
  { name: 'binary', label: 'Binär', category: 'Schulfächer' },
  { name: 'ruler', label: 'Lineal', category: 'Schulfächer' },
  { name: 'pi', label: 'Pi', category: 'Schulfächer' },
  { name: 'sigma', label: 'Sigma', category: 'Schulfächer' },

  // ── Allgemein ────────────────────────────────────────────────────
  { name: 'star', label: 'Stern', category: 'Allgemein' },
  { name: 'heart', label: 'Herz', category: 'Allgemein' },
  { name: 'zap', label: 'Blitz', category: 'Allgemein' },
  { name: 'flame', label: 'Flamme', category: 'Allgemein' },
  { name: 'sun', label: 'Sonne', category: 'Allgemein' },
  { name: 'moon', label: 'Mond', category: 'Allgemein' },
  { name: 'cloud', label: 'Wolke', category: 'Allgemein' },
  { name: 'leaf', label: 'Blatt', category: 'Allgemein' },
  { name: 'tree-pine', label: 'Baum', category: 'Allgemein' },
  { name: 'flower-2', label: 'Blume', category: 'Allgemein' },
  { name: 'mountain', label: 'Berg', category: 'Allgemein' },
  { name: 'trophy', label: 'Pokal', category: 'Allgemein' },
  { name: 'award', label: 'Auszeichnung', category: 'Allgemein' },
  { name: 'target', label: 'Ziel', category: 'Allgemein' },
  { name: 'lightbulb', label: 'Glühbirne', category: 'Allgemein' },
  { name: 'puzzle', label: 'Puzzle', category: 'Allgemein' },
  { name: 'shapes', label: 'Formen', category: 'Allgemein' },
  { name: 'rocket', label: 'Rakete', category: 'Allgemein' },

  // ── Organisation ─────────────────────────────────────────────────
  { name: 'calendar', label: 'Kalender', category: 'Organisation' },
  { name: 'clock', label: 'Uhr', category: 'Organisation' },
  { name: 'folder', label: 'Ordner', category: 'Organisation' },
  { name: 'file-text', label: 'Dokument', category: 'Organisation' },
  { name: 'clipboard-list', label: 'Checkliste', category: 'Organisation' },
  { name: 'list-checks', label: 'Aufgabenliste', category: 'Organisation' },
  { name: 'layout-grid', label: 'Raster', category: 'Organisation' },
  { name: 'tag', label: 'Label', category: 'Organisation' },
  { name: 'bookmark', label: 'Lesezeichen', category: 'Organisation' },
  { name: 'archive', label: 'Archiv', category: 'Organisation' },
  { name: 'inbox', label: 'Posteingang', category: 'Organisation' },
  { name: 'search', label: 'Suche', category: 'Organisation' },
  { name: 'settings', label: 'Einstellungen', category: 'Organisation' },

  // ── Kommunikation ────────────────────────────────────────────────
  { name: 'mail', label: 'E-Mail', category: 'Kommunikation' },
  { name: 'message-square', label: 'Nachricht', category: 'Kommunikation' },
  { name: 'message-circle', label: 'Chat', category: 'Kommunikation' },
  { name: 'megaphone', label: 'Megaphon', category: 'Kommunikation' },
  { name: 'bell', label: 'Glocke', category: 'Kommunikation' },
  { name: 'phone', label: 'Telefon', category: 'Kommunikation' },
  { name: 'video', label: 'Video', category: 'Kommunikation' },
  { name: 'share-2', label: 'Teilen', category: 'Kommunikation' },

  // ── Personen ─────────────────────────────────────────────────────
  { name: 'user', label: 'Person', category: 'Personen' },
  { name: 'users', label: 'Gruppe', category: 'Personen' },
  { name: 'school', label: 'Schule', category: 'Personen' },
  { name: 'building', label: 'Gebäude', category: 'Personen' },
  { name: 'home', label: 'Haus', category: 'Personen' },
  { name: 'hand-helping', label: 'Hilfe', category: 'Personen' },
  { name: 'accessibility', label: 'Barrierefreiheit', category: 'Personen' },

  // ── Status ───────────────────────────────────────────────────────
  { name: 'check-circle', label: 'Erledigt', category: 'Status' },
  { name: 'circle-alert', label: 'Warnung', category: 'Status' },
  { name: 'info', label: 'Info', category: 'Status' },
  { name: 'shield', label: 'Schutz', category: 'Status' },
  { name: 'lock', label: 'Gesperrt', category: 'Status' },
  { name: 'unlock', label: 'Entsperrt', category: 'Status' },
  { name: 'eye', label: 'Sichtbar', category: 'Status' },
  { name: 'eye-off', label: 'Versteckt', category: 'Status' },
  { name: 'thumbs-up', label: 'Daumen hoch', category: 'Status' },
  { name: 'thumbs-down', label: 'Daumen runter', category: 'Status' },

  // ── Medien ───────────────────────────────────────────────────────
  { name: 'image', label: 'Bild', category: 'Medien' },
  { name: 'camera', label: 'Kamera', category: 'Medien' },
  { name: 'film', label: 'Film', category: 'Medien' },
  { name: 'headphones', label: 'Kopfhörer', category: 'Medien' },
  { name: 'monitor', label: 'Bildschirm', category: 'Medien' },
  { name: 'smartphone', label: 'Smartphone', category: 'Medien' },
  { name: 'printer', label: 'Drucker', category: 'Medien' },
  { name: 'wifi', label: 'WLAN', category: 'Medien' },
  { name: 'download', label: 'Download', category: 'Medien' },
  { name: 'upload', label: 'Upload', category: 'Medien' },
  { name: 'link', label: 'Link', category: 'Medien' },
  { name: 'external-link', label: 'Externer Link', category: 'Medien' },
];

/** Quick lookup: icon name → entry */
export const ICON_MAP = new Map(ICON_REGISTRY.map((e) => [e.name, e]));

/** All unique icon names (for validation) */
export const ICON_NAMES = new Set(ICON_REGISTRY.map((e) => e.name));
