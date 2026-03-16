import type { ApiTeacher, BlFormData, TeacherFormData } from './types';
import { WEEKDAYS } from './types';

interface Props {
  formData: TeacherFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeacherFormData>>;
  blForm: BlFormData;
  setBlForm: React.Dispatch<React.SetStateAction<BlFormData>>;
  editingTeacher: ApiTeacher | null;
  blModuleActive: boolean;
  createdCreds: { username: string; tempPassword: string } | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function TeacherForm({ formData, setFormData, blForm, setBlForm, editingTeacher, blModuleActive, createdCreds, onSubmit, onCancel }: Props) {
  return (
    <div className="teacher-form-container">
      <h3>{editingTeacher ? 'Nutzer bearbeiten' : 'Neuen Nutzer anlegen'}</h3>
      <form onSubmit={onSubmit} className="teacher-form">
        <div className="form-group">
          <label htmlFor="salutation">Anrede</label>
          <select
            id="salutation"
            value={formData.salutation}
            onChange={(e) => setFormData({ ...formData, salutation: e.target.value as 'Herr' | 'Frau' | 'Divers' })}
            required
          >
            <option value="Herr">Herr</option>
            <option value="Frau">Frau</option>
            <option value="Divers">Divers</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="last_name">Nachname</label>
          <input
            id="last_name"
            type="text"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            placeholder="z.B. Mustermann"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="first_name">Vorname</label>
          <input
            id="first_name"
            type="text"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            placeholder="z.B. Max"
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">E-Mail</label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="z.B. vorname.nachname@schule.nrw"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="available_from">Sprechzeiten</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="available_from"
              type="time"
              value={formData.available_from}
              onChange={(e) => setFormData({ ...formData, available_from: e.target.value })}
              required
            />
            <span>bis</span>
            <input
              id="available_until"
              type="time"
              value={formData.available_until}
              onChange={(e) => setFormData({ ...formData, available_until: e.target.value })}
              required
            />
          </div>
        </div>
        {!editingTeacher && (
          <>
            <div className="form-group">
              <label htmlFor="username">Benutzername (optional)</label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="z.B. herrhuhn"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Passwort (optional, min. 8 Zeichen)</label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="z.B. sicherespasswort"
              />
            </div>
          </>
        )}
        {blModuleActive && (
          <details style={{ marginTop: '1rem', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={blForm.enabled}
                  onChange={(e) => setBlForm({ ...blForm, enabled: e.target.checked })}
                />
                Beratungslehrer
              </label>
            </summary>
            {blForm.enabled && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label htmlFor="bl_phone">Telefon</label>
                  <input
                    id="bl_phone"
                    type="text"
                    value={blForm.phone}
                    onChange={(e) => setBlForm({ ...blForm, phone: e.target.value })}
                    placeholder="z.B. 0221-12345"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="bl_specializations">Schwerpunkte</label>
                  <input
                    id="bl_specializations"
                    type="text"
                    value={blForm.specializations}
                    onChange={(e) => setBlForm({ ...blForm, specializations: e.target.value })}
                    placeholder="z.B. Lernberatung, Konfliktlösung"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="bl_slot_duration">Termindauer (Minuten)</label>
                  <input
                    id="bl_slot_duration"
                    type="number"
                    min={5}
                    max={120}
                    value={blForm.slot_duration_minutes}
                    onChange={(e) => setBlForm({ ...blForm, slot_duration_minutes: parseInt(e.target.value, 10) || 30 })}
                  />
                </div>
                <div className="form-group">
                  <label>Wochenplan</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {WEEKDAYS.map((day, i) => {
                      const entry = blForm.schedule[i];
                      return (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', minWidth: '8rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={entry.active}
                              onChange={(e) => {
                                const next = [...blForm.schedule];
                                next[i] = { ...entry, active: e.target.checked };
                                setBlForm({ ...blForm, schedule: next });
                              }}
                            />
                            {day}
                          </label>
                          {entry.active && (
                            <>
                              <input
                                type="time"
                                value={entry.start_time}
                                onChange={(e) => {
                                  const next = [...blForm.schedule];
                                  next[i] = { ...entry, start_time: e.target.value };
                                  setBlForm({ ...blForm, schedule: next });
                                }}
                                style={{ width: '6rem' }}
                              />
                              <span>bis</span>
                              <input
                                type="time"
                                value={entry.end_time}
                                onChange={(e) => {
                                  const next = [...blForm.schedule];
                                  next[i] = { ...entry, end_time: e.target.value };
                                  setBlForm({ ...blForm, schedule: next });
                                }}
                                style={{ width: '6rem' }}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </details>
        )}
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editingTeacher ? 'Speichern' : 'Anlegen'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Abbrechen
          </button>
        </div>
      </form>
      {!editingTeacher && createdCreds && (
        <div className="admin-success" style={{ marginTop: '1rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Login erstellt</div>
          <div><strong>Benutzername:</strong> {createdCreds.username}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span><strong>Temporäres Passwort:</strong> {createdCreds.tempPassword}</span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                try {
                  navigator.clipboard.writeText(createdCreds.tempPassword);
                  alert('Passwort kopiert');
                } catch {
                  // ignore
                }
              }}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
            >
              Kopieren
            </button>
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Bitte sicher weitergeben und nach dem ersten Login ändern.
          </div>
        </div>
      )}
    </div>
  );
}
