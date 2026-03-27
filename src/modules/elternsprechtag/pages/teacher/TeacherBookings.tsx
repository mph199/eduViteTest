import { useEffect, useMemo, useState } from 'react';
import api from '../../../../services/api';
import type { TimeSlot } from '../../../../types';
import { parseDateValue, parseStartMinutes, visitorLabel } from '../../../../utils/bookingSort';
import { CalendarSubscription } from '../../components/CalendarSubscription';
import { BookingCard } from '../../../../shared/components/BookingCard';
import { statusLabel } from '../../../../shared/utils/statusLabel';
import '../../../../shared/components/BookingCard.css';
import './TeacherBookings.css';


type SortKey = 'when' | 'visitor';
type SortDir = 'asc' | 'desc';

export function TeacherBookings() {
  const [bookings, setBookings] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string>('');
  const [sort, setSort] = useState<{ key: SortKey | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

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

  const cycleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: 'asc' };
    });
  };

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

      <CalendarSubscription />

      <section className="stat-card teacher-table-section teacher-bookings-section">
        <div className="teacher-bookings-toolbar">
          <div className="teacher-bookings-title">
            <h3>Buchungen einsehen</h3>
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
          <div className="booking-card-grid">
            {sorted.map((booking) => (
              <BookingCard
                key={booking.id}
                date={booking.date}
                time={booking.time}
                durationMinutes={15}
                visitorName={visitorLabel(booking) || '--'}
                visitorLabel={booking.visitorType === 'company' ? 'Ausbildungsbetrieb' : 'Erziehungsberechtigte/r'}
                studentInfo={`${booking.visitorType === 'parent' ? booking.studentName : booking.traineeName} | Klasse: ${booking.className || '--'}`}
                status={booking.status || 'confirmed'}
                onConfirm={booking.status === 'reserved' && booking.verifiedAt ? () => handleAcceptBooking(booking.id) : undefined}
                onCancel={() => handleCancelBooking(booking)}
              />
            ))}
          </div>
        ) : (
          <div className="bookings-table-container teacher-bookings-table-container teacher-my-bookings-table-container">
            <table className="bookings-table teacher-bookings-table teacher-my-bookings-table">
              <thead>
                <tr>
                  <th
                    aria-sort={sort.key === 'when' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      className="teacher-sort-button"
                      onClick={() => cycleSort('when')}
                      aria-label="Nach Termin sortieren"
                    >
                      Termin
                      {sort.key === 'when' ? (
                        <span className="teacher-sort-indicator" aria-hidden="true">
                          {sort.dir === 'asc' ? '▲' : '▼'}
                        </span>
                      ) : (
                        <span className="teacher-sort-indicator teacher-sort-indicator--idle" aria-hidden="true">
                          ↕
                        </span>
                      )}
                    </button>
                  </th>
                  <th
                    aria-sort={sort.key === 'visitor' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      className="teacher-sort-button"
                      onClick={() => cycleSort('visitor')}
                      aria-label="Nach Besuchenden sortieren"
                    >
                      Besuchende
                      {sort.key === 'visitor' ? (
                        <span className="teacher-sort-indicator" aria-hidden="true">
                          {sort.dir === 'asc' ? '▲' : '▼'}
                        </span>
                      ) : (
                        <span className="teacher-sort-indicator teacher-sort-indicator--idle" aria-hidden="true">
                          ↕
                        </span>
                      )}
                    </button>
                  </th>
                  <th>Schüler*in/Azubi</th>
                  <th>Nachricht</th>
                  <th className="teacher-actions-header">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((booking) => (
                  <tr key={booking.id}>
                    <td data-label="Termin" className="teacher-when-cell">
                      <div className="teacher-when-main">
                        <span className="teacher-when-date">{booking.date}</span>
                        <span className="teacher-when-time">{booking.time}</span>
                      </div>
                      <div className="teacher-when-sub">
                        <span
                          className={
                            booking.status === 'confirmed'
                              ? 'teacher-status-pill teacher-status-pill--confirmed'
                              : 'teacher-status-pill teacher-status-pill--reserved'
                          }
                        >
                          {booking.status ? statusLabel(booking.status) : '—'}
                        </span>
                      </div>
                    </td>

                    <td data-label="Besuchende" className="teacher-visitor-cell">
                      <div className="teacher-visitor-name" title={visitorLabel(booking)}>
                        {visitorLabel(booking) || '—'}
                      </div>
                      {booking.visitorType === 'company' && booking.representativeName && (
                        <div className="teacher-visitor-meta" title={booking.representativeName}>
                          Vertreter*in: {booking.representativeName}
                        </div>
                      )}
                      {booking.email && (
                        <div className="teacher-visitor-meta teacher-visitor-meta--email" title={booking.email}>
                          <a href={`mailto:${booking.email}`} aria-label={`E-Mail an ${visitorLabel(booking) || 'Besuchende'} senden`}>
                            {booking.email}
                          </a>
                        </div>
                      )}
                    </td>

                    <td data-label="Schüler*in/Azubi" className="teacher-student-cell">
                      <div className="teacher-student-name" title={booking.visitorType === 'parent' ? booking.studentName : booking.traineeName}>
                        {booking.visitorType === 'parent' ? booking.studentName : booking.traineeName}
                      </div>
                      <div className="teacher-student-meta" title={booking.className}>
                        Klasse: {booking.className || '—'}
                      </div>
                    </td>

                    <td className="message-cell" data-label="Nachricht">
                      <span
                        className="teacher-message-value teacher-cell-truncate"
                        title={booking.message || ''}
                      >
                        {booking.message || '—'}
                      </span>
                    </td>

                    <td data-label="Aktionen" className="teacher-actions-cell">
                      <div className="action-buttons">
                        {booking.status === 'reserved' && (
                          <div className="tooltip-container">
                            <button
                              onClick={() => handleAcceptBooking(booking.id)}
                              className="btn-primary"
                              disabled={!booking.verifiedAt}
                            >
                              <span aria-hidden="true">✓</span> Bestätigen
                            </button>
                            {!booking.verifiedAt && (
                              <span className="tooltip">
                                Erst möglich, wenn die E-Mail-Adresse bestätigt wurde
                              </span>
                            )}
                          </div>
                        )}
                        <button onClick={() => handleCancelBooking(booking)} className="cancel-button">
                          <span aria-hidden="true">✕</span> Stornieren
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </>
  );
}
