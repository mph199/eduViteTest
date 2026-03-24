import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import type { CalendarTokenStatus, CalendarTokenCreated } from '../../../types';
import './CalendarSubscription.css';

type State =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'created'; token: string; createdAt: string; expiresAt: string }
  | { kind: 'active'; createdAt: string; expiresAt: string }
  | { kind: 'expired'; createdAt: string; expiresAt: string };

export function CalendarSubscription() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setError('');
      const data = (await api.teacher.getCalendarToken()) as CalendarTokenStatus | null;
      if (!data || !data.exists) {
        if (data?.expired) {
          setState({ kind: 'expired', createdAt: data.createdAt || '', expiresAt: data.expiresAt || '' });
        } else {
          setState({ kind: 'none' });
        }
        return;
      }
      setState({ kind: 'active', createdAt: data.createdAt || '', expiresAt: data.expiresAt || '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      setState({ kind: 'none' });
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const buildUrl = (token: string) =>
    `${window.location.origin}/api/calendar/${token}/elternsprechtag.ics`;

  const buildWebcalUrl = (token: string) =>
    `webcal://${window.location.host}/api/calendar/${token}/elternsprechtag.ics`;

  const handleCreate = async () => {
    try {
      setError('');
      const data = (await api.teacher.createCalendarToken()) as CalendarTokenCreated;
      setState({ kind: 'created', token: data.token, createdAt: data.createdAt, expiresAt: data.expiresAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    }
  };

  const handleRotate = async () => {
    const ok = window.confirm(
      'Die alte URL wird ungültig. Alle bestehenden Kalender-Abos müssen neu eingerichtet werden. Fortfahren?'
    );
    if (!ok) return;
    try {
      setError('');
      const data = (await api.teacher.rotateCalendarToken()) as CalendarTokenCreated;
      setState({ kind: 'created', token: data.token, createdAt: data.createdAt, expiresAt: data.expiresAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erneuern');
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm('Kalender-Abo wirklich deaktivieren? Bestehende Abos funktionieren dann nicht mehr.');
    if (!ok) return;
    try {
      setError('');
      await api.teacher.deleteCalendarToken();
      setState({ kind: 'none' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Deaktivieren');
    }
  };

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(buildUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError('Kopieren fehlgeschlagen. Bitte manuell markieren und kopieren.');
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '–';
    try {
      return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  if (state.kind === 'loading') return null;

  return (
    <div className="calendar-sub">
      <h3 className="calendar-sub__title">Kalender-Abo</h3>

      {error && (
        <div className="admin-error" style={{ marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Zustand 1: Kein Token */}
      {state.kind === 'none' && (
        <>
          <p className="calendar-sub__hint calendar-sub__hint--dsgvo">
            Die Abo-URL enthält personenbezogene Daten (abgekürzte Namen, Klassen).
            Binden Sie die URL nur in Ihren privaten Kalender ein und teilen Sie sie nicht mit Dritten.
          </p>
          <div className="calendar-sub__actions">
            <button className="btn-primary" onClick={handleCreate}>
              Kalender-Abo erstellen
            </button>
          </div>
        </>
      )}

      {/* Zustand 2: Gerade erstellt / rotiert — URL einmalig sichtbar */}
      {state.kind === 'created' && (
        <>
          <p className="calendar-sub__hint calendar-sub__hint--warn">
            Diese URL wird aus Sicherheitsgründen nicht erneut angezeigt. Bitte jetzt kopieren.
          </p>
          <div className="calendar-sub__url-row">
            <input
              className="calendar-sub__url-input"
              readOnly
              value={buildUrl(state.token)}
              onFocus={(e) => e.target.select()}
            />
            <button className="btn-secondary" onClick={() => handleCopy(state.token)}>
              Kopieren
            </button>
          </div>
          {copied && <span className="calendar-sub__copied">Kopiert</span>}
          <div className="calendar-sub__actions">
            <a
              href={buildWebcalUrl(state.token)}
              className="btn-secondary"
              style={{ textDecoration: 'none' }}
            >
              In Kalender-App öffnen
            </a>
          </div>
          <p className="calendar-sub__hint">
            Erstellt am {formatDate(state.createdAt)} – läuft ab am {formatDate(state.expiresAt)}
          </p>
        </>
      )}

      {/* Zustand 3: Token aktiv, URL nicht mehr sichtbar */}
      {state.kind === 'active' && (
        <>
          <p className="calendar-sub__status">
            Kalender-Abo aktiv seit {formatDate(state.createdAt)}.
            Läuft ab am {formatDate(state.expiresAt)}.
          </p>
          <p className="calendar-sub__hint">
            URL aus Sicherheitsgründen nicht erneut anzeigbar.
          </p>
          <div className="calendar-sub__actions">
            <button className="btn-secondary" onClick={handleRotate}>
              Neu erzeugen
            </button>
            <button className="cancel-button" onClick={handleDelete}>
              Deaktivieren
            </button>
          </div>
        </>
      )}

      {/* Zustand 4: Token abgelaufen */}
      {state.kind === 'expired' && (
        <>
          <p className="calendar-sub__status calendar-sub__status--expired">
            Kalender-Abo abgelaufen seit {formatDate(state.expiresAt)}.
          </p>
          <p className="calendar-sub__hint calendar-sub__hint--dsgvo">
            Die Abo-URL enthält personenbezogene Daten (abgekürzte Namen, Klassen).
            Binden Sie die URL nur in Ihren privaten Kalender ein und teilen Sie sie nicht mit Dritten.
          </p>
          <div className="calendar-sub__actions">
            <button className="btn-primary" onClick={handleCreate}>
              Neues Abo erstellen
            </button>
          </div>
        </>
      )}
    </div>
  );
}
