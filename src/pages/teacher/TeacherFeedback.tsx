import { useState } from 'react';
import api from '../../services/api';

export function TeacherFeedback() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async () => {
    setError('');
    setNotice('');

    const trimmed = message.trim();
    if (!trimmed) {
      setError('Bitte eine Nachricht eingeben.');
      return;
    }
    if (trimmed.length > 2000) {
      setError('Nachricht darf maximal 2000 Zeichen lang sein.');
      return;
    }

    try {
      setSending(true);
      await api.teacher.submitFeedback(trimmed);
      setMessage('');
      setNotice('Vielen Dank! Feedback wurde anonym übermittelt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback konnte nicht gesendet werden.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {(error || notice) && (
        <div className={error ? 'admin-error' : 'admin-success'} style={{ marginBottom: 16 }}>
          {error || notice}
          <button
            onClick={() => {
              setError('');
              setNotice('');
            }}
            style={{ marginLeft: 12 }}
            className="back-button"
          >
            Schließen
          </button>
        </div>
      )}

      <section className="admin-section">
        <div className="stat-card" style={{ maxWidth: 860 }}>
          <h2 style={{ marginTop: 0 }}>Feedback senden</h2>
          <p style={{ marginTop: 6, marginBottom: 12, color: '#555', lineHeight: 1.35 }}>
            Ihre Nachricht wird anonym an die Administration weitergeleitet.
          </p>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label htmlFor="teacherFeedbackMessage">Nachricht</label>
            <textarea
              id="teacherFeedbackMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Was klappt gut? Was fehlt? Was sollten wir verbessern?"
              disabled={sending}
              rows={6}
              style={{ width: '100%', padding: '10px 12px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn-primary" onClick={handleSubmit} disabled={sending}>
              {sending ? 'Senden…' : 'Anonym senden'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setMessage('')} disabled={sending}>
              Leeren
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
