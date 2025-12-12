import { useEffect, useState } from 'react';

export function VerifyEmail() {
  const token = new URLSearchParams(window.location.search).get('token');

  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>(() => (token ? 'idle' : 'error'));
  const [message, setMessage] = useState<string>(() => (token ? '' : 'Ungültiger Link.'));

  useEffect(() => {
    if (!token) return;
    fetch(`/api/bookings/verify/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (r.ok) {
          setStatus('ok');
          setMessage(data.message || 'E-Mail bestätigt.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Verifikation fehlgeschlagen.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Verifikation fehlgeschlagen.');
      });
  }, [token]);

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '24px', background: 'white', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h2>E-Mail-Verifikation</h2>
      {status === 'idle' && <p>Bitte warten…</p>}
      {status === 'ok' && <p style={{ color: 'green' }}>{message}</p>}
      {status === 'error' && <p style={{ color: 'crimson' }}>{message}</p>}
    </div>
  );
}
