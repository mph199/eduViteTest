import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../../services/api';

export function VerifyPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !groupId) {
      setStatus('error');
      setError('Ungültiger Link.');
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const result = await api.choicePublic.verify(token!);
        if (cancelled) return;
        if (result?.success) {
          navigate(`/wahl/${result.groupId}`, { replace: true });
        } else {
          setStatus('error');
          setError('Verifizierung fehlgeschlagen.');
        }
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verifizierung fehlgeschlagen.');
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [token, groupId, navigate]);

  if (status === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p>Verifizierung läuft...</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <h2>Verifizierung fehlgeschlagen</h2>
      <p style={{ color: 'var(--color-error)', marginTop: '1rem' }}>{error}</p>
      <p style={{ marginTop: '1.5rem' }}>
        <a href="/wahl/zugang" style={{ color: 'var(--brand-primary)' }}>
          Neuen Zugangslink anfordern
        </a>
      </p>
    </div>
  );
}
