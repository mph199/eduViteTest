/**
 * BookingCard — Einheitliche Buchungskarte für Lehrkräfte und Admins.
 *
 * Design: Abgerundete Karte mit farbigem Header (Datum + Uhrzeit + Uhr-Icon),
 * Body mit Besuchername + Termindauer, Footer mit Stornieren-Button.
 */

import { Clock } from 'lucide-react';

interface BookingCardProps {
  date: string;
  time: string;
  durationMinutes?: number;
  visitorName: string;
  visitorLabel?: string;
  studentInfo?: string;
  status: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
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
  onCancel,
  onConfirm,
  cancelLabel = 'Stornieren',
  confirmLabel = 'Bestätigen',
}: BookingCardProps) {
  const isConfirmed = status === 'confirmed';
  const isPending = status === 'requested' || status === 'reserved';

  return (
    <article className={`booking-card ${isConfirmed ? 'booking-card--confirmed' : ''} ${isPending ? 'booking-card--pending' : ''}`}>
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
