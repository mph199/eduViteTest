import { useState } from 'react';
import type { Teacher as ApiTeacher, BlFormData, SswFormData, TeacherFormData } from '../../types';
import { WEEKDAY_LABELS as WEEKDAYS } from '../../shared/constants/weekdays';

function normalizeForUsername(str: string): string {
  return str.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '');
}

interface Props {
  formData: TeacherFormData;
  setFormData: React.Dispatch<React.SetStateAction<TeacherFormData>>;
  blForm: BlFormData;
  setBlForm: React.Dispatch<React.SetStateAction<BlFormData>>;
  sswForm: SswFormData;
  setSswForm: React.Dispatch<React.SetStateAction<SswFormData>>;
  editingTeacher: ApiTeacher | null;
  blModuleActive: boolean;
  sswModuleActive: boolean;
  adminModules: string[];
  setAdminModules: (modules: string[]) => void;
  isSuperadmin: boolean;
  createdCreds: { username: string; tempPassword: string } | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const ADMIN_MODULE_OPTIONS = [
  { key: 'elternsprechtag', label: 'Eltern- und Ausbildersprechtag' },
  { key: 'schulsozialarbeit', label: 'Schulsozialarbeit' },
  { key: 'beratungslehrer', label: 'Beratungslehrkräfte' },
];

export function TeacherForm({ formData, setFormData, blForm, setBlForm, sswForm, setSswForm, editingTeacher, blModuleActive, sswModuleActive, adminModules, setAdminModules, isSuperadmin, createdCreds, onSubmit, onCancel }: Props) {
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);

  const updateNameAndSuggestUsername = (field: 'first_name' | 'last_name', value: string) => {
    const next = { ...formData, [field]: value };
    if (!usernameManuallyEdited && !editingTeacher) {
      const first = normalizeForUsername(field === 'first_name' ? value : formData.first_name);
      const last = normalizeForUsername(field === 'last_name' ? value : formData.last_name);
      next.username = first && last ? `${first}.${last}` : first || last;
    }
    setFormData(next);
  };
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
            onChange={(e) => updateNameAndSuggestUsername('last_name', e.target.value)}
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
            onChange={(e) => updateNameAndSuggestUsername('first_name', e.target.value)}
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
              <label htmlFor="username">Benutzername</label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => { setUsernameManuallyEdited(true); setFormData({ ...formData, username: e.target.value }); }}
                placeholder="z.B. max.mustermann"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Passwort (min. 8 Zeichen)</label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Mindestens 8 Zeichen"
                required
                minLength={8}
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
                Beratungslehrkraft
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
        {sswModuleActive && (
          <details style={{ marginTop: '1rem', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={sswForm.enabled}
                  onChange={(e) => setSswForm({ ...sswForm, enabled: e.target.checked })}
                />
                Schulsozialarbeit
              </label>
            </summary>
            {sswForm.enabled && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label htmlFor="ssw_room">Raum</label>
                  <input
                    id="ssw_room"
                    type="text"
                    value={sswForm.room}
                    onChange={(e) => setSswForm({ ...sswForm, room: e.target.value })}
                    placeholder="z.B. B2.04"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="ssw_phone">Telefon</label>
                  <input
                    id="ssw_phone"
                    type="text"
                    value={sswForm.phone}
                    onChange={(e) => setSswForm({ ...sswForm, phone: e.target.value })}
                    placeholder="z.B. 0221-12345"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="ssw_specializations">Schwerpunkte</label>
                  <input
                    id="ssw_specializations"
                    type="text"
                    value={sswForm.specializations}
                    onChange={(e) => setSswForm({ ...sswForm, specializations: e.target.value })}
                    placeholder="z.B. Sozialberatung, Krisenintervention"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="ssw_slot_duration">Termindauer (Minuten)</label>
                  <input
                    id="ssw_slot_duration"
                    type="number"
                    min={5}
                    max={120}
                    value={sswForm.slot_duration_minutes}
                    onChange={(e) => setSswForm({ ...sswForm, slot_duration_minutes: parseInt(e.target.value, 10) || 30 })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={sswForm.requires_confirmation}
                      onChange={(e) => setSswForm({ ...sswForm, requires_confirmation: e.target.checked })}
                    />
                    Terminbestätigung erforderlich
                  </label>
                </div>
                <div className="form-group">
                  <label>Wochenplan</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {WEEKDAYS.map((day, i) => {
                      const entry = sswForm.schedule[i];
                      return (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', minWidth: '8rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={entry.active}
                              onChange={(e) => {
                                const next = [...sswForm.schedule];
                                next[i] = { ...entry, active: e.target.checked };
                                setSswForm({ ...sswForm, schedule: next });
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
                                  const next = [...sswForm.schedule];
                                  next[i] = { ...entry, start_time: e.target.value };
                                  setSswForm({ ...sswForm, schedule: next });
                                }}
                                style={{ width: '6rem' }}
                              />
                              <span>bis</span>
                              <input
                                type="time"
                                value={entry.end_time}
                                onChange={(e) => {
                                  const next = [...sswForm.schedule];
                                  next[i] = { ...entry, end_time: e.target.value };
                                  setSswForm({ ...sswForm, schedule: next });
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
        {editingTeacher && isSuperadmin && (
          <details style={{ marginTop: '1rem', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Adminrechte
            </summary>
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-600)' }}>
                Modulspezifische Adminrechte vergeben. Benutzer mit Adminrechten können das jeweilige Modul verwalten, ohne Global-Admin zu sein.
              </p>
              {ADMIN_MODULE_OPTIONS.map(({ key, label }) => (
                <label key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={adminModules.includes(key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAdminModules([...adminModules, key]);
                      } else {
                        setAdminModules(adminModules.filter(m => m !== key));
                      }
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
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
              onClick={(e) => {
                try {
                  navigator.clipboard.writeText(createdCreds.tempPassword);
                  const btn = e.currentTarget;
                  const orig = btn.textContent;
                  btn.textContent = 'Kopiert!';
                  setTimeout(() => { btn.textContent = orig; }, 2000);
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
