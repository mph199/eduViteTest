/**
 * Translates appointment status codes to German display labels.
 */
export function statusLabel(s: string): string {
  switch (s) {
    case 'available': return 'Frei';
    case 'requested': return 'Angefragt';
    case 'confirmed': return 'Bestätigt';
    case 'cancelled': return 'Abgesagt';
    case 'completed': return 'Abgeschlossen';
    default: return s;
  }
}
