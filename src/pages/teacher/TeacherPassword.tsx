import { useState } from 'react';
import api from '../../services/api';

export function TeacherPassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleChangePassword = async () => {
    setError('');
    setNotice('');

    if (!currentPassword || !newPassword) {
      setError('Bitte aktuelles und neues Passwort eingeben.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Neues Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    try {
      setSaving(true);
      await api.teacher.changePassword(currentPassword, newPassword);
      setNotice('Passwort erfolgreich geändert.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Ändern des Passworts');
    } finally {
      setSaving(false);
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
        <div className="stat-card" style={{ maxWidth: 720 }}>
          <h2 style={{ marginTop: 0 }}>Passwort ändern</h2>
          <p style={{ marginTop: 6, color: '#555', lineHeight: 1.35 }}>
            Tipp: Verwenden Sie ein langes Passwort (mindestens 8 Zeichen).
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="password"
              placeholder="Aktuelles Passwort"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{ padding: 8, flex: '1 1 260px', minWidth: 220 }}
              disabled={saving}
              autoComplete="current-password"
            />
            <input
              type="password"
              placeholder="Neues Passwort (min. 8 Zeichen)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ padding: 8, flex: '1 1 260px', minWidth: 220 }}
              disabled={saving}
              autoComplete="new-password"
            />
            <button onClick={handleChangePassword} className="btn-primary" disabled={saving}>
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
