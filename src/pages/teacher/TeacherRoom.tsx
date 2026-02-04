import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import type { TeacherOutletContext } from './TeacherLayout';

export function TeacherRoom() {
  const { teacher, refreshTeacher } = useOutletContext<TeacherOutletContext>();

  const [roomDraft, setRoomDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setRoomDraft(teacher?.room || '');
  }, [teacher?.room]);

  const handleSave = async () => {
    setError('');
    setNotice('');

    const next = roomDraft.trim();
    if (next.length > 60) {
      setError('Raum darf maximal 60 Zeichen lang sein.');
      return;
    }

    try {
      setSaving(true);
      await api.teacher.updateRoom(next.length ? next : null);
      await refreshTeacher();
      setNotice('Raum gespeichert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern des Raums');
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
          <h2 style={{ marginTop: 0 }}>Raum ändern</h2>
          <p style={{ marginTop: 6, color: '#555', lineHeight: 1.35 }}>
            Hinweis: Räume sollten nur geändert werden, wenn dies zuvor mit dem Sekretariat abgestimmt wurde.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="z.B. B204"
              value={roomDraft}
              onChange={(e) => setRoomDraft(e.target.value)}
              style={{ padding: '8px 10px', flex: '1 1 260px', minWidth: 220 }}
              aria-label="Neuer Raum"
              disabled={saving}
              autoFocus
            />
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRoomDraft(teacher?.room || '')}
              disabled={saving}
            >
              Zurücksetzen
            </button>
          </div>

          <div style={{ marginTop: 12, color: '#555' }}>
            Aktuell: <strong>{teacher?.room?.trim() ? teacher.room : 'nicht gesetzt'}</strong>
          </div>
        </div>
      </section>
    </>
  );
}
