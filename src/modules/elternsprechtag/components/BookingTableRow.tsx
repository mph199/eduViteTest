import { useEffect, useRef, useState } from 'react';
import { MoreVertical, MessageSquare, ChevronDown } from 'lucide-react';
import type { TimeSlot } from '../../../types';
import { visitorLabel } from '../../../utils/bookingSort';
import { statusLabel } from '../../../shared/utils/statusLabel';

interface BookingTableRowProps {
  booking: TimeSlot;
  onConfirm: (id: number) => void;
  onCancel: (b: TimeSlot) => void;
}

export function BookingTableRow({ booking, onConfirm, onCancel }: BookingTableRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
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

  const time = booking.time?.toString().slice(0, 5) || '--:--';
  const visitor = visitorLabel(booking) || '--';
  const student = booking.visitorType === 'parent' ? booking.studentName : booking.traineeName;
  const status = booking.status || 'confirmed';

  return (
    <div className="um-row-wrapper">
      <div className="um-row" onClick={() => setDetailOpen(!detailOpen)}>
        {/* Time block as avatar replacement */}
        <div className="tb-time-block">
          <span className="tb-time-block__time">{time}</span>
        </div>

        <div className="um-info">
          <div className="um-name">
            {visitor}
            {booking.message && (
              <span title={booking.message || ''}><MessageSquare size={13} className="tb-message-icon" /></span>
            )}
          </div>
          <span className="um-email">
            {student && <>{student}</>}
            {booking.className && <> | Klasse: {booking.className}</>}
          </span>
        </div>

        <span className={`um-role-chip tb-status-chip tb-status-chip--${status}`}>
          {statusLabel(status)}
        </span>

        <ChevronDown
          size={16}
          className={`tb-chevron${detailOpen ? ' tb-chevron--open' : ''}`}
        />

        {/* Three-dot menu */}
        <div className="um-menu-anchor" ref={menuRef}>
          <button
            className="um-menu-trigger"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            aria-label="Aktionen"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div className="um-context-menu">
              <button className="um-context-menu__item" onClick={(e) => { e.stopPropagation(); setDetailOpen(!detailOpen); setMenuOpen(false); }}>
                Details
              </button>
              {isPending && booking.verifiedAt && (
                <button className="um-context-menu__item" onClick={(e) => { e.stopPropagation(); onConfirm(booking.id); setMenuOpen(false); }}>
                  Bestätigen
                </button>
              )}
              <div className="um-context-menu__divider" />
              <button className="um-context-menu__item um-context-menu__item--danger" onClick={(e) => { e.stopPropagation(); onCancel(booking); setMenuOpen(false); }}>
                Stornieren
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expandable detail panel */}
      <div className={`um-detail-panel${detailOpen ? ' um-detail-panel--open' : ''}`}>
        <div className="um-detail-panel__inner">
          <div className="um-detail-grid">
            <div className="um-detail-item">
              <span className="um-detail-label">E-Mail</span>
              <span className="um-detail-value">
                {booking.email ? <a href={`mailto:${booking.email}`}>{booking.email}</a> : '--'}
              </span>
            </div>
            <div className="um-detail-item">
              <span className="um-detail-label">Status</span>
              <span className="um-detail-value">{statusLabel(status)}</span>
            </div>
            {student && (
              <div className="um-detail-item">
                <span className="um-detail-label">{booking.visitorType === 'parent' ? 'Schüler/in' : 'Azubi'}</span>
                <span className="um-detail-value">{student}</span>
              </div>
            )}
            {booking.className && (
              <div className="um-detail-item">
                <span className="um-detail-label">Klasse</span>
                <span className="um-detail-value">{booking.className}</span>
              </div>
            )}
            {booking.message && (
              <div className="um-detail-item" style={{ gridColumn: '1 / -1' }}>
                <span className="um-detail-label">Nachricht</span>
                <span className="um-detail-value">{booking.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
