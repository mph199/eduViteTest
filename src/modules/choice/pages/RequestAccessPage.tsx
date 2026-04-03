import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../services/api';
import '../choice-form.css';

export function RequestAccessPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [groupId, setGroupId] = useState(searchParams.get('group') || '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !groupId.trim()) return;

    setStatus('loading');
    try {
      const result = await api.choicePublic.requestAccess(email.trim(), groupId.trim());
      setStatus('success');
      setMessage(result?.message || 'Falls die E-Mail-Adresse bekannt ist, wurde ein neuer Zugangslink gesendet.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Fehler beim Anfordern des Zugangslinks.');
    }
  };

  return (
    <div className="cf-access-page">
      <h2 className="cf-access-page__title">Neuen Zugangslink anfordern</h2>
      <p className="cf-access-page__intro">
        Geben Sie Ihre E-Mail-Adresse ein, um einen neuen Link zur Differenzierungswahl zu erhalten.
      </p>

      {status === 'success' ? (
        <div className="cf-access-page__success">
          <p>{message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="cf-access-page__field">
            <label className="cf-access-page__label">E-Mail-Adresse</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="cf-access-page__input"
            />
          </div>
          <div className="cf-access-page__field">
            <label className="cf-access-page__label">Wahl-ID</label>
            <input
              type="text"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              required
              placeholder="Wird normalerweise automatisch ausgefüllt"
              className="cf-access-page__input"
            />
          </div>
          {status === 'error' && (
            <p className="cf-access-page__error">{message}</p>
          )}
          <button type="submit" disabled={status === 'loading'} className="cf-access-page__submit">
            {status === 'loading' ? 'Wird gesendet...' : 'Zugangslink anfordern'}
          </button>
        </form>
      )}
    </div>
  );
}
