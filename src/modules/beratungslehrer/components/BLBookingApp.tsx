import { useState, useEffect, useCallback } from 'react';
import { BLAnonymousRequest } from './BLAnonymousRequest';
import './BLBookingApp.css';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

interface Counselor {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  salutation?: string;
  room?: string;
  specializations?: string;
  available_from?: string;
  available_until?: string;
  slot_duration_minutes?: number;
}

interface Topic {
  id: number;
  name: string;
  description?: string;
}

interface AppointmentSlot {
  id: number;
  date: string;
  time: string;
  duration_minutes: number;
}

type Mode = 'select' | 'booking' | 'request';
type Step = 'counselor' | 'datetime' | 'form' | 'success';

export function BLBookingApp() {
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Mode: select between booking and anonymous request
  const [mode, setMode] = useState<Mode>('select');

  // Booking flow state
  const [step, setStep] = useState<Step>('counselor');
  const [selectedCounselor, setSelectedCounselor] = useState<Counselor | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<AppointmentSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Form
  const [formData, setFormData] = useState({
    student_name: '',
    student_class: '',
    email: '',
    phone: '',
    concern: '',
    topic_id: '',
    is_urgent: false,
    is_anonymous: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [, setBookedAppointment] = useState<any>(null);

  // Load counselors and topics
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/bl/counselors`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API_BASE}/bl/topics`, { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([cData, tData]) => {
        setCounselors(cData.counselors || []);
        setTopics(tData.topics || []);
      })
      .catch(() => setError('Fehler beim Laden der Daten'))
      .finally(() => setLoading(false));
  }, []);

  // Load available slots when counselor + date selected
  const loadSlots = useCallback(async (counselorId: number, date: string) => {
    setSlotsLoading(true);
    setAvailableSlots([]);
    setSelectedSlot(null);
    try {
      const res = await fetch(
        `${API_BASE}/bl/appointments/${counselorId}?date=${encodeURIComponent(date)}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      setAvailableSlots(data.appointments || []);
    } catch {
      setError('Fehler beim Laden der Termine');
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  // Handlers
  const handleSelectCounselor = (c: Counselor) => {
    setSelectedCounselor(c);
    setStep('datetime');
    setSelectedDate('');
    setAvailableSlots([]);
    setSelectedSlot(null);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    if (selectedCounselor && date) {
      loadSlots(selectedCounselor.id, date);
    }
  };

  const handleSelectSlot = (slot: AppointmentSlot) => {
    setSelectedSlot(slot);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    if (!formData.is_anonymous && !formData.student_name.trim()) {
      alert('Bitte gib deinen Namen ein oder waehle "Anonym buchen".');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/bl/appointments/${selectedSlot.id}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          topic_id: formData.topic_id ? parseInt(formData.topic_id) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data as any)?.error || `Fehler ${res.status}`);
      }

      const data = await res.json();
      setBookedAppointment(data.appointment);
      setStep('success');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Buchen');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setMode('select');
    setStep('counselor');
    setSelectedCounselor(null);
    setSelectedDate('');
    setAvailableSlots([]);
    setSelectedSlot(null);
    setBookedAppointment(null);
    setFormData({ student_name: '', student_class: '', email: '', phone: '', concern: '', topic_id: '', is_urgent: false, is_anonymous: false });
  };

  const today = new Date().toISOString().slice(0, 10);

  // Step indicators
  const steps: { key: Step; label: string }[] = [
    { key: 'counselor', label: 'Berater/in' },
    { key: 'datetime', label: 'Termin' },
    { key: 'form', label: 'Angaben' },
    { key: 'success', label: 'Fertig' },
  ];

  const stepIndex = steps.findIndex(s => s.key === step);

  if (loading) return <div className="bl-loading">Lade Beratungsangebote...</div>;
  if (error) return <div className="bl-app"><p style={{ color: 'var(--color-error, red)' }}>{error}</p></div>;

  return (
    <div className="bl-app">
      <h1>Beratungslehrer</h1>
      <p className="bl-app__subtitle">Buche eine Sprechstunde oder stelle eine anonyme Anfrage.</p>

      {/* Mode selection */}
      {mode === 'select' && (
        <>
          <div className="bl-confidential-notice">
            Alle Beratungsgespraeche sind <strong>vertraulich</strong>. Du kannst auch <strong>anonym</strong> Hilfe anfragen.
          </div>
          <div className="bl-mode-selection">
            <div
              className="bl-mode-card"
              onClick={() => setMode('booking')}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMode('booking'); } }}
            >
              <div className="bl-mode-card__title">Sprechstunde buchen</div>
              <div className="bl-mode-card__desc">
                Waehle einen Beratungslehrer und einen Termin aus dem Kalender.
              </div>
            </div>
            <div
              className="bl-mode-card"
              onClick={() => setMode('request')}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMode('request'); } }}
            >
              <div className="bl-mode-card__title">Anonyme Anfrage</div>
              <div className="bl-mode-card__desc">
                Stelle eine Frage oder bitte um Hilfe -- ganz ohne deinen Namen.
              </div>
            </div>
          </div>
        </>
      )}

      {/* Anonymous request mode */}
      {mode === 'request' && (
        <BLAnonymousRequest
          counselors={counselors}
          topics={topics}
          onBack={handleReset}
        />
      )}

      {/* Booking mode */}
      {mode === 'booking' && (
        <>
          {/* Step indicator */}
          <div className="bl-steps">
            {steps.map((s, i) => (
              <div
                key={s.key}
                className={`bl-step${i === stepIndex ? ' bl-step--active' : ''}${i < stepIndex ? ' bl-step--done' : ''}`}
              >
                <span className="bl-step__num">{i < stepIndex ? '\u2713' : i + 1}</span>
                {s.label}
              </div>
            ))}
          </div>

          {/* Step: Select Counselor */}
          {step === 'counselor' && (
            <>
              <div className="bl-confidential-notice">
                Alle Beratungsgespraeche sind <strong>vertraulich</strong>. Deine Angaben werden nur an den gewaehlten Beratungslehrer weitergegeben.
              </div>
              {counselors.length === 0 ? (
                <p className="bl-empty">Derzeit sind keine Beratungslehrer verfuegbar.</p>
              ) : (
                <div className="bl-counselors">
                  {counselors.map(c => (
                    <div
                      key={c.id}
                      className={`bl-counselor-card${selectedCounselor?.id === c.id ? ' bl-counselor-card--selected' : ''}`}
                      onClick={() => handleSelectCounselor(c)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectCounselor(c); } }}
                    >
                      <div className="bl-counselor-card__name">
                        {c.salutation ? `${c.salutation} ` : ''}{c.name}
                      </div>
                      <div className="bl-counselor-card__meta">
                        {c.room && <>Raum {c.room}</>}
                        {c.room && c.available_from && <> · </>}
                        {c.available_from && <>{c.available_from?.toString().slice(0, 5)} – {c.available_until?.toString().slice(0, 5)} Uhr</>}
                      </div>
                      {c.specializations && (
                        <div className="bl-counselor-card__specs">
                          {c.specializations.split(',').map((s, i) => (
                            <span key={i} className="bl-counselor-card__spec">{s.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="bl-actions">
                <button className="btn-secondary" onClick={handleReset}>Zurueck</button>
              </div>
            </>
          )}

          {/* Step: Select Date + Time */}
          {step === 'datetime' && selectedCounselor && (
            <>
              <p style={{ marginBottom: '1rem' }}>
                Termin bei <strong>{selectedCounselor.salutation ? `${selectedCounselor.salutation} ` : ''}{selectedCounselor.name}</strong>
              </p>

              <div className="bl-date-section">
                <label htmlFor="bl-date">Datum waehlen</label>
                <input
                  id="bl-date"
                  type="date"
                  className="bl-date-input"
                  value={selectedDate}
                  min={today}
                  onChange={e => handleDateChange(e.target.value)}
                />
              </div>

              {selectedDate && (
                <>
                  {slotsLoading ? (
                    <p className="bl-loading">Lade verfuegbare Zeiten...</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="bl-empty">Keine freien Termine an diesem Tag. Bitte ein anderes Datum waehlen.</p>
                  ) : (
                    <>
                      <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Verfuegbare Zeiten:</p>
                      <div className="bl-slots">
                        {availableSlots.map(slot => (
                          <button
                            key={slot.id}
                            className={`bl-slot${selectedSlot?.id === slot.id ? ' bl-slot--selected' : ''}`}
                            onClick={() => handleSelectSlot(slot)}
                          >
                            {slot.time?.toString().slice(0, 5)} Uhr
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="bl-actions">
                <button className="btn-secondary" onClick={() => setStep('counselor')}>
                  Zurueck
                </button>
              </div>
            </>
          )}

          {/* Step: Booking Form */}
          {step === 'form' && selectedCounselor && selectedSlot && (
            <>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>{selectedCounselor.salutation ? `${selectedCounselor.salutation} ` : ''}{selectedCounselor.name}</strong>
                {' · '}{selectedDate} um {selectedSlot.time?.toString().slice(0, 5)} Uhr
              </p>

              <div className="bl-confidential-notice">
                Deine Angaben werden vertraulich behandelt und nur an den Beratungslehrer weitergegeben.
              </div>

              <form className="bl-form" onSubmit={handleSubmit}>
                <label className="bl-form__anonymous">
                  <input
                    type="checkbox"
                    checked={formData.is_anonymous}
                    onChange={e => setFormData({ ...formData, is_anonymous: e.target.checked, student_name: e.target.checked ? '' : formData.student_name })}
                  />
                  Ich moechte anonym bleiben
                </label>

                {!formData.is_anonymous && (
                  <div className="bl-form__group">
                    <label htmlFor="bl-name">Name *</label>
                    <input
                      id="bl-name"
                      type="text"
                      value={formData.student_name}
                      onChange={e => setFormData({ ...formData, student_name: e.target.value })}
                      placeholder="Dein vollstaendiger Name"
                      required={!formData.is_anonymous}
                    />
                  </div>
                )}

                <div className="bl-form__group">
                  <label htmlFor="bl-class">Klasse / Kurs</label>
                  <input
                    id="bl-class"
                    type="text"
                    value={formData.student_class}
                    onChange={e => setFormData({ ...formData, student_class: e.target.value })}
                    placeholder="z.B. 10a, BG22"
                  />
                </div>

                <div className="bl-form__group">
                  <label htmlFor="bl-email">E-Mail (optional)</label>
                  <input
                    id="bl-email"
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Fuer Terminbestaetigung"
                  />
                  <span className="bl-form__hint">Falls du eine Bestaetigung erhalten moechtest</span>
                </div>

                <div className="bl-form__group">
                  <label htmlFor="bl-topic">Thema</label>
                  <select
                    id="bl-topic"
                    value={formData.topic_id}
                    onChange={e => setFormData({ ...formData, topic_id: e.target.value })}
                  >
                    <option value="">-- Bitte waehlen --</option>
                    {topics.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bl-form__group">
                  <label htmlFor="bl-concern">Kurze Beschreibung (optional)</label>
                  <textarea
                    id="bl-concern"
                    value={formData.concern}
                    onChange={e => setFormData({ ...formData, concern: e.target.value })}
                    placeholder="Worum geht es ungefaehr? (Wird nur dem Beratungslehrer gezeigt)"
                    maxLength={500}
                  />
                </div>

                <label className="bl-form__urgent">
                  <input
                    type="checkbox"
                    checked={formData.is_urgent}
                    onChange={e => setFormData({ ...formData, is_urgent: e.target.checked })}
                  />
                  Dringend -- Ich brauche moeglichst schnell Hilfe
                </label>

                <div className="bl-actions">
                  <button className="btn-secondary" type="button" onClick={() => setStep('datetime')}>
                    Zurueck
                  </button>
                  <button className="btn-primary" type="submit" disabled={submitting}>
                    {submitting ? 'Wird gebucht...' : 'Termin anfragen'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="bl-success">
              <div className="bl-success__icon">&#10003;</div>
              <h2>Termin angefragt!</h2>
              <p>Deine Anfrage wurde erfolgreich uebermittelt.</p>
              {selectedCounselor && (
                <dl className="bl-success__details">
                  <dt>Beratungslehrer</dt>
                  <dd>{selectedCounselor.salutation ? `${selectedCounselor.salutation} ` : ''}{selectedCounselor.name}</dd>
                  <dt>Datum</dt>
                  <dd>{selectedDate}</dd>
                  <dt>Uhrzeit</dt>
                  <dd>{selectedSlot?.time?.toString().slice(0, 5)} Uhr</dd>
                  {selectedCounselor.room && (
                    <>
                      <dt>Raum</dt>
                      <dd>{selectedCounselor.room}</dd>
                    </>
                  )}
                  {formData.is_anonymous && (
                    <>
                      <dt>Hinweis</dt>
                      <dd>Anonyme Buchung</dd>
                    </>
                  )}
                </dl>
              )}
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
                Der Beratungslehrer wird sich bei dir melden, um den Termin zu bestaetigen.
              </p>
              <div className="bl-actions" style={{ justifyContent: 'center', marginTop: '1rem' }}>
                <button className="btn-primary" onClick={handleReset}>
                  Neuen Termin buchen
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
