import { useState } from 'react';
import './BLAnonymousRequest.css';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

interface Counselor {
  id: number;
  name: string;
  salutation?: string;
}

interface Topic {
  id: number;
  name: string;
  description?: string;
}

interface StatusResult {
  status: string;
  response?: string;
  responded_at?: string;
  topic_name?: string;
  created_at?: string;
}

interface BLAnonymousRequestProps {
  counselors: Counselor[];
  topics: Topic[];
  onBack: () => void;
}

export function BLAnonymousRequest({ counselors, topics, onBack }: BLAnonymousRequestProps) {
  const [formData, setFormData] = useState({
    counselor_id: '',
    topic_id: '',
    message: '',
    contact_method: 'none',
    contact_info: '',
    is_urgent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  // Status check
  const [checkToken, setCheckToken] = useState('');
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null);
  const [statusError, setStatusError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.message.trim()) {
      alert('Bitte beschreibe dein Anliegen.');
      return;
    }
    if (formData.contact_method === 'email' && !formData.contact_info.trim()) {
      alert('Bitte gib eine E-Mail-Adresse an.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/bl/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          counselor_id: formData.counselor_id ? parseInt(formData.counselor_id) : null,
          topic_id: formData.topic_id ? parseInt(formData.topic_id) : null,
          message: formData.message.trim(),
          contact_method: formData.contact_method,
          contact_info: formData.contact_info.trim() || null,
          is_urgent: formData.is_urgent,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data as any)?.error || `Fehler ${res.status}`);
      }

      const data = await res.json();
      setAccessToken(data.access_token);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Absenden');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkToken.trim()) return;

    setChecking(true);
    setStatusError('');
    setStatusResult(null);
    try {
      const res = await fetch(`${API_BASE}/bl/requests/status/${encodeURIComponent(checkToken.trim())}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data as any)?.error || `Fehler ${res.status}`);
      }

      const data = await res.json();
      setStatusResult(data.request);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setChecking(false);
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'new': return 'Neu (noch nicht gelesen)';
      case 'read': return 'Gelesen';
      case 'in_progress': return 'In Bearbeitung';
      case 'answered': return 'Beantwortet';
      case 'closed': return 'Geschlossen';
      default: return s;
    }
  };

  // After successful submission — show token
  if (accessToken) {
    return (
      <div>
        <div className="bl-request-token">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#10003;</div>
          <h3>Anfrage gesendet!</h3>
          <p>Deine anonyme Anfrage wurde erfolgreich uebermittelt.</p>
          <p style={{ fontWeight: 600, marginTop: '1rem' }}>Dein Zugangscode:</p>
          <div className="bl-request-token__code">{accessToken}</div>
          <p className="bl-request-token__hint">
            Notiere diesen Code, um spaeter den Status deiner Anfrage abzurufen.
            Dieser Code wird nicht erneut angezeigt.
          </p>
        </div>

        <div className="bl-request-status">
          <h4 style={{ marginBottom: '0.5rem' }}>Status pruefen</h4>
          <form className="bl-request-status__form" onSubmit={handleCheckStatus}>
            <input
              type="text"
              value={checkToken || accessToken}
              onChange={e => setCheckToken(e.target.value)}
              placeholder="Zugangscode eingeben"
            />
            <button className="btn-primary" type="submit" disabled={checking}>
              {checking ? 'Pruefe...' : 'Pruefen'}
            </button>
          </form>
          {statusError && <p style={{ color: 'var(--color-error, red)', marginTop: '0.5rem' }}>{statusError}</p>}
          {statusResult && (
            <dl className="bl-request-status__result">
              <dt>Status</dt>
              <dd>{statusLabel(statusResult.status)}</dd>
              {statusResult.topic_name && (
                <>
                  <dt>Thema</dt>
                  <dd>{statusResult.topic_name}</dd>
                </>
              )}
              {statusResult.response && (
                <>
                  <dt>Antwort</dt>
                  <dd>{statusResult.response}</dd>
                  {statusResult.responded_at && (
                    <dd style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      Beantwortet am {new Date(statusResult.responded_at).toLocaleDateString('de-DE')}
                    </dd>
                  )}
                </>
              )}
            </dl>
          )}
        </div>

        <div className="bl-actions" style={{ marginTop: '1.5rem' }}>
          <button className="btn-secondary" onClick={onBack}>Zurueck zur Uebersicht</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bl-confidential-notice">
        Du kannst hier <strong>anonym</strong> eine Anfrage an einen Beratungslehrer stellen.
        Dein Name wird nicht gespeichert. Du erhaeltst einen Zugangscode, mit dem du den Status
        deiner Anfrage spaeter pruefen kannst.
      </div>

      <form className="bl-request-form" onSubmit={handleSubmit}>
        <div className="bl-request-form__group">
          <label htmlFor="bl-req-counselor">Beratungslehrer (optional)</label>
          <select
            id="bl-req-counselor"
            value={formData.counselor_id}
            onChange={e => setFormData({ ...formData, counselor_id: e.target.value })}
          >
            <option value="">-- Allgemein (kein bestimmter Berater) --</option>
            {counselors.map(c => (
              <option key={c.id} value={c.id}>
                {c.salutation ? `${c.salutation} ` : ''}{c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bl-request-form__group">
          <label htmlFor="bl-req-topic">Thema</label>
          <select
            id="bl-req-topic"
            value={formData.topic_id}
            onChange={e => setFormData({ ...formData, topic_id: e.target.value })}
          >
            <option value="">-- Bitte waehlen --</option>
            {topics.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="bl-request-form__group">
          <label htmlFor="bl-req-message">Dein Anliegen *</label>
          <textarea
            id="bl-req-message"
            value={formData.message}
            onChange={e => setFormData({ ...formData, message: e.target.value })}
            placeholder="Beschreibe, wobei du Hilfe brauchst..."
            maxLength={2000}
            required
          />
        </div>

        <div className="bl-request-form__group">
          <label>Wie moechtest du kontaktiert werden?</label>
          <div className="bl-request-form__radio-group">
            <label>
              <input
                type="radio"
                name="contact_method"
                value="none"
                checked={formData.contact_method === 'none'}
                onChange={() => setFormData({ ...formData, contact_method: 'none', contact_info: '' })}
              />
              Keine Antwort noetig / Ich pruefe den Status selbst
            </label>
            <label>
              <input
                type="radio"
                name="contact_method"
                value="email"
                checked={formData.contact_method === 'email'}
                onChange={() => setFormData({ ...formData, contact_method: 'email' })}
              />
              Per E-Mail
            </label>
            <label>
              <input
                type="radio"
                name="contact_method"
                value="note"
                checked={formData.contact_method === 'note'}
                onChange={() => setFormData({ ...formData, contact_method: 'note' })}
              />
              Per Codewort / Notiz
            </label>
          </div>
        </div>

        {formData.contact_method === 'email' && (
          <div className="bl-request-form__group">
            <label htmlFor="bl-req-email">E-Mail-Adresse</label>
            <input
              id="bl-req-email"
              type="email"
              value={formData.contact_info}
              onChange={e => setFormData({ ...formData, contact_info: e.target.value })}
              placeholder="Deine E-Mail-Adresse"
              required
            />
          </div>
        )}

        {formData.contact_method === 'note' && (
          <div className="bl-request-form__group">
            <label htmlFor="bl-req-code">Codewort oder Hinweis</label>
            <input
              id="bl-req-code"
              type="text"
              value={formData.contact_info}
              onChange={e => setFormData({ ...formData, contact_info: e.target.value })}
              placeholder="z.B. ein Codewort, das nur du kennst"
            />
            <span className="bl-form__hint">Der Beratungslehrer kann dir z.B. eine Nachricht am schwarzen Brett hinterlassen.</span>
          </div>
        )}

        <label className="bl-request-form__urgent">
          <input
            type="checkbox"
            checked={formData.is_urgent}
            onChange={e => setFormData({ ...formData, is_urgent: e.target.checked })}
          />
          Dringend -- Ich brauche moeglichst schnell Hilfe
        </label>

        <div className="bl-actions">
          <button className="btn-secondary" type="button" onClick={onBack}>
            Zurueck
          </button>
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Wird gesendet...' : 'Anfrage absenden'}
          </button>
        </div>
      </form>

      {/* Status check section */}
      <div className="bl-request-status">
        <h4 style={{ marginBottom: '0.5rem' }}>Bereits eine Anfrage gestellt? Status pruefen:</h4>
        <form className="bl-request-status__form" onSubmit={handleCheckStatus}>
          <input
            type="text"
            value={checkToken}
            onChange={e => setCheckToken(e.target.value)}
            placeholder="Zugangscode eingeben"
          />
          <button className="btn-primary" type="submit" disabled={checking}>
            {checking ? 'Pruefe...' : 'Pruefen'}
          </button>
        </form>
        {statusError && <p style={{ color: 'var(--color-error, red)', marginTop: '0.5rem' }}>{statusError}</p>}
        {statusResult && (
          <dl className="bl-request-status__result">
            <dt>Status</dt>
            <dd>{statusLabel(statusResult.status)}</dd>
            {statusResult.topic_name && (
              <>
                <dt>Thema</dt>
                <dd>{statusResult.topic_name}</dd>
              </>
            )}
            {statusResult.response && (
              <>
                <dt>Antwort</dt>
                <dd>{statusResult.response}</dd>
                {statusResult.responded_at && (
                  <dd style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Beantwortet am {new Date(statusResult.responded_at).toLocaleDateString('de-DE')}
                  </dd>
                )}
              </>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}
