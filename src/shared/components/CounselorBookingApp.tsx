import { useState, useEffect, useCallback } from 'react';
import type { Counselor, AppointmentSlot, CounselorBookingConfig, CounselorTopic } from '../../types';
import './CounselorBookingApp.css';

export type { CounselorBookingConfig };

const API_BASE = String(
  (import.meta as unknown as Record<string, Record<string, unknown>>).env?.VITE_API_URL || '/api'
).replace(/\/+$/, '');

async function requestJSON(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as Record<string, string>)?.error || `Fehler ${res.status}`);
  }
  return res.json();
}

type Step = 'counselor' | 'datetime' | 'form' | 'success';

// ── Component ──────────────────────────────────────────────────────

export function CounselorBookingApp({ config }: { config: CounselorBookingConfig }) {
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [topics, setTopics] = useState<CounselorTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [step, setStep] = useState<Step>('counselor');
  const [selectedCounselor, setSelectedCounselor] = useState<Counselor | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<AppointmentSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [formData, setFormData] = useState({
    student_name: '',
    student_class: '',
    email: '',
    concern: '',
    topic_id: '',
    is_urgent: false,
  });
  const [submitting, setSubmitting] = useState(false);

  // Load counselors and topics
  useEffect(() => {
    Promise.all([
      requestJSON(`${config.apiPathPrefix}/counselors`),
      requestJSON(`${config.apiPathPrefix}${config.topicEndpoint}`),
    ])
      .then(([cData, tData]) => {
        setCounselors(Array.isArray(cData?.counselors) ? cData.counselors : []);
        setTopics(Array.isArray(tData?.[config.topicResponseKey]) ? tData[config.topicResponseKey] : []);
      })
      .catch(() => setError('Fehler beim Laden der Daten'))
      .finally(() => setLoading(false));
  }, [config.apiPathPrefix, config.topicEndpoint, config.topicResponseKey]);

  // Load available slots
  const loadSlots = useCallback(async (counselorId: number, date: string) => {
    setSlotsLoading(true);
    setAvailableSlots([]);
    setSelectedSlot(null);
    try {
      const data = await requestJSON(
        `${config.apiPathPrefix}/appointments/${counselorId}?date=${encodeURIComponent(date)}`
      );
      setAvailableSlots(Array.isArray(data?.appointments) ? data.appointments : []);
    } catch {
      setError('Fehler beim Laden der Termine');
    } finally {
      setSlotsLoading(false);
    }
  }, [config.apiPathPrefix]);

  const handleSelectCounselor = (c: Counselor) => {
    setSelectedCounselor(c);
    setStep('datetime');
    setSelectedDate('');
    setAvailableSlots([]);
    setSelectedSlot(null);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    if (selectedCounselor && date) loadSlots(selectedCounselor.id, date);
  };

  const handleSelectSlot = (slot: AppointmentSlot) => {
    setSelectedSlot(slot);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    if (!formData.student_name.trim()) {
      alert('Bitte gib deinen Namen ein.');
      return;
    }

    setSubmitting(true);
    try {
      await requestJSON(`${config.apiPathPrefix}/appointments/${selectedSlot.id}/book`, {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          [config.topicFieldKey]: formData.topic_id ? parseInt(formData.topic_id) : null,
        }),
      });
      setStep('success');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Buchen');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep('counselor');
    setSelectedCounselor(null);
    setSelectedDate('');
    setAvailableSlots([]);
    setSelectedSlot(null);
    setFormData({ student_name: '', student_class: '', email: '', concern: '', topic_id: '', is_urgent: false });
  };

  const today = new Date().toISOString().slice(0, 10);

  const steps: { key: Step; label: string }[] = [
    { key: 'counselor', label: config.counselorLabel },
    { key: 'datetime', label: 'Termin' },
    { key: 'form', label: 'Angaben' },
    { key: 'success', label: 'Fertig' },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  if (loading) return <div className="cb-loading">Lade Beratungsangebote...</div>;
  if (error) return <div className="cb-app"><p style={{ color: 'var(--color-error, red)' }}>{error}</p></div>;

  return (
    <div className="cb-app">
      <h1>{config.title}</h1>
      <p className="cb-app__subtitle">{config.subtitle}</p>

      {/* Step indicator */}
      <div className="cb-steps">
        {steps.map((s, i) => (
          <div
            key={s.key}
            className={`cb-step${i === stepIndex ? ' cb-step--active' : ''}${i < stepIndex ? ' cb-step--done' : ''}`}
          >
            <span className="cb-step__num">{i < stepIndex ? '\u2713' : i + 1}</span>
            {s.label}
          </div>
        ))}
      </div>

      {/* Step: Select Counselor */}
      {step === 'counselor' && (
        <>
          <div className="cb-confidential-notice">{config.confidentialNotice}</div>
          {counselors.length === 0 ? (
            <p className="cb-empty">Derzeit sind keine {config.counselorLabel} verfügbar.</p>
          ) : (
            <div className="cb-counselors">
              {counselors.map(c => (
                <div
                  key={c.id}
                  className={`cb-counselor-card${selectedCounselor?.id === c.id ? ' cb-counselor-card--selected' : ''}`}
                  onClick={() => handleSelectCounselor(c)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectCounselor(c); } }}
                >
                  <div className="cb-counselor-card__name">
                    {c.salutation ? `${c.salutation} ` : ''}{c.name}
                  </div>
                  <div className="cb-counselor-card__meta">
                    {c.room && <>Raum {c.room}</>}
                    {c.room && c.available_from && <> &middot; </>}
                    {c.available_from && <>{c.available_from?.toString().slice(0, 5)} &ndash; {c.available_until?.toString().slice(0, 5)} Uhr</>}
                  </div>
                  {c.specializations && (
                    <div className="cb-counselor-card__specs">
                      {c.specializations.split(',').map((s, i) => (
                        <span key={i} className="cb-counselor-card__spec">{s.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Step: Select Date + Time */}
      {step === 'datetime' && selectedCounselor && (
        <>
          <p style={{ marginBottom: '1rem' }}>
            Termin bei <strong>{selectedCounselor.salutation ? `${selectedCounselor.salutation} ` : ''}{selectedCounselor.name}</strong>
          </p>

          <div className="cb-date-section">
            <label htmlFor="cb-date">Datum wählen</label>
            <input
              id="cb-date"
              type="date"
              className="cb-date-input"
              value={selectedDate}
              min={today}
              onChange={e => handleDateChange(e.target.value)}
            />
          </div>

          {selectedDate && (
            <>
              {slotsLoading ? (
                <p className="cb-loading">Lade verfügbare Zeiten...</p>
              ) : availableSlots.length === 0 ? (
                <p className="cb-empty">Keine freien Termine an diesem Tag. Bitte ein anderes Datum wählen.</p>
              ) : (
                <>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Verfügbare Zeiten:</p>
                  <div className="cb-slots">
                    {availableSlots.map(slot => (
                      <button
                        key={slot.id}
                        className={`cb-slot${selectedSlot?.id === slot.id ? ' cb-slot--selected' : ''}`}
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

          <div className="cb-actions">
            <button className="btn-secondary" onClick={() => setStep('counselor')}>
              Zurück
            </button>
          </div>
        </>
      )}

      {/* Step: Booking Form */}
      {step === 'form' && selectedCounselor && selectedSlot && (
        <>
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>{selectedCounselor.salutation ? `${selectedCounselor.salutation} ` : ''}{selectedCounselor.name}</strong>
            {' \u00B7 '}{selectedDate} um {selectedSlot.time?.toString().slice(0, 5)} Uhr
          </p>

          <div className="cb-confidential-notice">
            Deine Angaben werden vertraulich behandelt und nur an die Beratungsperson weitergegeben.
          </div>

          <form className="cb-form" onSubmit={handleSubmit}>
            <div className="cb-form__group">
              <label htmlFor="cb-name">Name *</label>
              <input
                id="cb-name"
                type="text"
                value={formData.student_name}
                onChange={e => setFormData({ ...formData, student_name: e.target.value })}
                placeholder="Dein vollständiger Name"
                required
              />
            </div>

            <div className="cb-form__group">
              <label htmlFor="cb-class">Klasse / Kurs</label>
              <input
                id="cb-class"
                type="text"
                value={formData.student_class}
                onChange={e => setFormData({ ...formData, student_class: e.target.value })}
                placeholder="z.B. 10a, BG22"
              />
            </div>

            <div className="cb-form__group">
              <label htmlFor="cb-email">E-Mail (optional)</label>
              <input
                id="cb-email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="Für Terminbestätigung"
              />
              <span className="cb-form__hint">Falls du eine Bestätigung erhalten möchtest</span>
            </div>

            <div className="cb-form__group">
              <label htmlFor="cb-topic">{config.topicLabel}</label>
              <select
                id="cb-topic"
                value={formData.topic_id}
                onChange={e => setFormData({ ...formData, topic_id: e.target.value })}
              >
                <option value="">-- Bitte wählen --</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="cb-form__group">
              <label htmlFor="cb-concern">Kurze Beschreibung (optional)</label>
              <textarea
                id="cb-concern"
                value={formData.concern}
                onChange={e => setFormData({ ...formData, concern: e.target.value })}
                placeholder="Worum geht es ungefähr? (Wird nur der Beratungsperson gezeigt)"
                maxLength={500}
              />
            </div>

            <label className="cb-form__urgent">
              <input
                type="checkbox"
                checked={formData.is_urgent}
                onChange={e => setFormData({ ...formData, is_urgent: e.target.checked })}
              />
              Dringend -- Ich brauche möglichst schnell Hilfe
            </label>

            <div className="cb-actions">
              <button className="btn-secondary" type="button" onClick={() => setStep('datetime')}>
                Zurück
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
        <div className="cb-success">
          <div className="cb-success__icon">&#10003;</div>
          <h2>Termin angefragt!</h2>
          <p>Deine Anfrage wurde erfolgreich übermittelt.</p>
          {selectedCounselor && (
            <dl className="cb-success__details">
              <dt>{config.successCounselorLabel}</dt>
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
            </dl>
          )}
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
            {config.successMessage}
          </p>
          <div className="cb-actions" style={{ justifyContent: 'center', marginTop: '1rem' }}>
            <button className="btn-primary" onClick={handleReset}>
              Neuen Termin buchen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
