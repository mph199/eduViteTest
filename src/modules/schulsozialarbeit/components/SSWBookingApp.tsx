import { useState, useEffect, useCallback } from 'react';
import './SSWBookingApp.css';

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

interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
}

interface AppointmentSlot {
  id: number;
  date: string;
  time: string;
  duration_minutes: number;
}

type Step = 'counselor' | 'datetime' | 'form' | 'success';

export function SSWBookingApp() {
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    category_id: '',
    is_urgent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [, setBookedAppointment] = useState<any>(null);

  // Load counselors and categories
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/ssw/counselors`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API_BASE}/ssw/categories`, { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([cData, catData]) => {
        setCounselors(cData.counselors || []);
        setCategories(catData.categories || []);
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
        `${API_BASE}/ssw/appointments/${counselorId}?date=${encodeURIComponent(date)}`,
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

    if (!formData.student_name.trim()) {
      alert('Bitte gib deinen Namen ein.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/ssw/appointments/${selectedSlot.id}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          category_id: formData.category_id ? parseInt(formData.category_id) : null,
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
    setStep('counselor');
    setSelectedCounselor(null);
    setSelectedDate('');
    setAvailableSlots([]);
    setSelectedSlot(null);
    setBookedAppointment(null);
    setFormData({ student_name: '', student_class: '', email: '', phone: '', concern: '', category_id: '', is_urgent: false });
  };

  // Today as min date
  const today = new Date().toISOString().slice(0, 10);

  // Step indicators
  const steps: { key: Step; label: string }[] = [
    { key: 'counselor', label: 'Berater/in' },
    { key: 'datetime', label: 'Termin' },
    { key: 'form', label: 'Angaben' },
    { key: 'success', label: 'Fertig' },
  ];

  const stepIndex = steps.findIndex(s => s.key === step);

  if (loading) return <div className="ssw-loading">Lade Beratungsangebote…</div>;
  if (error) return <div className="ssw-app"><p style={{ color: 'var(--color-error, red)' }}>{error}</p></div>;

  return (
    <div className="ssw-app">
      <h1>Schulsozialarbeit</h1>
      <p className="ssw-app__subtitle">Buche einen vertraulichen Beratungstermin.</p>

      {/* Step indicator */}
      <div className="ssw-steps">
        {steps.map((s, i) => (
          <div
            key={s.key}
            className={`ssw-step${i === stepIndex ? ' ssw-step--active' : ''}${i < stepIndex ? ' ssw-step--done' : ''}`}
          >
            <span className="ssw-step__num">{i < stepIndex ? '✓' : i + 1}</span>
            {s.label}
          </div>
        ))}
      </div>

      {/* Step: Select Counselor */}
      {step === 'counselor' && (
        <>
          <div className="ssw-confidential-notice">
            Alle Beratungsgespräche sind <strong>vertraulich</strong>. Deine Angaben werden nur an die gewählte Beratungsperson weitergegeben.
          </div>
          {counselors.length === 0 ? (
            <p className="ssw-empty">Derzeit sind keine Berater/innen verfügbar.</p>
          ) : (
            <div className="ssw-counselors">
              {counselors.map(c => (
                <div
                  key={c.id}
                  className={`ssw-counselor-card${selectedCounselor?.id === c.id ? ' ssw-counselor-card--selected' : ''}`}
                  onClick={() => handleSelectCounselor(c)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectCounselor(c); } }}
                >
                  <div className="ssw-counselor-card__name">
                    {c.salutation ? `${c.salutation} ` : ''}{c.name}
                  </div>
                  <div className="ssw-counselor-card__meta">
                    {c.room && <>📍 Raum {c.room}</>}
                    {c.room && c.available_from && <> · </>}
                    {c.available_from && <>🕐 {c.available_from?.toString().slice(0, 5)} – {c.available_until?.toString().slice(0, 5)} Uhr</>}
                  </div>
                  {c.specializations && (
                    <div className="ssw-counselor-card__specs">
                      {c.specializations.split(',').map((s, i) => (
                        <span key={i} className="ssw-counselor-card__spec">{s.trim()}</span>
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

          <div className="ssw-date-section">
            <label htmlFor="ssw-date">Datum wählen</label>
            <input
              id="ssw-date"
              type="date"
              className="ssw-date-input"
              value={selectedDate}
              min={today}
              onChange={e => handleDateChange(e.target.value)}
            />
          </div>

          {selectedDate && (
            <>
              {slotsLoading ? (
                <p className="ssw-loading">Lade verfügbare Zeiten…</p>
              ) : availableSlots.length === 0 ? (
                <p className="ssw-empty">Keine freien Termine an diesem Tag. Bitte ein anderes Datum wählen.</p>
              ) : (
                <>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Verfügbare Zeiten:</p>
                  <div className="ssw-slots">
                    {availableSlots.map(slot => (
                      <button
                        key={slot.id}
                        className={`ssw-slot${selectedSlot?.id === slot.id ? ' ssw-slot--selected' : ''}`}
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

          <div className="ssw-actions">
            <button className="btn-secondary" onClick={() => setStep('counselor')}>
              ← Zurück
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

          <div className="ssw-confidential-notice">
            Deine Angaben werden vertraulich behandelt und nur an die Beratungsperson weitergegeben.
          </div>

          <form className="ssw-form" onSubmit={handleSubmit}>
            <div className="ssw-form__group">
              <label htmlFor="ssw-name">Name *</label>
              <input
                id="ssw-name"
                type="text"
                value={formData.student_name}
                onChange={e => setFormData({ ...formData, student_name: e.target.value })}
                placeholder="Dein vollständiger Name"
                required
              />
            </div>

            <div className="ssw-form__group">
              <label htmlFor="ssw-class">Klasse / Kurs</label>
              <input
                id="ssw-class"
                type="text"
                value={formData.student_class}
                onChange={e => setFormData({ ...formData, student_class: e.target.value })}
                placeholder="z.B. 10a, BG22"
              />
            </div>

            <div className="ssw-form__group">
              <label htmlFor="ssw-email">E-Mail (optional)</label>
              <input
                id="ssw-email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="Für Terminbestätigung"
              />
              <span className="ssw-form__hint">Falls du eine Bestätigung erhalten möchtest</span>
            </div>

            <div className="ssw-form__group">
              <label htmlFor="ssw-category">Thema</label>
              <select
                id="ssw-category"
                value={formData.category_id}
                onChange={e => setFormData({ ...formData, category_id: e.target.value })}
              >
                <option value="">– Bitte wählen –</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ssw-form__group">
              <label htmlFor="ssw-concern">Kurze Beschreibung (optional)</label>
              <textarea
                id="ssw-concern"
                value={formData.concern}
                onChange={e => setFormData({ ...formData, concern: e.target.value })}
                placeholder="Worum geht es ungefähr? (Wird nur der Beratungsperson gezeigt)"
                maxLength={500}
              />
            </div>

            <label className="ssw-form__urgent">
              <input
                type="checkbox"
                checked={formData.is_urgent}
                onChange={e => setFormData({ ...formData, is_urgent: e.target.checked })}
              />
              Dringend – Ich brauche möglichst schnell Hilfe
            </label>

            <div className="ssw-actions">
              <button className="btn-secondary" type="button" onClick={() => setStep('datetime')}>
                ← Zurück
              </button>
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Wird gebucht…' : 'Termin anfragen'}
              </button>
            </div>
          </form>
        </>
      )}

      {/* Step: Success */}
      {step === 'success' && (
        <div className="ssw-success">
          <div className="ssw-success__icon">&#10003;</div>
          <h2>Termin angefragt!</h2>
          <p>Deine Anfrage wurde erfolgreich übermittelt.</p>
          {selectedCounselor && (
            <dl className="ssw-success__details">
              <dt>Berater/in</dt>
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
            Die Beratungsperson wird sich bei dir melden, um den Termin zu bestätigen.
          </p>
          <div className="ssw-actions" style={{ justifyContent: 'center', marginTop: '1rem' }}>
            <button className="btn-primary" onClick={handleReset}>
              Neuen Termin buchen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
