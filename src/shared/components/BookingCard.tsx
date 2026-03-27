/**
 * BookingCard — Einheitliche Buchungskarte für Lehrkräfte und Admins.
 *
 * Design: Abgerundete Karte mit farbigem Header (Datum + Uhrzeit + Uhr-Icon),
 * Body mit Besuchername + Termindauer, Footer mit Stornieren-Button.
 *
 * Akzentfarben pro Modul:
 *   elternsprechtag  → Petrol
 *   beratungslehrer  → Korall
 *   schulsozialarbeit → Gold
 */

import { Clock } from 'lucide-react';

export type BookingCardAccent = 'petrol' | 'coral' | 'gold' | 'default';

interface BookingCardProps {
  date: string;
  time: string;
  durationMinutes?: number;
  visitorName: string;
  visitorLabel?: string;
  studentInfo?: string;
  status: string;
  accent?: BookingCardAccent;
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
}

/**
 * Robustes Datum-Parsing: akzeptiert ISO (2026-03-15), ISO mit Zeitzone
 * (2026-03-15T00:00:00.000Z), DD.MM.YYYY, oder Postgres-Date-Strings.
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '--';

  // Nur den Datumsteil extrahieren (vor T oder Leerzeichen)
  const cleaned = dateStr.split('T')[0].split(' ')[0].trim();

  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    // ISO: YYYY-MM-DD
    const [y, m, day] = cleaned.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(cleaned)) {
    // DE: DD.MM.YYYY
    const [day, m, y] = cleaned.split('.').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    return dateStr;
  }

  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(timeStr: string): string {
  return timeStr?.toString().slice(0, 5) || '';
}

function statusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'Bestätigt';
    case 'reserved': return 'Reserviert';
    case 'requested': return 'Angefragt';
    case 'cancelled': return 'Storniert';
    default: return status;
  }
}

export function BookingCard({
  date,
  time,
  durationMinutes = 30,
  visitorName,
  visitorLabel,
  studentInfo,
  status,
  accent = 'default',
  onCancel,
  onConfirm,
  cancelLabel = 'Stornieren',
  confirmLabel = 'Bestätigen',
}: BookingCardProps) {
  const isConfirmed = status === 'confirmed';
  const isPending = status === 'requested' || status === 'reserved';

  return (
    <article className={`booking-card booking-card--${accent} ${isConfirmed ? 'booking-card--confirmed' : ''} ${isPending ? 'booking-card--pending' : ''}`}>
      <div className="booking-card__header">
        <Clock className="booking-card__clock" size={16} aria-hidden="true" />
        <span className="booking-card__datetime">
          {formatDate(date)} | {formatTime(time)} Uhr
        </span>
        <span className={`booking-card__status booking-card__status--${status}`}>
          {statusLabel(status)}
        </span>
      </div>

      <div className="booking-card__body">
        <div className="booking-card__visitor">
          {visitorLabel && <span className="booking-card__visitor-label">{visitorLabel}</span>}
          <span className="booking-card__visitor-name">{visitorName || '--'}</span>
        </div>
        {studentInfo && (
          <div className="booking-card__student">{studentInfo}</div>
        )}
        <div className="booking-card__duration">{durationMinutes} Minuten</div>
      </div>

      {(onCancel || onConfirm) && (
        <div className="booking-card__footer">
          {onConfirm && isPending && (
            <button type="button" className="booking-card__btn booking-card__btn--confirm" onClick={onConfirm}>
              {confirmLabel}
            </button>
          )}
          {onCancel && (
            <button type="button" className="booking-card__btn booking-card__btn--cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
