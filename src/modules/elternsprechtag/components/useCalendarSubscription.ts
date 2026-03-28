/**
 * Shared Hook für Kalender-Abo-Status und -Aktionen.
 * Wird von CalendarSetupBanner und CalendarStatusFooter gemeinsam genutzt.
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';

type SubState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'expired'; createdAt: string; expiresAt: string }
  | { kind: 'created'; token: string; createdAt: string; expiresAt: string }
  | { kind: 'active'; createdAt: string; expiresAt: string };

const DISMISS_KEY = 'calendar-banner-dismissed';

export function useCalendarSubscription() {
  const [state, setState] = useState<SubState>({ kind: 'loading' });
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.teacher.getCalendarToken();
      if (!data || !data.exists) {
        setState(data?.isExpired
          ? { kind: 'expired', createdAt: data.createdAt, expiresAt: data.expiresAt }
          : { kind: 'none' });
      } else {
        setState({ kind: 'active', createdAt: data.createdAt, expiresAt: data.expiresAt });
      }
    } catch {
      setState({ kind: 'none' });
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const isActive = state.kind === 'active' || state.kind === 'created';
  const isExpired = state.kind === 'expired';
  const isLoading = state.kind === 'loading';

  const expiresAt = (state.kind === 'active' || state.kind === 'created' || state.kind === 'expired')
    ? state.expiresAt : undefined;

  // Ablauf-Warnung: < 14 Tage
  const expiresSoon = expiresAt
    ? (new Date(expiresAt).getTime() - Date.now()) < 14 * 24 * 60 * 60 * 1000
    : false;

  const token = state.kind === 'created' ? state.token : undefined;

  const buildUrl = (t: string) =>
    `${window.location.origin}/api/calendar/${t}/elternsprechtag.ics`;
  const buildWebcalUrl = (t: string) =>
    `webcal://${window.location.host}/api/calendar/${t}/elternsprechtag.ics`;

  const handleCreate = useCallback(async () => {
    setError('');
    try {
      const data = await api.teacher.createCalendarToken();
      setState({ kind: 'created', token: data.token, createdAt: data.createdAt, expiresAt: data.expiresAt });
      localStorage.removeItem(DISMISS_KEY);
      setDismissed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Erstellen');
    }
  }, []);

  const handleRotate = useCallback(async () => {
    setError('');
    try {
      const data = await api.teacher.rotateCalendarToken();
      setState({ kind: 'created', token: data.token, createdAt: data.createdAt, expiresAt: data.expiresAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Erneuern');
    }
  }, []);

  const handleDelete = useCallback(async () => {
    setError('');
    try {
      await api.teacher.deleteCalendarToken();
      setState({ kind: 'none' });
      localStorage.removeItem(DISMISS_KEY);
      setDismissed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Deaktivieren');
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }, []);

  return {
    state, isActive, isExpired, isLoading, expiresAt, expiresSoon,
    token, error, dismissed,
    buildUrl, buildWebcalUrl,
    handleCreate, handleRotate, handleDelete, dismiss,
  };
}
