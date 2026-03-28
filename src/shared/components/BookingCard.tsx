/**
 * BookingCard — Einheitliche Buchungskarte für Lehrkräfte und Admins.
 *
 * Design: Farbiger Header (Uhrzeit + Status), Body mit Name + Infos,
 * Drei-Punkte-Menü für Aktionen.
 *
 * Akzentfarben pro Modul:
 *   elternsprechtag  → Petrol
 *   beratungslehrer  → Korall
 *   schulsozialarbeit → Gold
 */

import { useState, useRef, useEffect } from 'react';
import { Clock, MoreVertical } from 'lucide-react';

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
  time,
  durationMinutes = 30,
  visitorName,
  studentInfo,
  status,
  accent = 'default',
  onCancel,
  onConfirm,
  cancelLabel = 'Stornieren',
  confirmLabel = 'Bestätigen',
}: BookingCardProps) {
  const isPending = status === 'requested' || status === 'reserved';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const hasActions = onCancel || onConfirm;

  return (
    <article className={`booking-card booking-card--${accent}`}>
      {/* Header: Uhrzeit + Dauer + Status (kein Datum — kommt aus der Gruppenüberschrift) */}
      <div className="booking-card__header">
        <Clock className="booking-card__clock" size={16} aria-hidden="true" />
        <span className="booking-card__datetime">
          {formatTime(time)} Uhr · {durationMinutes} min
        </span>
        <span className={`booking-card__status booking-card__status--${status}`}>
          {statusLabel(status)}
        </span>
      </div>

      {/* Body: Name + Info */}
      <div className="booking-card__body">
        <div className="booking-card__body-main">
          <span className="booking-card__visitor-name">{visitorName || '--'}</span>
          {studentInfo && <span className="booking-card__student">{studentInfo}</span>}
        </div>

        {/* Drei-Punkte-Menü */}
        {hasActions && (
          <div className="booking-card__menu" ref={menuRef}>
            <button
              type="button"
              className="booking-card__menu-trigger"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Aktionen"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="booking-card__menu-dropdown">
                {onConfirm && isPending && (
                  <button
                    type="button"
                    className="booking-card__menu-item"
                    onClick={() => { onConfirm(); setMenuOpen(false); }}
                  >
                    {confirmLabel}
                  </button>
                )}
                {onCancel && (
                  <button
                    type="button"
                    className="booking-card__menu-item booking-card__menu-item--danger"
                    onClick={() => { onCancel(); setMenuOpen(false); }}
                  >
                    {cancelLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
