import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { useActiveView } from '../hooks/useActiveView';
import { useBgStyle } from '../hooks/useBgStyle';
import api from '../services/api';
import type { TimeSlot as ApiBooking, AdminEvent, EventStats } from '../types';
import { formatDateTime } from '../utils/formatters';
import { parseStartMinutes, visitorLabel } from '../utils/bookingSort';
import { BookingTableRow } from '../modules/elternsprechtag/components/BookingTableRow';
import '../shared/styles/um-components.css';
import './AdminDashboard.css';

// ── Types ─────────────────────────────────────────────────────────────

interface TeacherGroup {
  teacherName: string;
  bookings: ApiBooking[];
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

function getBookingWindowLabel(event: AdminEvent): string {
  if (!event.booking_opens_at) return 'Sofort offen';
  return `ab ${formatShortDate(event.booking_opens_at)}`;
}

const EVENT_STATUS_LABELS: Record<AdminEvent['status'], string> = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  closed: 'Geschlossen',
};

function groupByTeacher(bookings: ApiBooking[]): TeacherGroup[] {
  const map = new Map<string, ApiBooking[]>();
  for (const b of bookings) {
    const name = b.teacherName || 'Unbekannt';
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(b);
  }

  const groups: TeacherGroup[] = [];
  const sortedNames = [...map.keys()].sort((a, b) => a.localeCompare(b, 'de'));
  for (const name of sortedNames) {
    const items = map.get(name)!;
    items.sort((a, b) => {
      const aMin = parseStartMinutes(a.time) ?? 0;
      const bMin = parseStartMinutes(b.time) ?? 0;
      return aMin - bMin || a.id - b.id;
    });
    groups.push({ teacherName: name, bookings: items });
  }
  return groups;
}

// ── Main ──────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeEvent, setActiveEvent] = useState<AdminEvent | null>(null);
  const [activeEventStats, setActiveEventStats] = useState<EventStats | null>(null);
  const [activeEventStatsError, setActiveEventStatsError] = useState('');

  // Filter state
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  const { user } = useAuth();
  const adminBgStyle = useBgStyle('admin', '--page-bg');
  useActiveView('admin');

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
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

  useEffect(() => { loadBookings(); }, [loadBookings]);
  useEffect(() => { loadActiveEvent(); }, [loadActiveEvent]);
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

  // Unique teacher names
  const teacherNames = useMemo(() => {
    const names = new Set<string>();
    for (const b of bookings) {
      if (b.teacherName) names.add(b.teacherName);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'de'));
  }, [bookings]);

  // Filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (typeFilter && b.visitorType !== typeFilter) return false;
      if (teacherFilter && b.teacherName !== teacherFilter) return false;
      if (!q) return true;
      const hay = [
        b.teacherName, b.teacherSubject, visitorLabel(b),
        b.representativeName, b.studentName, b.traineeName,
        b.className, b.email, b.message,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [bookings, query, typeFilter, teacherFilter]);

  // Group by teacher
  const groups = useMemo(() => groupByTeacher(filtered), [filtered]);

  // Stats
  const stats = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const reserved = bookings.filter((b) => b.status === 'reserved').length;
    return { total, confirmed, reserved };
  }, [bookings]);

  const hasActiveFilters = query !== '' || typeFilter !== '' || teacherFilter !== '';

  const handleCancelBooking = async (booking: ApiBooking) => {
    const reason = prompt(
      'Bitte geben Sie einen Grund für die Stornierung ein.\nDiese Nachricht wird dem/der Buchenden per E-Mail mitgeteilt.'
    );
    if (!reason || !reason.trim()) return;
    try {
      await api.admin.cancelBooking(booking.id, reason.trim());
      await loadBookings();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Stornieren');
    }
  };

  const handleConfirmBooking = async (slotId: number) => {
    try {
      await api.teacher.acceptBooking(slotId);
      await loadBookings();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Bestätigen');
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
    <div
      className="admin-dashboard admin-dashboard--admin page-bg-overlay page-bg-overlay--subtle"
      style={adminBgStyle}
    >
      <div className="admin-main">
        {/* ── Active Events Section ─────────────────────────────── */}
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
                        {EVENT_STATUS_LABELS[activeEvent.status]}
                      </span>
                    </td>
                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                      <td data-label="Sprechzeiten">
                        {activeEventStats ? (
                          <>
                            <span className="admin-cell-main">{activeEventStats.totalSlots} gesamt</span>
                            <span className="admin-cell-meta">
                              {activeEventStats.availableSlots} frei / {activeEventStats.reservedSlots} reserviert / {activeEventStats.confirmedSlots} bestätigt
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
              Kein aktives Event gefunden (nicht veröffentlicht oder außerhalb des Buchungsfensters).
            </div>
          )}
        </div>

        {error && <div className="admin-error">{error}</div>}

        {/* ── Buchungen des Kollegiums ──────────────────────────── */}
        <div className="teacher-form-container" style={{ padding: '1.25rem' }}>
          {/* Header */}
          <div className="adb-header">
            <h3 className="adb-header__title">Buchungen des Kollegiums</h3>
            <div className="adb-header__meta">
              {activeEvent && (
                <>
                  <span className="adb-meta-tag">{activeEvent.school_year}</span>
                  <span className="adb-meta-sep" aria-hidden="true" />
                  <span className="adb-meta-tag">{getBookingWindowLabel(activeEvent)}</span>
                  <span className="adb-meta-sep" aria-hidden="true" />
                  <span className={`adb-status-pill adb-status-pill--${activeEvent.status}`}>
                    {EVENT_STATUS_LABELS[activeEvent.status]}
                  </span>
                  <span className="adb-meta-sep" aria-hidden="true" />
                </>
              )}
              <span className="adb-meta-tag">{stats.total} Buchungen</span>
              <span className="adb-meta-sep" aria-hidden="true" />
              <span className="adb-meta-tag">{stats.confirmed} bestätigt</span>
              <span className="adb-meta-sep" aria-hidden="true" />
              <span className="adb-meta-tag">{stats.reserved} offen</span>
            </div>
          </div>

          {/* Filter & Search */}
          {bookings.length > 0 && (
            <div className="adb-filters">
              <div className="um-search">
                <Search size={16} className="um-search__icon" />
                <input
                  type="text"
                  className="um-search__input"
                  placeholder="Name, Klasse, E-Mail, Nachricht ..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="adb-filters__row">
                <select
                  className="adb-select"
                  value={teacherFilter}
                  onChange={(e) => setTeacherFilter(e.target.value)}
                >
                  <option value="">Alle Lehrkräfte</option>
                  {teacherNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <select
                  className="adb-select"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="">Alle Besuchertypen</option>
                  <option value="parent">Erziehungsberechtigte</option>
                  <option value="company">Ausbildungsbetriebe</option>
                </select>
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="btn-secondary btn-secondary--sm"
                    onClick={() => { setQuery(''); setTypeFilter(''); setTeacherFilter(''); }}
                  >
                    Zurücksetzen
                  </button>
                )}
              </div>
              {hasActiveFilters && (
                <div className="adb-filter-count">
                  {filtered.length} von {bookings.length} Buchungen
                </div>
              )}
            </div>
          )}

          {/* Booking List */}
          {bookings.length === 0 ? (
            <div className="um-empty">Noch keine Buchungen vorhanden.</div>
          ) : filtered.length === 0 ? (
            <div className="um-empty">Keine Buchungen gefunden.</div>
          ) : (
            <div className="um-list">
              {groups.map((group) => (
                <div key={group.teacherName}>
                  <div className="adb-teacher-divider">
                    <span className="adb-teacher-divider__name">{group.teacherName}</span>
                    <span className="adb-teacher-divider__line" />
                    <span className="adb-teacher-divider__count">
                      {group.bookings.length} {group.bookings.length === 1 ? 'Termin' : 'Termine'}
                    </span>
                  </div>
                  {group.bookings.map((booking) => (
                    <BookingTableRow
                      key={booking.id}
                      booking={booking}
                      onConfirm={handleConfirmBooking}
                      onCancel={handleCancelBooking}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
