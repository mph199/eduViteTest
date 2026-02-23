import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
import './AdminDashboard.css';

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

function inputDateTimeToIso(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

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

function defaultSchoolYear() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (m >= 7) return `${y}/${String(y + 1).slice(2)}`;
  return `${y - 1}/${String(y).slice(2)}`;
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

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [createData, setCreateData] = useState({
    name: '',
    school_year: defaultSchoolYear(),
    starts_at: '',
    ends_at: '',
    booking_opens_at: '',
    booking_closes_at: '',
  });

  // Expanded event (detail panel)
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const expandedEvent = useMemo(
    () => (expandedEventId ? events.find((e) => e.id === expandedEventId) || null : null),
    [events, expandedEventId]
  );
  const detailPanelRef = useRef<HTMLDivElement>(null);

  // Slot generation
  const [slotMinutes, setSlotMinutes] = useState<number>(15);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [generating, setGenerating] = useState(false);

  const { user, setActiveView } = useAuth();
  const canSwitchView = Boolean(user?.role === 'admin' && user.teacherId);

  useEffect(() => {
    if (canSwitchView) setActiveView('admin');
  }, [canSwitchView, setActiveView]);

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

  // Auto-fill ends_at 3 hours after starts_at
  const handleStartsAtChange = (value: string) => {
    setCreateData((prev) => {
      const next = { ...prev, starts_at: value };
      if (value && !prev.ends_at) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(d.getHours() + 3);
          const pad = (n: number) => String(n).padStart(2, '0');
          next.ends_at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
      }
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const startsIso = inputDateTimeToIso(createData.starts_at);
    const endsIso = inputDateTimeToIso(createData.ends_at);
    const opensIso = inputDateTimeToIso(createData.booking_opens_at);
    const closesIso = inputDateTimeToIso(createData.booking_closes_at);

    if (!createData.name.trim() || !createData.school_year.trim() || !startsIso || !endsIso) {
      setError('Bitte Name, Schuljahr, Beginn und Ende ausfüllen.');
      return;
    }

    try {
      setCreating(true);
      const res = (await api.admin.createEvent({
        name: createData.name.trim(),
        school_year: createData.school_year.trim(),
        starts_at: startsIso,
        ends_at: endsIso,
        booking_opens_at: opensIso,
        booking_closes_at: closesIso,
        status: 'draft',
        timezone: 'Europe/Berlin',
      })) as EventResponse;

      const newId = res?.event?.id;
      setSuccess(`Event „${res?.event?.name || createData.name}" erstellt – jetzt Slots generieren und veröffentlichen.`);
      setCreateData({ name: '', school_year: defaultSchoolYear(), starts_at: '', ends_at: '', booking_opens_at: '', booking_closes_at: '' });
      setShowCreateForm(false);
      setShowAdvanced(false);
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
    if (!confirm('Event und alle zugehörigen Slots wirklich löschen?')) return;
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
      const res = (await api.admin.generateEventSlots(eventId, {
        slotMinutes,
        replaceExisting,
      })) as GenerateSlotsResponse;
      const created = res?.created;
      const skipped = res?.skipped;
      const eventDate = res?.eventDate;
      setSuccess(
        `Slots generiert${eventDate ? ` (${eventDate})` : ''}: ${created ?? 0} erstellt, ${skipped ?? 0} übersprungen`
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
            <span className="ev-workflow__label">Slots generieren</span>
          </div>
          <span className="ev-workflow__arrow" aria-hidden="true">→</span>
          <div className="ev-workflow__step">
            <span className="ev-workflow__num">3</span>
            <span className="ev-workflow__label">Veröffentlichen</span>
          </div>
        </div>

        {/* Create form (collapsible) */}
        <div className="teacher-form-container">
          <button
            type="button"
            className="ev-section-toggle"
            onClick={() => setShowCreateForm((p) => !p)}
            aria-expanded={showCreateForm}
          >
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="ev-workflow__num" style={{ fontSize: '0.7rem', width: 22, height: 22, flexShrink: 0 }}>1</span>
              <span><span aria-hidden="true">{showCreateForm ? '−' : '+'}</span>{' '}Neues Event anlegen</span>
            </h3>
          </button>

          {showCreateForm && (
            <form onSubmit={handleCreate} className="teacher-form" style={{ marginTop: '1rem' }}>
              {/* Row 1: Name + Schuljahr */}
              <div className="admin-grid-2">
                <div className="form-group">
                  <label htmlFor="ev_name">Name des Sprechtags</label>
                  <input
                    id="ev_name"
                    type="text"
                    value={createData.name}
                    onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                    placeholder="z.B. Eltern- und Ausbildersprechtag März 2026"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="ev_year">Schuljahr</label>
                  <input
                    id="ev_year"
                    type="text"
                    value={createData.school_year}
                    onChange={(e) => setCreateData({ ...createData, school_year: e.target.value })}
                    placeholder="2025/26"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Sprechtag-Zeitraum */}
              <div className="admin-grid-2">
                <div className="form-group">
                  <label htmlFor="ev_starts">Sprechtag beginnt</label>
                  <input
                    id="ev_starts"
                    type="datetime-local"
                    value={createData.starts_at}
                    onChange={(e) => handleStartsAtChange(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="ev_ends">Sprechtag endet</label>
                  <input
                    id="ev_ends"
                    type="datetime-local"
                    value={createData.ends_at}
                    onChange={(e) => setCreateData({ ...createData, ends_at: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Advanced: Booking window */}
              <button
                type="button"
                className="ev-advanced-toggle"
                onClick={() => setShowAdvanced((p) => !p)}
              >
                {showAdvanced ? '▾' : '▸'} Buchungsfenster konfigurieren (optional)
              </button>

              {showAdvanced && (
                <div className="ev-advanced-section">
                  <p className="ev-advanced-hint">
                    Legen Sie fest, ab wann und bis wann Eltern und Ausbilder Termine anfragen können.
                    Ohne Angabe ist die Buchung sofort nach Veröffentlichung möglich.
                  </p>
                  <div className="admin-grid-2">
                    <div className="form-group">
                      <label htmlFor="ev_opens">Buchung öffnet</label>
                      <input
                        id="ev_opens"
                        type="datetime-local"
                        value={createData.booking_opens_at}
                        onChange={(e) => setCreateData({ ...createData, booking_opens_at: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="ev_closes">Buchung schließt</label>
                      <input
                        id="ev_closes"
                        type="datetime-local"
                        value={createData.booking_closes_at}
                        onChange={(e) => setCreateData({ ...createData, booking_closes_at: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Erstelle…' : 'Event anlegen'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setShowCreateForm(false); setShowAdvanced(false); }}>
                  Abbrechen
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Events list with inline detail */}
        <div className="teacher-form-container" style={{ padding: events.length ? '0' : undefined }}>
          {events.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <h3 style={{ margin: '0 0 0.75rem' }}>Keine Events vorhanden</h3>
              <p style={{ color: '#6b7280', margin: 0 }}>
                Legen Sie oben ein neues Event an, um loszulegen.
              </p>
            </div>
          ) : (
            <>
              {events.map((ev) => {
                const isExpanded = expandedEventId === ev.id;
                return (
                  <div key={ev.id} className={`ev-card${isExpanded ? ' ev-card--expanded' : ''}`}>
                    {/* Clickable summary row */}
                    <button
                      type="button"
                      className="ev-card__header"
                      onClick={() => toggleExpand(ev.id)}
                      aria-expanded={isExpanded}
                    >
                      <div className="ev-card__steps-hint">
                        <span className="ev-workflow__num ev-workflow__num--sm" title="Slots generieren">2</span>
                        <span className="ev-workflow__num ev-workflow__num--sm" title="Veröffentlichen">3</span>
                      </div>
                      <div className="ev-card__info">
                        <span className="ev-card__name">{ev.name}</span>
                        <span className="ev-card__meta">
                          {ev.school_year} · {formatEventDateTime(ev.starts_at)}
                        </span>
                      </div>
                      <div className="ev-card__right">
                        <span className={`admin-status-pill admin-status-pill--${STATUS_VARIANT[ev.status] || 'neutral'}`}>
                          {STATUS_LABELS[ev.status] || ev.status}
                        </span>
                        <span className="ev-card__chevron" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                      </div>
                    </button>

                    {/* Expanded detail panel */}
                    {isExpanded && expandedEvent && (
                      <div className="ev-card__detail" ref={detailPanelRef}>
                        {/* Event info */}
                        <div className="ev-detail-grid">
                          <div className="ev-detail-item">
                            <span className="ev-detail-label">Zeitraum</span>
                            <span className="ev-detail-value">
                              {formatEventDateTime(expandedEvent.starts_at)}
                              <br />
                              bis {formatEventDateTime(expandedEvent.ends_at)}
                            </span>
                          </div>
                          <div className="ev-detail-item">
                            <span className="ev-detail-label">Buchungsfenster</span>
                            <span className="ev-detail-value">
                              {expandedEvent.booking_opens_at
                                ? formatEventDateTime(expandedEvent.booking_opens_at)
                                : 'Ab Veröffentlichung'}
                              <br />
                              bis {expandedEvent.booking_closes_at
                                ? formatEventDateTime(expandedEvent.booking_closes_at)
                                : 'Unbegrenzt'}
                            </span>
                          </div>
                        </div>

                        {/* Slot generation */}
                        <div className="ev-detail-section">
                          <h4 className="ev-detail-section__title">
                            <span className="ev-workflow__num" style={{ fontSize: '0.7rem', width: 20, height: 20 }}>2</span>
                            Slots generieren
                          </h4>
                          <div className="ev-slot-controls">
                            <div className="form-group" style={{ flex: '0 0 auto', minWidth: 120 }}>
                              <label htmlFor={`slotMin_${ev.id}`}>Slot-Länge</label>
                              <select
                                id={`slotMin_${ev.id}`}
                                value={slotMinutes}
                                onChange={(e) => setSlotMinutes(Number(e.target.value))}
                              >
                                <option value={10}>10 Min.</option>
                                <option value={15}>15 Min.</option>
                                <option value={20}>20 Min.</option>
                                <option value={30}>30 Min.</option>
                              </select>
                            </div>
                            <label className="ev-checkbox-label">
                              <input
                                type="checkbox"
                                checked={replaceExisting}
                                onChange={(e) => setReplaceExisting(e.target.checked)}
                              />
                              Vorhandene Slots ersetzen
                            </label>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => handleGenerateSlots(ev.id)}
                              disabled={generating}
                            >
                              {generating ? 'Generiere…' : 'Slots generieren'}
                            </button>
                          </div>
                        </div>

                        {/* Status & Actions */}
                        <div className="ev-detail-section">
                          <h4 className="ev-detail-section__title">
                            <span className="ev-workflow__num" style={{ fontSize: '0.7rem', width: 20, height: 20 }}>3</span>
                            Status & Aktionen
                          </h4>
                          <div className="ev-detail-actions">
                            {ev.status !== 'published' && (
                              <button type="button" className="btn-primary" onClick={() => handleSetStatus(ev.id, 'published')}>
                                ✓ Veröffentlichen
                              </button>
                            )}
                            {ev.status === 'published' && (
                              <button type="button" className="btn-secondary" onClick={() => handleSetStatus(ev.id, 'closed')}>
                                Event schließen
                              </button>
                            )}
                            {ev.status !== 'draft' && (
                              <button type="button" className="btn-secondary" onClick={() => handleSetStatus(ev.id, 'draft')}>
                                Zurück auf Entwurf
                              </button>
                            )}
                            <button type="button" className="cancel-button" onClick={() => handleDelete(ev.id)}>
                              <span aria-hidden="true">✕</span> Event löschen
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
