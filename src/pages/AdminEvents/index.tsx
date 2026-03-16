import { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveView } from '../../hooks/useActiveView';
import api from '../../services/api';
import { EventCreateForm } from './EventCreateForm';
import { SlotControls } from './SlotControls';
import { EventStatusActions } from './EventStatusActions';
import '../AdminDashboard.css';

type AdminEvent = {
  id: number;
  name: string;
  school_year: string;
  starts_at: string;
  ends_at: string;
  status: 'draft' | 'published' | 'closed';
  booking_opens_at?: string | null;
  booking_closes_at?: string | null;
  timezone?: string | null;
};
type EventResponse = { event: AdminEvent };

type GenerateSlotsResponse = {
  success?: boolean;
  created?: number;
  skipped?: number;
  eventDate?: string;
  error?: string;
  message?: string;
};

function formatEventDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  closed: 'Geschlossen',
};

const STATUS_VARIANT: Record<string, string> = {
  draft: 'warning',
  published: 'success',
  closed: 'neutral',
};

export function AdminEvents() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);

  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const expandedEvent = useMemo(
    () => (expandedEventId ? events.find((e) => e.id === expandedEventId) || null : null),
    [events, expandedEventId]
  );
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const [slotMinutes, setSlotMinutes] = useState<number>(15);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [generating, setGenerating] = useState(false);

  useActiveView('admin');

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError('');
      const res = (await api.admin.getEvents()) as unknown as AdminEvent[];
      setEvents(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden der Events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreated = async (payload: Record<string, unknown>) => {
    setError('');
    setSuccess('');
    try {
      setCreating(true);
      const res = (await api.admin.createEvent(payload)) as EventResponse;
      const newId = res?.event?.id;
      setSuccess(`Event „${res?.event?.name}" erstellt – jetzt Slots generieren und veröffentlichen.`);
      await loadEvents();
      if (newId) {
        setExpandedEventId(newId);
        setTimeout(() => detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
      }
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Fehler beim Erstellen');
    } finally {
      setCreating(false);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const handleSetStatus = async (id: number, status: AdminEvent['status']) => {
    setError('');
    setSuccess('');
    try {
      const res = (await api.admin.updateEvent(id, { status })) as EventResponse;
      setSuccess(`Status: ${res.event.name} → ${STATUS_LABELS[res.event.status] || res.event.status}`);
      await loadEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Aktualisieren');
    } finally {
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Event und alle zugehörigen Sprechzeiten wirklich löschen?')) return;
    setError('');
    setSuccess('');
    try {
      await api.admin.deleteEvent(id);
      setSuccess('Event gelöscht.');
      if (expandedEventId === id) setExpandedEventId(null);
      await loadEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen');
    } finally {
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleGenerateSlots = async (eventId: number) => {
    setError('');
    setSuccess('');
    setGenerating(true);
    try {
      const res = (await api.admin.generateEventSlots(eventId, { slotMinutes, replaceExisting })) as GenerateSlotsResponse;
      setSuccess(
        `Sprechzeiten generiert${res?.eventDate ? ` (${res.eventDate})` : ''}: ${res?.created ?? 0} erstellt, ${res?.skipped ?? 0} übersprungen`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Generieren');
    } finally {
      setGenerating(false);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedEventId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Lade Events…</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <main className="admin-main">
        {error && <div className="admin-error">{error}</div>}
        {success && <div className="admin-success">{success}</div>}

        {/* Workflow guide */}
        <div className="ev-workflow">
          <div className="ev-workflow__step">
            <span className="ev-workflow__num">1</span>
            <span className="ev-workflow__label">Event anlegen</span>
          </div>
          <span className="ev-workflow__arrow" aria-hidden="true">→</span>
          <div className="ev-workflow__step">
            <span className="ev-workflow__num">2</span>
            <span className="ev-workflow__label">Sprechzeiten generieren</span>
          </div>
          <span className="ev-workflow__arrow" aria-hidden="true">→</span>
          <div className="ev-workflow__step">
            <span className="ev-workflow__num">3</span>
            <span className="ev-workflow__label">Veröffentlichen</span>
          </div>
        </div>

        <EventCreateForm onCreated={handleCreated} creating={creating} />

        {/* Events list with inline detail */}
        <div className="teacher-form-container" style={{ padding: events.length ? '0' : undefined }}>
          {events.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <h3 style={{ margin: '0 0 0.75rem' }}>Keine Events vorhanden</h3>
              <p style={{ color: '#6b7280', margin: 0 }}>Legen Sie oben ein neues Event an, um loszulegen.</p>
            </div>
          ) : (
            <>
              {/* Desktop: Table */}
              <div className="events-table-desktop">
                <div className="admin-resp-table-container">
                  <table className="admin-resp-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Schuljahr</th>
                        <th>Zeitraum</th>
                        <th>Status</th>
                        <th className="admin-actions-header">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev) => {
                        const isExpanded = expandedEventId === ev.id;
                        return (
                          <tr key={ev.id} className={isExpanded ? 'ev-row--expanded' : ''} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(ev.id)}>
                            <td><span className="admin-cell-main">{ev.name}</span></td>
                            <td>{ev.school_year}</td>
                            <td>
                              <span className="ev-cell-date">{formatEventDateTime(ev.starts_at)}</span>
                              <span className="ev-cell-date-sep"> – </span>
                              <span className="ev-cell-date">{formatEventDateTime(ev.ends_at)}</span>
                            </td>
                            <td>
                              <span className={`admin-status-pill admin-status-pill--${STATUS_VARIANT[ev.status] || 'neutral'}`}>
                                {STATUS_LABELS[ev.status] || ev.status}
                              </span>
                            </td>
                            <td className="admin-actions-cell" onClick={(e) => e.stopPropagation()}>
                              <div className="action-buttons">
                                <button type="button" className="btn-secondary btn-sm" onClick={() => toggleExpand(ev.id)}>
                                  {isExpanded ? 'Schließen' : 'Details'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {expandedEvent && (
                  <div className="ev-detail-panel" ref={detailPanelRef}>
                    <div className="ev-detail-panel__header">
                      <h3 className="ev-detail-panel__title">{expandedEvent.name}</h3>
                      <button type="button" className="ev-detail-panel__close" onClick={() => setExpandedEventId(null)} aria-label="Schließen">✕</button>
                    </div>
                    <div className="ev-detail-grid">
                      <div className="ev-detail-item">
                        <span className="ev-detail-label">Zeitraum</span>
                        <span className="ev-detail-value">
                          {formatEventDateTime(expandedEvent.starts_at)}<br />bis {formatEventDateTime(expandedEvent.ends_at)}
                        </span>
                      </div>
                      <div className="ev-detail-item">
                        <span className="ev-detail-label">Buchungsfenster</span>
                        <span className="ev-detail-value">
                          {expandedEvent.booking_opens_at ? formatEventDateTime(expandedEvent.booking_opens_at) : 'Ab Veröffentlichung'}
                          <br />bis {expandedEvent.booking_closes_at ? formatEventDateTime(expandedEvent.booking_closes_at) : 'Unbegrenzt'}
                        </span>
                      </div>
                    </div>
                    <SlotControls eventId={expandedEvent.id} slotMinutes={slotMinutes} setSlotMinutes={setSlotMinutes} replaceExisting={replaceExisting} setReplaceExisting={setReplaceExisting} generating={generating} onGenerate={handleGenerateSlots} />
                    <EventStatusActions eventId={expandedEvent.id} status={expandedEvent.status} onSetStatus={handleSetStatus} onDelete={handleDelete} />
                  </div>
                )}
              </div>

              {/* Mobile: Cards */}
              <div className="events-cards-mobile">
                <div className="events-card-list">
                  {events.map((ev) => {
                    const isExpanded = expandedEventId === ev.id;
                    return (
                      <article key={ev.id} className={`event-card${isExpanded ? ' is-expanded' : ''}`}>
                        <button type="button" className="event-card__header" onClick={() => toggleExpand(ev.id)} aria-expanded={isExpanded}>
                          <div className="event-card__summary">
                            <span className="event-card__name">{ev.name}</span>
                            <span className={`admin-status-pill admin-status-pill--${STATUS_VARIANT[ev.status] || 'neutral'}`} style={{ alignSelf: 'flex-start' }}>
                              {STATUS_LABELS[ev.status] || ev.status}
                            </span>
                          </div>
                          <span className="event-card__chevron" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                        </button>
                        <div className="event-card__body">
                          <div className="event-card__inner">
                            <dl className="event-card__dl">
                              <div className="event-card__row"><dt>Schuljahr</dt><dd>{ev.school_year}</dd></div>
                              <div className="event-card__row"><dt>Beginn</dt><dd>{formatEventDateTime(ev.starts_at)}</dd></div>
                              <div className="event-card__row"><dt>Ende</dt><dd>{formatEventDateTime(ev.ends_at)}</dd></div>
                              <div className="event-card__row"><dt>Buchung öffnet</dt><dd>{ev.booking_opens_at ? formatEventDateTime(ev.booking_opens_at) : 'Ab Veröffentlichung'}</dd></div>
                              <div className="event-card__row"><dt>Buchung schließt</dt><dd>{ev.booking_closes_at ? formatEventDateTime(ev.booking_closes_at) : 'Unbegrenzt'}</dd></div>
                            </dl>
                            <SlotControls eventId={ev.id} idPrefix="m_" slotMinutes={slotMinutes} setSlotMinutes={setSlotMinutes} replaceExisting={replaceExisting} setReplaceExisting={setReplaceExisting} generating={generating} onGenerate={handleGenerateSlots} />
                            <EventStatusActions eventId={ev.id} status={ev.status} onSetStatus={handleSetStatus} onDelete={handleDelete} />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="teacher-form-container" style={{ padding: '1rem 1.5rem' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.88rem' }}>
            <strong>Hinweis:</strong> „Aktiv" ist das zuletzt veröffentlichte Event, das innerhalb seines Buchungsfensters liegt.
            Buchungen sind nur möglich, solange ein Event den Status „Veröffentlicht" hat.
          </p>
        </div>
      </main>
    </div>
  );
}
