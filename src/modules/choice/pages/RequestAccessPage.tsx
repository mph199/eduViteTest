import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../services/api';

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
    <div style={{ maxWidth: '420px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>Neuen Zugangslink anfordern</h2>
      <p style={{ marginBottom: '1.5rem', color: 'var(--color-gray-600)', fontSize: '0.9rem' }}>
        Geben Sie Ihre E-Mail-Adresse ein, um einen neuen Link zur Differenzierungswahl zu erhalten.
      </p>

      {status === 'success' ? (
        <div style={{ padding: '1rem', background: 'var(--color-gray-50)', borderRadius: '8px' }}>
          <p>{message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>E-Mail-Adresse</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-gray-300)' }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Wahl-ID</label>
            <input
              type="text"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              required
              placeholder="Wird normalerweise automatisch ausgefüllt"
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-gray-300)' }}
            />
          </div>
          {status === 'error' && (
            <p style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>{message}</p>
          )}
          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--brand-primary)',
              color: 'var(--color-white)',
              border: 'none',
              borderRadius: '4px',
              cursor: status === 'loading' ? 'wait' : 'pointer',
              fontWeight: 500,
            }}
          >
            {status === 'loading' ? 'Wird gesendet...' : 'Zugangslink anfordern'}
          </button>
        </form>
      )}
    </div>
  );
}
