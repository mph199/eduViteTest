import { useEffect, useMemo, useRef, useState } from 'react';
import { MoreVertical, MessageSquare } from 'lucide-react';
import api from '../../../../services/api';
import type { TimeSlot } from '../../../../types';
import { parseDateValue, parseStartMinutes, visitorLabel } from '../../../../utils/bookingSort';
import { useCalendarSubscription } from '../../components/useCalendarSubscription';
import { CalendarSetupBanner, CalendarSyncLink } from '../../components/CalendarSetupBanner';
import { CalendarStatusFooter } from '../../components/CalendarStatusFooter';
import { BookingCard } from '../../../../shared/components/BookingCard';
import { statusLabel } from '../../../../shared/utils/statusLabel';
import '../../components/CalendarSubscription.css';
import '../../../../shared/components/BookingCard.css';
import './TeacherBookings.css';


type SortKey = 'when' | 'visitor';
type SortDir = 'asc' | 'desc';

// ── Datumsgruppierung ──────────────────────────────────────────────

interface DateGroup {
  dateKey: string;        // ISO: YYYY-MM-DD (für Sortierung + Vergleich)
  label: string;          // "Montag, 30. März 2026"
  isToday: boolean;
  isPast: boolean;
  bookings: TimeSlot[];
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

/** Extrahiert den YYYY-MM-DD-Teil aus einem Datums-String (ISO oder DE-Format). */
function extractDateKey(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.split('T')[0].split(' ')[0].trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(cleaned)) {
    const [dd, mm, yyyy] = cleaned.split('.');
    return `${yyyy}-${mm}-${dd}`;
  }
  return cleaned;
}

function buildDateGroups(bookings: TimeSlot[]): DateGroup[] {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const groupMap = new Map<string, TimeSlot[]>();

  for (const b of bookings) {
    const key = extractDateKey(b.date);
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(b);
  }

  const groups: DateGroup[] = [];
  for (const [dateKey, items] of groupMap) {
    // Innerhalb der Gruppe nach Uhrzeit sortieren
    items.sort((a, b) => {
      const aMin = parseStartMinutes(a.time) ?? 0;
      const bMin = parseStartMinutes(b.time) ?? 0;
      return aMin - bMin || a.id - b.id;
    });

    const [y, m, d] = dateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const label = isNaN(dateObj.getTime()) ? dateKey : dateFormatter.format(dateObj);
    const isPast = dateKey < todayKey;

    groups.push({ dateKey, label, isToday: dateKey === todayKey, isPast, bookings: items });
  }

  // Gruppen chronologisch sortieren (nächstes Datum zuerst)
  groups.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return groups;
}

// ── Hauptkomponente ────────────────────────────────────────────────

// ── Inline TableRow with three-dot menu ────────────────────────────

function TableRow({ booking, onConfirm, onCancel }: {
  booking: TimeSlot;
  onConfirm: (id: number) => void;
  onCancel: (b: TimeSlot) => void;
}) {
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
      <td style={{ textAlign: 'center' }}>
        {booking.message ? (
          <span title={booking.message || ''}>
            <MessageSquare size={14} className="teacher-message-icon" aria-label="Nachricht vorhanden" />
          </span>
        ) : null}
      </td>
      <td>
        <div className="booking-card__menu" ref={menuRef} style={{ position: 'relative' }}>
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

// ── Main ───────────────────────────────────────────────────────────

export function TeacherBookings() {
  const [bookings, setBookings] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string>('');
  const [sort, setSort] = useState<{ key: SortKey | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const calSub = useCalendarSubscription();

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.teacher.getBookings();
      setBookings(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Buchungen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const sorted = useMemo(() => {
    if (!sort.key) return bookings;

    const dir = sort.dir === 'asc' ? 1 : -1;
    const copy = [...bookings];
    copy.sort((a, b) => {
      if (sort.key === 'visitor') {
        const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
        return collator.compare(visitorLabel(a), visitorLabel(b)) * dir;
      }

      const aDate = parseDateValue(a.date);
      const bDate = parseDateValue(b.date);
      if (aDate != null && bDate != null && aDate !== bDate) return (aDate - bDate) * dir;

      const aTime = parseStartMinutes(a.time);
      const bTime = parseStartMinutes(b.time);
      if (aTime != null && bTime != null && aTime !== bTime) return (aTime - bTime) * dir;

      return (a.id - b.id) * dir;
    });
    return copy;
  }, [bookings, sort.dir, sort.key]);

  // Gruppierung — nur für Kartenansicht ohne manuelle Sortierung
  const dateGroups = useMemo(() => buildDateGroups(
    sort.key ? sorted : bookings
  ), [bookings, sorted, sort.key]);

  const clearSort = () => {
    setSort({ key: null, dir: 'asc' });
  };

  const handleCancelBooking = async (booking: TimeSlot) => {
    const slotId = booking.id;
    setError('');
    setNotice('');

    const reason = prompt(
      'Bitte geben Sie einen Grund für die Stornierung ein.\nDiese Nachricht wird dem/der Buchenden per E-Mail mitgeteilt.'
    );
    if (!reason || !reason.trim()) {
      setNotice('Stornierung abgebrochen – ein Grund ist erforderlich.');
      return;
    }

    try {
      await api.teacher.cancelBooking(slotId, reason.trim());
      await loadBookings();
      setNotice('Buchung erfolgreich storniert');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Stornieren');
    }
  };

  const handleAcceptBooking = async (slotId: number) => {
    setError('');
    setNotice('');
    try {
      await api.teacher.acceptBooking(slotId);
      await loadBookings();
      setNotice('Buchung bestätigt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Bestätigen');
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
        <p>Laden...</p>
      </div>
    );
  }

  const renderCard = (booking: TimeSlot) => (
    <BookingCard
      key={booking.id}
      date={booking.date}
      time={booking.time}
      durationMinutes={15}
      visitorName={visitorLabel(booking) || '--'}
      studentInfo={`${booking.visitorType === 'parent' ? booking.studentName : booking.traineeName} | Klasse: ${booking.className || '--'}`}
      status={booking.status || 'confirmed'}
      accent="petrol"
      onConfirm={booking.status === 'reserved' && booking.verifiedAt ? () => handleAcceptBooking(booking.id) : undefined}
      onCancel={() => handleCancelBooking(booking)}
    />
  );

  return (
    <>
      {(error || notice) && (
        <div className={`${error ? 'admin-error' : 'admin-success'} teacher-bookings-notice`}>
          {error || notice}
          <button
            onClick={() => {
              setError('');
              setNotice('');
            }}
            className="back-button"
          >
            Schließen
          </button>
        </div>
      )}

      <CalendarSetupBanner sub={calSub} />

      <section className="stat-card teacher-table-section teacher-bookings-section">
        <div className="teacher-bookings-toolbar">
          <div className="teacher-bookings-title">
            <h3>Meine Buchungen</h3>
            <CalendarSyncLink sub={calSub} />
            <span className="teacher-bookings-count">
              {bookings.length} gebuchte {bookings.length === 1 ? 'Termin' : 'Termine'}
            </span>
          </div>
          <div className="teacher-bookings-actions">
            <button
              type="button"
              className={`btn-secondary btn-secondary--sm${viewMode === 'cards' ? ' btn-secondary--active' : ''}`}
              onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
            >
              {viewMode === 'cards' ? 'Tabellenansicht' : 'Kartenansicht'}
            </button>
            {sort.key && viewMode === 'table' && (
              <button type="button" className="btn-secondary btn-secondary--sm" onClick={clearSort}>
                Sortierung zurücksetzen
              </button>
            )}
            <button type="button" className="btn-secondary btn-secondary--sm" onClick={loadBookings}>
              Aktualisieren
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="no-bookings">
            <p>Noch keine Buchungen vorhanden.</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="date-groups">
            {dateGroups.map((group) => (
              <div key={group.dateKey} className={`date-group${group.isPast ? ' date-group--past' : ''}`}>
                <div className="date-group__header">
                  <h4 className="date-group__label">
                    {group.label}
                    {group.isToday && <span className="date-group__badge date-group__badge--today">Heute</span>}
                  </h4>
                  <span className="date-group__count">
                    {group.bookings.length} {group.bookings.length === 1 ? 'Termin' : 'Termine'}
                  </span>
                </div>
                <div className="booking-card-grid">
                  {group.bookings.map(renderCard)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="date-groups">
            {dateGroups.map((group) => (
              <div key={group.dateKey} className={`date-group${group.isPast ? ' date-group--past' : ''}`}>
                <div className="date-group__header">
                  <h4 className="date-group__label">
                    {group.label}
                    {group.isToday && <span className="date-group__badge date-group__badge--today">Heute</span>}
                  </h4>
                  <span className="date-group__count">
                    {group.bookings.length} {group.bookings.length === 1 ? 'Termin' : 'Termine'}
                  </span>
                </div>
                <div className="bookings-table-container teacher-bookings-table-container">
                  <table className="bookings-table teacher-bookings-table">
                    <thead>
                      <tr>
                        <th>Uhrzeit</th>
                        <th>Besuchende</th>
                        <th>Schüler*in/Azubi</th>
                        <th style={{ width: 40, textAlign: 'center' }} title="Nachricht"><MessageSquare size={14} aria-label="Nachricht" /></th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.bookings.map((booking) => (
                        <TableRow
                          key={booking.id}
                          booking={booking}
                          onConfirm={handleAcceptBooking}
                          onCancel={handleCancelBooking}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <CalendarStatusFooter sub={calSub} />
    </>
  );
}
