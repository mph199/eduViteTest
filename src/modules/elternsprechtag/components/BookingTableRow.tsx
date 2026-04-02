import { useEffect, useRef, useState } from 'react';
import { MoreVertical, MessageSquare } from 'lucide-react';
import type { TimeSlot } from '../../../../types';
import { visitorLabel } from '../../../../utils/bookingSort';
import { statusLabel } from '../../../../shared/utils/statusLabel';

interface BookingTableRowProps {
  booking: TimeSlot;
  onConfirm: (id: number) => void;
  onCancel: (b: TimeSlot) => void;
}

export function BookingTableRow({ booking, onConfirm, onCancel }: BookingTableRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isPending = booking.status === 'reserved';

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <tr>
      <td data-label="Uhrzeit" className="teacher-when-cell">
        <span className="teacher-when-time">{booking.time?.toString().slice(0, 5)}</span>
        <span className={`teacher-status-pill teacher-status-pill--${booking.status || 'confirmed'}`}>
          {statusLabel(booking.status || 'confirmed')}
        </span>
      </td>
      <td data-label="Besuchende" className="teacher-visitor-cell">
        <div className="teacher-visitor-name" title={visitorLabel(booking)}>
          {visitorLabel(booking) || '--'}
        </div>
        {booking.email && (
          <div className="teacher-visitor-meta teacher-visitor-meta--email" title={booking.email}>
            <a href={`mailto:${booking.email}`}>{booking.email}</a>
          </div>
        )}
      </td>
      <td data-label="Schüler*in/Azubi" className="teacher-student-cell">
        <div className="teacher-student-name">
          {booking.visitorType === 'parent' ? booking.studentName : booking.traineeName}
        </div>
        <div className="teacher-student-meta">Klasse: {booking.className || '--'}</div>
      </td>
      <td className="teacher-col-msg">
        {booking.message ? (
          <span title={booking.message || ''}>
            <MessageSquare size={14} className="teacher-message-icon" aria-label="Nachricht vorhanden" />
          </span>
        ) : null}
      </td>
      <td className="teacher-col-actions">
        <div className="booking-card__menu" ref={menuRef}>
          <button
            type="button"
            className="booking-card__menu-trigger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Aktionen"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div className="booking-card__menu-dropdown">
              {isPending && booking.verifiedAt && (
                <button type="button" className="booking-card__menu-item" onClick={() => { onConfirm(booking.id); setMenuOpen(false); }}>
                  Bestätigen
                </button>
              )}
              <button type="button" className="booking-card__menu-item booking-card__menu-item--danger" onClick={() => { onCancel(booking); setMenuOpen(false); }}>
                Stornieren
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
