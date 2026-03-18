import { useState } from 'react';
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
  const [expanded, setExpanded] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const initial = getAvatarInitial(user.fullName, user.username);
  const color = getAvatarColor(user.username);
  const displayName = user.fullName || user.username;
  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const canChangePw = Boolean(user.teacherId);

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
    <div className="sidebarProfile">
      <button
        type="button"
        className="sidebarProfile__trigger"
        aria-expanded={expanded}
        aria-controls="sidebarProfile-panel"
        aria-label={`Profil von ${displayName}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="sidebarProfile__avatar" style={{ background: color }}>
          <span className="sidebarProfile__initial">{initial}</span>
        </div>
        <div className="sidebarProfile__meta">
          <div className="sidebarProfile__name">{displayName}</div>
          <div className="sidebarProfile__role">{roleLabel}</div>
        </div>
        <svg className="sidebarProfile__chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {expanded && (
        <div id="sidebarProfile-panel" className="sidebarProfile__panel">
          {/* User info */}
          <div className="sidebarProfile__info">
            <span className="sidebarProfile__infoLabel">Benutzername</span>
            <span className="sidebarProfile__infoValue">{user.username}</span>
          </div>

          {user.fullName && (
            <div className="sidebarProfile__info">
              <span className="sidebarProfile__infoLabel">Name</span>
              <span className="sidebarProfile__infoValue">{user.fullName}</span>
            </div>
          )}

          <div className="sidebarProfile__info">
            <span className="sidebarProfile__infoLabel">Rolle</span>
            <span className="sidebarProfile__infoValue">{roleLabel}</span>
          </div>

          {/* Password change (only for teachers) */}
          {canChangePw && (
            <>
              <div className="sidebarProfile__divider" />
              <button
                type="button"
                className="sidebarProfile__pwToggle"
                aria-expanded={pwOpen}
                onClick={() => { setPwOpen((v) => !v); setPwMsg(null); }}
              >
                Passwort aendern
              </button>

              {pwOpen && (
                <form
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
                  <button
                    type="submit"
                    className="sidebarProfile__pwSubmit"
                    disabled={pwSaving}
                  >
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
            </>
          )}

          <div className="sidebarProfile__divider" />

          {/* Action buttons */}
          <button
            type="button"
            className="sidebarProfile__action"
            onClick={() => onNavigate('/')}
          >
            Zur Buchungsseite
          </button>
          <button
            type="button"
            className="sidebarProfile__action sidebarProfile__action--danger"
            onClick={onLogout}
          >
            Abmelden
          </button>
        </div>
      )}
    </div>
  );
}
