/**
 * BookingTableRow — Kompakte Buchungszeile mit aufklappbarem Detail-Panel.
 *
 * Zeigt Zeitslot, Besuchername, Besuchertyp-Chip, Schüler/Azubi+Klasse,
 * Nachricht-Indikator und Drei-Punkte-Menü. Responsive: auf Mobile
 * werden Chip und Schüler-Info ins Detail-Panel verschoben.
 */

import { useRef, useState } from 'react';
import { MoreVertical, MessageSquare, ChevronDown, X } from 'lucide-react';
import { PopoverMenu } from '../../../shared/components/PopoverMenu';
import type { TimeSlot } from '../../../types';
import { visitorLabel } from '../../../utils/bookingSort';

interface BookingTableRowProps {
  booking: TimeSlot;
  onConfirm: (id: number) => void;
  onCancel: (b: TimeSlot) => void;
}

const VISITOR_TYPE_LABELS: Record<string, string> = {
  parent: 'Erziehungsberechtigte/r',
  company: 'Ausbildungsbetrieb',
};

export function BookingTableRow({ booking, onConfirm, onCancel }: BookingTableRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const isPending = booking.status === 'reserved';

  const time = booking.time?.toString().slice(0, 5) || '--:--';
  const visitor = visitorLabel(booking) || '--';
  const student = booking.visitorType === 'parent' ? booking.studentName : booking.traineeName;
  const studentInfo = student
    ? `${student}${booking.className ? ` (${booking.className})` : ''}`
    : '';
  const visitorTypeLabel = VISITOR_TYPE_LABELS[booking.visitorType || ''] || '';

  return (
    <div className="bkr-wrapper">
      <div className="bkr-row" onClick={() => setDetailOpen(!detailOpen)}>
        {/* Time */}
        <span className="bkr-time">{time}</span>

        {/* Visitor name */}
        <span className="bkr-visitor">{visitor}</span>

        {/* Visitor type chip (hidden on mobile) */}
        {visitorTypeLabel && (
          <span className="bkr-type-chip">{visitorTypeLabel}</span>
        )}

        {/* Student + class (hidden on mobile) */}
        {studentInfo && (
          <span className="bkr-student">{studentInfo}</span>
        )}

        {/* Message indicator */}
        {booking.message && (
          <span className="bkr-msg-icon" title="Nachricht vorhanden">
            <MessageSquare size={14} />
          </span>
        )}

        {/* Three-dot menu */}
        <div className="bkr-menu">
          <button
            ref={menuTriggerRef}
            className="um-menu-trigger"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            aria-label="Aktionen"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <PopoverMenu triggerRef={menuTriggerRef} onClose={() => setMenuOpen(false)}>
              <button className="um-context-menu__item" onClick={(e) => { e.stopPropagation(); setDetailOpen(!detailOpen); setMenuOpen(false); }}>
                <ChevronDown size={15} style={{ transform: detailOpen ? 'rotate(180deg)' : undefined }} />
                {detailOpen ? 'Details ausblenden' : 'Details anzeigen'}
              </button>
              {booking.message && (
                <button className="um-context-menu__item" onClick={(e) => { e.stopPropagation(); setDetailOpen(true); setMenuOpen(false); }}>
                  <MessageSquare size={15} />
                  Nachricht lesen
                </button>
              )}
              {isPending && booking.verifiedAt && (
                <button className="um-context-menu__item" onClick={(e) => { e.stopPropagation(); onConfirm(booking.id); setMenuOpen(false); }}>
                  Bestätigen
                </button>
              )}
              <div className="um-context-menu__divider" />
              <button className="um-context-menu__item um-context-menu__item--danger" onClick={(e) => { e.stopPropagation(); onCancel(booking); setMenuOpen(false); }}>
                <X size={15} />
                Stornieren
              </button>
            </PopoverMenu>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className={`um-detail-panel${detailOpen ? ' um-detail-panel--open' : ''}`}>
        <div className="um-detail-panel__inner">
          <div className="bkr-detail">
            <div className="bkr-detail__grid">
              <div className="um-detail-item">
                <span className="um-detail-label">Besucher/in</span>
                <span className="um-detail-value">{visitor}</span>
              </div>
              <div className="um-detail-item">
                <span className="um-detail-label">E-Mail</span>
                <span className="um-detail-value">
                  {booking.email ? <a href={`mailto:${booking.email}`}>{booking.email}</a> : '--'}
                </span>
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
                <div className="um-detail-item bkr-detail__full">
                  <span className="um-detail-label">Nachricht</span>
                  <span className="um-detail-value">{booking.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
