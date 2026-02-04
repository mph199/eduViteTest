import { useEffect, useState } from 'react';
import api from '../services/api';

type CachedVerify = { status: 'pending' | 'ok' | 'error'; message?: string };

function readCached(storageKey: string): CachedVerify | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as CachedVerify;
  } catch {
    return null;
  }
}

export function VerifyEmail() {
  const token = new URLSearchParams(window.location.search).get('token');

  const initial = (() => {
    if (!token) return { status: 'error' as const, message: 'Ungültiger Link.' };

    const storageKey = `verifyEmail:${token}`;
    const cached = readCached(storageKey);
    if (cached?.status === 'ok') {
      return { status: 'ok' as const, message: cached.message || 'E-Mail bestätigt.' };
    }
    if (cached?.status === 'error') {
      return { status: 'error' as const, message: cached.message || 'Verifikation fehlgeschlagen.' };
    }
    return { status: 'idle' as const, message: '' };
  })();

  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>(initial.status);
  const [message, setMessage] = useState<string>(initial.message);

  useEffect(() => {
    if (!token) return;

    // In React StrictMode (dev) effects can run twice due to intentional remounting.
    // Verification links are one-time-use, so we cache the result per token in sessionStorage.
    const storageKey = `verifyEmail:${token}`;

    const cached = readCached(storageKey);
    // If already final, nothing to do (avoid setState in effect body)
    if (cached?.status === 'ok' || cached?.status === 'error') return;

    let cancelled = false;

    // If another mount already started the request, wait for its result.
    if (cached?.status === 'pending') {
      const startedAt = Date.now();
      const interval = window.setInterval(() => {
        const next = readCached(storageKey);
        if (next?.status === 'ok') {
          window.clearInterval(interval);
          if (!cancelled) {
            setStatus('ok');
            setMessage(next.message || 'E-Mail bestätigt.');
          }
        } else if (next?.status === 'error') {
          window.clearInterval(interval);
          if (!cancelled) {
            setStatus('error');
            setMessage(next.message || 'Verifikation fehlgeschlagen.');
          }
        } else if (Date.now() - startedAt > 10_000) {
          window.clearInterval(interval);
          if (!cancelled) {
            setStatus('error');
            setMessage('Verifikation dauert ungewöhnlich lange. Bitte Seite neu laden.');
          }
        }
      }, 250);

      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }

    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ status: 'pending' }));
    } catch {
      // ignore
    }

    api.bookings.verifyEmail(token)
      .then((data: unknown) => {
        const parsed = data as { message?: string };
        const nextMessage = parsed?.message || 'E-Mail bestätigt.';
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ status: 'ok', message: nextMessage }));
        } catch {
          // ignore
        }
        if (!cancelled) {
          setStatus('ok');
          setMessage(nextMessage);
        }
      })
      .catch((e: unknown) => {
        const nextMessage = e instanceof Error ? e.message : 'Verifikation fehlgeschlagen.';
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ status: 'error', message: nextMessage }));
        } catch {
          // ignore
        }
        if (!cancelled) {
          setStatus('error');
          setMessage(nextMessage);
        }
      });

    return () => {
      cancelled = true;
    };
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
