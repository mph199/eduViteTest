/**
 * TeacherBookings — Buchungsübersicht des Kollegiums.
 *
 * Zeigt alle Buchungen des aktiven Events, gruppiert nach Lehrkraft,
 * mit kompaktem Event-Info-Header, Suche und Filtern.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import api from '../../../../services/api';
import type { TimeSlot } from '../../../../types';
import { parseStartMinutes, visitorLabel } from '../../../../utils/bookingSort';
import { useCalendarSubscription } from '../../components/useCalendarSubscription';
import { CalendarSetupBanner, CalendarSyncLink } from '../../components/CalendarSetupBanner';
import { CalendarStatusFooter } from '../../components/CalendarStatusFooter';
import { BookingTableRow } from '../../components/BookingTableRow';
import '../../components/CalendarSubscription.css';
import '../../../../pages/AdminDashboard.css';
import '../../../../shared/styles/um-components.css';
import './TeacherBookings.css';

// ── Types ─────────────────────────────────────────────────────────────

interface ActiveEventResponse {
  event?: {
    id?: number;
    name?: string;
    school_year?: string;
    starts_at?: string;
    ends_at?: string;
    booking_opens_at?: string | null;
    booking_closes_at?: string | null;
    status?: string;
  } | null;
}

interface TeacherGroup {
  teacherName: string;
  bookings: TimeSlot[];
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

function getBookingWindowLabel(event: ActiveEventResponse['event']): string {
  if (!event) return '';
  if (!event.booking_opens_at) return 'Sofort offen';
  return `ab ${formatShortDate(event.booking_opens_at)}`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  closed: 'Geschlossen',
};

function groupByTeacher(bookings: TimeSlot[]): TeacherGroup[] {
  const map = new Map<string, TimeSlot[]>();

  for (const b of bookings) {
    const name = b.teacherName || 'Unbekannt';
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(b);
  }

  // Sort groups alphabetically by teacher name
  const groups: TeacherGroup[] = [];
  const sortedNames = [...map.keys()].sort((a, b) => a.localeCompare(b, 'de'));
  for (const name of sortedNames) {
    const items = map.get(name)!;
    // Sort bookings within group by time
    items.sort((a, b) => {
      const aMin = parseStartMinutes(a.time) ?? 0;
      const bMin = parseStartMinutes(b.time) ?? 0;
      return aMin - bMin || a.id - b.id;
    });
    groups.push({ teacherName: name, bookings: items });
  }

  return groups;
}

// ── Hauptkomponente ───────────────────────────────────────────────────

export function TeacherBookings() {
  const [bookings, setBookings] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeEvent, setActiveEvent] = useState<ActiveEventResponse['event']>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [visitorTypeFilter, setVisitorTypeFilter] = useState('');

  const calSub = useCalendarSubscription();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [bookingsData, activeRes] = await Promise.all([
        api.teacher.getBookings(),
        api.events.getActive() as Promise<ActiveEventResponse>,
      ]);
      setBookings(bookingsData || []);
      setActiveEvent(activeRes?.event || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Buchungen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Unique teacher names for dropdown
  const teacherNames = useMemo(() => {
    const names = new Set<string>();
    for (const b of bookings) {
      if (b.teacherName) names.add(b.teacherName);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'de'));
  }, [bookings]);

  // Filtered bookings
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      // Search
      if (q) {
        const fields = [
          b.teacherName, visitorLabel(b), b.studentName, b.traineeName,
          b.className, b.email, b.message,
        ].map((f) => (f || '').toLowerCase());
        if (!fields.some((f) => f.includes(q))) return false;
      }
      // Teacher filter
      if (teacherFilter && b.teacherName !== teacherFilter) return false;
      // Visitor type filter
      if (visitorTypeFilter && b.visitorType !== visitorTypeFilter) return false;
      return true;
    });
  }, [bookings, search, teacherFilter, visitorTypeFilter]);

  // Grouped by teacher
  const groups = useMemo(() => groupByTeacher(filtered), [filtered]);

  // Stats
  const stats = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const reserved = bookings.filter((b) => b.status === 'reserved').length;
    return { total, confirmed, reserved };
  }, [bookings]);

  const handleCancelBooking = async (booking: TimeSlot) => {
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
      await api.teacher.cancelBooking(booking.id, reason.trim());
      await loadData();
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
      await loadData();
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
        <div className={`${error ? 'admin-error' : 'admin-success'} tb-notice`}>
          {error || notice}
          <button onClick={() => { setError(''); setNotice(''); }} className="back-button">
            Schließen
          </button>
        </div>
      )}

      <CalendarSetupBanner sub={calSub} />

      {/* ── Event Info Header ──────────────────────────────────── */}
      <section className="tb-section">
        <div className="tb-header">
          <div className="tb-header__top">
            <h2 className="tb-header__title">
              {activeEvent?.name || 'Meine Buchungen'}
            </h2>
            <CalendarSyncLink sub={calSub} />
          </div>
          {activeEvent && (
            <div className="tb-header__meta">
              {activeEvent.school_year && (
                <span className="tb-meta-tag">{activeEvent.school_year}</span>
              )}
              <span className="tb-meta-sep" aria-hidden="true" />
              <span className="tb-meta-tag">{getBookingWindowLabel(activeEvent)}</span>
              <span className="tb-meta-sep" aria-hidden="true" />
              {activeEvent.status && (
                <span className={`tb-status-pill tb-status-pill--${activeEvent.status}`}>
                  {STATUS_LABELS[activeEvent.status] || activeEvent.status}
                </span>
              )}
            </div>
          )}
          <div className="tb-header__stats">
            <span className="tb-stat">{stats.total} Buchungen</span>
            <span className="tb-meta-sep" aria-hidden="true" />
            <span className="tb-stat">{stats.confirmed} bestätigt</span>
            <span className="tb-meta-sep" aria-hidden="true" />
            <span className="tb-stat">{stats.reserved} offen</span>
          </div>
        </div>

        {/* ── Filter & Search ─────────────────────────────────── */}
        <div className="tb-filters">
          <div className="um-search">
            <Search size={16} className="um-search__icon" />
            <input
              type="text"
              className="um-search__input"
              placeholder="Name, Klasse, E-Mail, Nachricht ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="tb-filters__dropdowns">
            <select
              className="tb-select"
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
            >
              <option value="">Alle Lehrkräfte</option>
              {teacherNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              className="tb-select"
              value={visitorTypeFilter}
              onChange={(e) => setVisitorTypeFilter(e.target.value)}
            >
              <option value="">Alle Besuchertypen</option>
              <option value="parent">Erziehungsberechtigte</option>
              <option value="company">Ausbildungsbetriebe</option>
            </select>
          </div>
        </div>

        {/* ── Booking List ────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="um-empty">
            {bookings.length === 0
              ? 'Noch keine Buchungen vorhanden.'
              : 'Keine Buchungen gefunden.'}
          </div>
        ) : (
          <div className="um-list">
            {groups.map((group) => (
              <div key={group.teacherName}>
                <div className="tb-teacher-divider">
                  <span className="tb-teacher-divider__name">{group.teacherName}</span>
                  <span className="tb-teacher-divider__line" />
                </div>
                {group.bookings.map((booking) => (
                  <BookingTableRow
                    key={booking.id}
                    booking={booking}
                    onConfirm={handleAcceptBooking}
                    onCancel={handleCancelBooking}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <CalendarStatusFooter sub={calSub} />
    </>
  );
}
