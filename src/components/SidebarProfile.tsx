import { useState, useEffect, useCallback, useRef } from 'react';
import { getAvatarColor, getAvatarInitial } from '../utils/avatarColor';
import api from '../services/api';
import type { User } from '../contexts/AuthContextBase';
import './SidebarProfile.css';

interface SidebarProfileProps {
  user: User;
  onLogout: () => void;
  onNavigate: (path: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  teacher: 'Lehrkraft',
  ssw: 'Schulsozialarbeit',
  admin: 'Administrator',
  superadmin: 'Superadmin',
};

export function SidebarProfile({ user, onLogout, onNavigate }: SidebarProfileProps) {
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const initial = getAvatarInitial(user.fullName, user.username);
  const color = getAvatarColor(user.username);
  const displayName = user.fullName || user.username;
  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const canChangePw = Boolean(user.teacherId);

  const close = useCallback(() => {
    setOpen(false);
    setPwOpen(false);
    setPwMsg(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    popoverRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const handlePasswordChange = async () => {
    setPwMsg(null);
    if (!currentPw || !newPw) {
      setPwMsg({ text: 'Bitte aktuelles und neues Passwort eingeben.', ok: false });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ text: 'Neues Passwort muss mindestens 8 Zeichen lang sein.', ok: false });
      return;
    }
    try {
      setPwSaving(true);
      await api.teacher.changePassword(currentPw, newPw);
      setPwMsg({ text: 'Passwort erfolgreich geaendert.', ok: true });
      setCurrentPw('');
      setNewPw('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const known = ['Aktuelles Passwort ist falsch', 'Neues Passwort muss mindestens 8 Zeichen haben'];
      setPwMsg({
        text: known.some((k) => msg === k) ? msg : 'Fehler beim Aendern des Passworts.',
        ok: false,
      });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="sidebarProfile" ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        className="sidebarProfile__trigger"
        aria-expanded={open}
        aria-controls="sidebarProfile-panel"
        aria-label={`Profil von ${displayName}`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="sidebarProfile__triggerAvatar" style={{ background: color }}>
          <span className="sidebarProfile__triggerInitial">{initial}</span>
        </div>
        <div className="sidebarProfile__triggerMeta">
          <span className="sidebarProfile__triggerName">{displayName}</span>
          <span className="sidebarProfile__triggerRole">{roleLabel}</span>
        </div>
        <svg className="sidebarProfile__triggerChevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 10l4-4 4 4" />
        </svg>
      </button>

      {/* Backdrop + Popover */}
      {open && (
        <>
          <div className="sidebarProfile__backdrop" role="presentation" onClick={close} />
          <div id="sidebarProfile-panel" className="sidebarProfile__popover" role="dialog" aria-modal="true" aria-label="Profil-Menue" ref={popoverRef} tabIndex={-1}>

            {/* ── Header ── */}
            <div className="sidebarProfile__header">
              <div className="sidebarProfile__headerAvatar" style={{ background: color }}>
                <span className="sidebarProfile__headerInitial">{initial}</span>
              </div>
              <div className="sidebarProfile__headerMeta">
                <div className="sidebarProfile__headerName">{displayName}</div>
                <div className="sidebarProfile__badge">
                  <span className="sidebarProfile__badgeDot" />
                  <span className="sidebarProfile__badgeText">{roleLabel}</span>
                </div>
              </div>
            </div>

            {/* ── Info ── */}
            <div className="sidebarProfile__infoSection">
              <div className="sidebarProfile__infoRow">
                <span className="sidebarProfile__infoLabel">Benutzername</span>
                <span className="sidebarProfile__infoValue">{user.username}</span>
              </div>
              {user.fullName && (
                <div className="sidebarProfile__infoRow sidebarProfile__infoRow--border">
                  <span className="sidebarProfile__infoLabel">Name</span>
                  <span className="sidebarProfile__infoValue">{user.fullName}</span>
                </div>
              )}
            </div>

            {/* ── Actions ── */}
            <div className="sidebarProfile__actions">
              {canChangePw && (
                <button
                  type="button"
                  className="sidebarProfile__actionBtn"
                  aria-expanded={pwOpen}
                  aria-controls="sidebarProfile-pwForm"
                  onClick={() => { setPwOpen((v) => !v); setPwMsg(null); }}
                >
                  <span className="sidebarProfile__actionIcon sidebarProfile__actionIcon--lock">
                    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <span className="sidebarProfile__actionLabel">Passwort aendern</span>
                  <svg className="sidebarProfile__actionChevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                </button>
              )}

              {/* Password form (inline, below action) */}
              {canChangePw && pwOpen && (
                <form
                  id="sidebarProfile-pwForm"
                  className="sidebarProfile__pwForm"
                  onSubmit={(e) => { e.preventDefault(); void handlePasswordChange(); }}
                >
                  <input
                    id="sidebarProfile-currentPw"
                    type="password"
                    className="sidebarProfile__pwInput"
                    placeholder="Aktuelles Passwort"
                    aria-label="Aktuelles Passwort"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    disabled={pwSaving}
                    autoComplete="current-password"
                  />
                  <input
                    id="sidebarProfile-newPw"
                    type="password"
                    className="sidebarProfile__pwInput"
                    placeholder="Neues Passwort (min. 8 Zeichen)"
                    aria-label="Neues Passwort"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    disabled={pwSaving}
                    autoComplete="new-password"
                  />
                  <button type="submit" className="sidebarProfile__pwSubmit" disabled={pwSaving}>
                    {pwSaving ? 'Speichern...' : 'Speichern'}
                  </button>
                  {pwMsg && (
                    <div
                      className={`sidebarProfile__pwMsg ${pwMsg.ok ? 'sidebarProfile__pwMsg--ok' : 'sidebarProfile__pwMsg--err'}`}
                      role={pwMsg.ok ? 'status' : 'alert'}
                    >
                      {pwMsg.text}
                    </div>
                  )}
                </form>
              )}

              <button
                type="button"
                className="sidebarProfile__actionBtn"
                onClick={() => { onNavigate('/'); close(); }}
              >
                <span className="sidebarProfile__actionIcon sidebarProfile__actionIcon--calendar">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4H16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h1.25V2.75A.75.75 0 015.75 2zM4 7.5v8.5h12V7.5H4z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className="sidebarProfile__actionLabel">Zur Buchungsseite</span>
                <svg className="sidebarProfile__actionChevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </button>
            </div>

            {/* ── Footer / Logout ── */}
            <div className="sidebarProfile__footer">
              <button
                type="button"
                className="sidebarProfile__logoutBtn"
                onClick={() => { onLogout(); close(); }}
              >
                <svg className="sidebarProfile__logoutIcon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
                </svg>
                Abmelden
              </button>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
