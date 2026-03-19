import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/useAuth';
import { useActiveView } from '../hooks/useActiveView';
import { useBgStyle } from '../hooks/useBgStyle';
import api from '../services/api';
import type { TimeSlot as ApiBooking, AdminEvent, EventStats } from '../types';
import { exportBookingsToICal } from '../utils/icalExport';
import { formatDateTime } from '../utils/formatters';
import { parseDateValue, parseStartMinutes, visitorLabel } from '../utils/bookingSort';
import './AdminDashboard.css';

type SortKey = 'teacher' | 'when' | 'visitor';
type SortDir = 'asc' | 'desc';

export function AdminDashboard() {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeEvent, setActiveEvent] = useState<AdminEvent | null>(null);
  const [activeEventStats, setActiveEventStats] = useState<EventStats | null>(null);
  const [activeEventStatsError, setActiveEventStatsError] = useState<string>('');

  // Filter & sort state
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'parent' | 'company'>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ key: SortKey | null; dir: SortDir }>({ key: null, dir: 'asc' });
  const { user } = useAuth();
  const adminBgStyle = useBgStyle('admin', '--page-bg');
  useActiveView('admin');

  const statusLabel: Record<AdminEvent['status'], string> = {
    draft: 'Entwurf',
    published: 'Veröffentlicht',
    closed: 'Geschlossen',
  };

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Use appropriate endpoint per role
      const data = user?.role === 'teacher'
        ? await api.teacher.getBookings()
        : await api.admin.getBookings();
      setBookings(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Buchungen');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadActiveEvent = useCallback(async () => {
    try {
      const res = await api.events.getActive();
      const parsed = res as unknown as { event?: AdminEvent | null };
      setActiveEvent(parsed?.event || null);
    } catch {
      // Non-blocking: keep UI usable even if event endpoint fails
      setActiveEvent(null);
    }
  }, []);

  const loadActiveEventStats = useCallback(async (eventId: number) => {
    try {
      setActiveEventStatsError('');
      const res = await api.admin.getEventStats(eventId);
      setActiveEventStats(res as EventStats);
    } catch (e) {
      setActiveEventStats(null);
      setActiveEventStatsError(e instanceof Error ? e.message : 'Fehler beim Laden der Slot-Statistik');
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    loadActiveEvent();
  }, [loadActiveEvent]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setActiveEventStats(null);
      setActiveEventStatsError('');
      return;
    }
    if (!activeEvent?.id) {
      setActiveEventStats(null);
      setActiveEventStatsError('');
      return;
    }
    loadActiveEventStats(activeEvent.id);
  }, [activeEvent?.id, loadActiveEventStats, user?.role]);

  // Unique teacher names for dropdown
  const teacherNames = useMemo(() => {
    const names = new Set<string>();
    for (const b of bookings) {
      if (b.teacherName) names.add(b.teacherName);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'de'));
  }, [bookings]);

  // Filter logic
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (typeFilter !== 'all' && b.visitorType !== typeFilter) return false;
      if (teacherFilter !== 'all' && b.teacherName !== teacherFilter) return false;
      if (!q) return true;
      const hay = [
        b.teacherName,
        b.teacherSubject,
        visitorLabel(b),
        b.representativeName,
        b.studentName,
        b.traineeName,
        b.className,
        b.email,
        b.time,
        b.date,
        b.message,
        b.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [bookings, query, typeFilter, teacherFilter]);

  // Sort logic
  const filteredAndSorted = useMemo(() => {
    if (!sort.key) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const copy = [...filtered];
    const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
    copy.sort((a, b) => {
      if (sort.key === 'teacher') {
        return collator.compare(a.teacherName || '', b.teacherName || '') * dir;
      }
      if (sort.key === 'visitor') {
        return collator.compare(visitorLabel(a), visitorLabel(b)) * dir;
      }
      // 'when'
      const aDate = parseDateValue(a.date);
      const bDate = parseDateValue(b.date);
      if (aDate != null && bDate != null && aDate !== bDate) return (aDate - bDate) * dir;
      const aTime = parseStartMinutes(a.time);
      const bTime = parseStartMinutes(b.time);
      if (aTime != null && bTime != null && aTime !== bTime) return (aTime - bTime) * dir;
      return (a.id - b.id) * dir;
    });
    return copy;
  }, [filtered, sort.key, sort.dir]);

  const cycleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: 'asc' };
    });
  };

  const clearFilters = () => {
    setQuery('');
    setTypeFilter('all');
    setTeacherFilter('all');
    setSort({ key: null, dir: 'asc' });
  };

  const hasActiveFilters = query !== '' || typeFilter !== 'all' || teacherFilter !== 'all' || sort.key !== null;

  const handleCancelBooking = async (slotId: number) => {
    const reason = prompt(
      'Bitte geben Sie einen Grund für die Stornierung ein.\nDiese Nachricht wird dem/der Buchenden per E-Mail mitgeteilt.'
    );
    if (!reason || !reason.trim()) {
      return;
    }

    try {
      await api.admin.cancelBooking(slotId, reason.trim());
      await loadBookings(); // Reload bookings after cancellation
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Stornieren');
    }
  };

  const handleExportAll = async () => {
    if (!bookings.length) return;

    // Add rooms to LOCATION when possible (Admin has access to teachers with rooms).
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      try {
        const teachers = await api.admin.getTeachers();
        const teacherRoomById: Record<number, string | undefined> = {};
        for (const t of teachers || []) {
          if (t?.id) teacherRoomById[Number(t.id)] = t.room;
        }
        exportBookingsToICal(bookings, undefined, { teacherRoomById });
        return;
      } catch {
        // Fallback: export without rooms
      }
    }

    exportBookingsToICal(bookings);
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Laden...</p>
      </div>
    );
  }

  return (
    <div
      className="admin-dashboard admin-dashboard--admin page-bg-overlay page-bg-overlay--subtle"
      style={adminBgStyle}
    >
      <main className="admin-main">
        <div className="teacher-form-container">
          <div className="admin-section-header">
            <h3>Aktive Events</h3>
          </div>
          {activeEvent ? (
            <div className="admin-resp-table-container active-events-table">
              <table className="admin-resp-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Schuljahr</th>
                    <th>Buchungsfenster</th>
                    <th>Status</th>
                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                      <th>Sprechzeiten</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td data-label="Name">
                      <span className="admin-cell-main">{activeEvent.name}</span>
                    </td>
                    <td data-label="Schuljahr">{activeEvent.school_year}</td>
                    <td data-label="Buchungsfenster">
                      <span className="admin-cell-main">{formatDateTime(activeEvent.booking_opens_at) || 'sofort'}</span>
                      <span className="admin-cell-meta"> – {formatDateTime(activeEvent.booking_closes_at) || 'offen'}</span>
                    </td>
                    <td data-label="Status">
                      <span className={`admin-status-pill admin-status-pill--${activeEvent.status === 'published' ? 'success' : activeEvent.status === 'draft' ? 'warning' : 'neutral'}`}>
                        {statusLabel[activeEvent.status]}
                      </span>
                    </td>
                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                      <td data-label="Sprechzeiten">
                        {activeEventStats ? (
                          <>
                            <span className="admin-cell-main">{activeEventStats.totalSlots} gesamt</span>
                            <span className="admin-cell-meta">
                              {activeEventStats.availableSlots} frei / {activeEventStats.reservedSlots} reserviert / {activeEventStats.confirmedSlots} bestaetigt
                            </span>
                          </>
                        ) : activeEventStatsError ? (
                          <span className="admin-cell-meta">{activeEventStatsError}</span>
                        ) : (
                          <span className="admin-cell-meta">Laden...</span>
                        )}
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-secondary">
              Kein aktives Event gefunden (nicht veroeffentlicht oder ausserhalb des Buchungsfensters).
            </div>
          )}
        </div>

        {error && (
          <div className="admin-error">
            {error}
          </div>
        )}

        <div className="teacher-form-container">
          <div className="admin-section-header">
            <h3>Buchungen des Kollegiums</h3>
            <div className="tooltip-container">
              <button
                onClick={handleExportAll}
                className="btn-primary"
                disabled={bookings.length === 0}
              >
                Alle Termine als Kalenderdatei exportieren
              </button>
              <span className="tooltip">
                {bookings.length === 0
                  ? 'Keine Buchungen zum Exportieren'
                  : 'Exportiert alle Termine als .ics Kalenderdatei'}
              </span>
            </div>
          </div>

          {bookings.length > 0 && (
            <div className="admin-stats" style={{ gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div className="stat-card" style={{ flex: '1 1 100%', minWidth: 0, padding: '1rem 1.1rem' }}>
                <h3 style={{ marginBottom: 8 }}>Filter &amp; Sortierung</h3>
                <div className="admin-filter-bar">
                  <input
                    type="text"
                    className="admin-filter-input"
                    placeholder="Suche (Name, Klasse, E-Mail, Nachricht…)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    className="admin-filter-select"
                    value={teacherFilter}
                    onChange={(e) => setTeacherFilter(e.target.value)}
                  >
                    <option value="all">Alle Lehrkräfte</option>
                    {teacherNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <select
                    className="admin-filter-select"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as 'all' | 'parent' | 'company')}
                  >
                    <option value="all">Alle Besuchertypen</option>
                    <option value="parent">Erziehungsberechtigte</option>
                    <option value="company">Ausbildungsbetrieb</option>
                  </select>
                  {hasActiveFilters && (
                    <button type="button" className="btn-secondary btn-secondary--sm" onClick={clearFilters}>
                      Filter zurücksetzen
                    </button>
                  )}
                </div>
                {hasActiveFilters && (
                  <div className="text-muted" style={{ marginTop: 6, fontSize: '0.85rem' }}>
                    {filteredAndSorted.length} von {bookings.length} Buchungen
                  </div>
                )}
              </div>
            </div>
          )}

          {bookings.length === 0 ? (
            <div className="no-bookings">
              <p>Keine Buchungen vorhanden.</p>
              <a href="/" className="back-to-booking">Zur Buchungsseite</a>
            </div>
          ) : (
            <div className="admin-resp-table-container">
              <table className="admin-resp-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="teacher-sort-button" onClick={() => cycleSort('teacher')} title="Nach Lehrkraft sortieren">
                      Lehrkraft {sort.key === 'teacher' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="teacher-sort-button" onClick={() => cycleSort('when')} title="Nach Termin sortieren">
                      Termin {sort.key === 'when' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="teacher-sort-button" onClick={() => cycleSort('visitor')} title="Nach Besuchenden sortieren">
                      Besuchende {sort.key === 'visitor' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th>Schüler*in / Azubi</th>
                  <th>Nachricht</th>
                  <th className="admin-actions-header">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Keine Buchungen für die gewählten Filter gefunden.
                    </td>
                  </tr>
                ) : filteredAndSorted.map((booking) => (
                  <tr key={booking.id}>
                    <td data-label="Lehrkraft">
                      <div className="admin-cell-main">{booking.teacherName}</div>
                      <div className="admin-cell-meta">{booking.teacherSubject}</div>
                    </td>
                    <td data-label="Termin">
                      <div className="admin-cell-main">{booking.date}</div>
                      <div className="admin-cell-meta">{booking.time}</div>
                    </td>
                    <td data-label="Besuchende">
                      <div className="admin-cell-main">
                        {booking.visitorType === 'parent' 
                          ? booking.parentName 
                          : booking.companyName}
                      </div>
                      <div className="admin-cell-meta">
                        {booking.visitorType === 'parent' ? 'Erziehungsberechtigte' : 'Ausbildungsbetrieb'}
                      </div>
                      {booking.visitorType === 'company' && booking.representativeName && (
                        <div className="admin-cell-meta" title={booking.representativeName}>
                          Vertreter*in: {booking.representativeName}
                        </div>
                      )}
                      {booking.email && (
                        <div className="admin-cell-meta" title={booking.email}>
                          <a href={`mailto:${booking.email}`}>{booking.email}</a>
                        </div>
                      )}
                    </td>
                    <td data-label="Schüler*in / Azubi">
                      <div className="admin-cell-main">
                        {booking.visitorType === 'parent' 
                          ? booking.studentName 
                          : booking.traineeName}
                      </div>
                      <div className="admin-cell-meta">Klasse: {booking.className || '—'}</div>
                    </td>
                    <td data-label="Nachricht" className="admin-message-cell">
                      <span className="admin-message-value" title={booking.message || ''}>
                        {booking.message || '—'}
                      </span>
                    </td>
                    <td data-label="Aktionen" className="admin-actions-cell">
                      <div className="action-buttons">
                        <button
                          onClick={() => handleCancelBooking(booking.id)}
                          className="cancel-button"
                        >
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
        </div>
      </main>
    </div>
  );
}
