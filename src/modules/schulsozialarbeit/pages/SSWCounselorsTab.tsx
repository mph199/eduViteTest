import { useState } from 'react';
import type { Counselor, ScheduleEntry } from '../../../types';
import api from '../../../services/api';
import { WEEKDAY_LABELS_FULL } from '../../../shared/constants/weekdays';
import { buildDefaultSchedule, mergeScheduleEntries } from '../../../shared/utils/schedule';

function defaultSchedule(): ScheduleEntry[] {
  return buildDefaultSchedule(
    WEEKDAY_LABELS_FULL.map((_, i) => i),
    wd => wd < 5,
  );
}

const emptyCounselor = {
  first_name: '',
  last_name: '',
  salutation: 'Frau',
  email: '',
  room: '',
  phone: '',
  specializations: '',
  available_from: '08:00',
  available_until: '14:00',
  slot_duration_minutes: 30,
  requires_confirmation: true,
  username: '',
  password: '',
};

interface Props {
  counselors: Counselor[];
  schedulesMap: Record<number, ScheduleEntry[]>;
  showFlash: (msg: string) => void;
  loadData: () => void;
  setCreatedCreds: (creds: { username: string; tempPassword: string } | null) => void;
}

export function SSWCounselorsTab({ counselors, schedulesMap, showFlash, loadData, setCreatedCreds }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyCounselor);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(defaultSchedule());
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const loadSchedule = async (counselorId: number) => {
    setScheduleLoading(true);
    try {
      const data = await api.ssw.getAdminCounselorSchedule(counselorId);
      const rows: ScheduleEntry[] = data?.schedule || [];
      setSchedule(rows.length > 0 ? mergeScheduleEntries(defaultSchedule(), rows) : defaultSchedule());
    } catch {
      setSchedule(defaultSchedule());
    } finally {
      setScheduleLoading(false);
    }
  };

  const saveSchedule = async (counselorId: number) => {
    await api.ssw.updateAdminCounselorSchedule(counselorId, schedule);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      showFlash('Vor- und Nachname sind Pflichtfelder.');
      return;
    }
    try {
      if (editingId) {
        await api.ssw.updateCounselor(editingId, form);
        await saveSchedule(editingId);
        showFlash('Berater/in aktualisiert.');
      } else {
        const data = await api.ssw.createCounselor(form);
        if (data.counselor?.id) {
          await saveSchedule(data.counselor.id);
        }
        if (data.user) {
          setCreatedCreds({ username: data.user.username, tempPassword: data.user.tempPassword });
        }
        showFlash('Berater/in erstellt.');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyCounselor);
      setSchedule(defaultSchedule());
      loadData();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleEdit = (c: Counselor) => {
    setForm({
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      salutation: c.salutation || '',
      email: c.email || '',
      room: c.room || '',
      phone: c.phone || '',
      specializations: c.specializations || '',
      available_from: c.available_from?.toString().slice(0, 5) || '08:00',
      available_until: c.available_until?.toString().slice(0, 5) || '14:00',
      slot_duration_minutes: c.slot_duration_minutes || 30,
      requires_confirmation: c.requires_confirmation !== false,
      username: '',
      password: '',
    });
    setEditingId(c.id);
    setShowForm(true);
    loadSchedule(c.id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Berater/in wirklich löschen?')) return;
    try {
      await api.ssw.deleteCounselor(id);
      showFlash('Berater/in gelöscht.');
      loadData();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler');
    }
  };

  return (
    <>
      <div className="admin-section-header">
        <h3>Berater/innen</h3>
        <button
          className="btn-primary"
          onClick={() => { setForm(emptyCounselor); setEditingId(null); setSchedule(defaultSchedule()); setShowForm(true); }}
        >
          + Neue/r Berater/in
        </button>
      </div>

      {showForm && (
        <div className="content-section">
          <h3>{editingId ? 'Berater/in bearbeiten' : 'Neue/r Berater/in'}</h3>
          <form className="teacher-form" onSubmit={handleSave}>
            <div className="form-group">
              <label htmlFor="ssw-salutation">Anrede</label>
              <select id="ssw-salutation" value={form.salutation} onChange={e => setForm({ ...form, salutation: e.target.value })}>
                <option value="Frau">Frau</option>
                <option value="Herr">Herr</option>
                <option value="">–</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="ssw-first-name">Vorname</label>
              <input id="ssw-first-name" type="text" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="z.B. Maria" required />
            </div>
            <div className="form-group">
              <label htmlFor="ssw-last-name">Nachname</label>
              <input id="ssw-last-name" type="text" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="z.B. Mueller" required />
            </div>
            <div className="form-group">
              <label htmlFor="ssw-email">E-Mail</label>
              <input id="ssw-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="z.B. m.mueller@schule.de" />
            </div>
            <div className="form-group">
              <label htmlFor="ssw-room">Raum</label>
              <input id="ssw-room" type="text" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="z.B. B12" />
            </div>
            <div className="form-group">
              <label htmlFor="ssw-phone">Telefon</label>
              <input id="ssw-phone" type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="z.B. 0123-456789" />
            </div>
            <div className="form-group">
              <label htmlFor="ssw-specs">Schwerpunkte</label>
              <input id="ssw-specs" type="text" value={form.specializations} onChange={e => setForm({ ...form, specializations: e.target.value })} placeholder="Kommasepariert, z.B. Mobbing, Familie" />
            </div>
            <div className="form-group">
              <label>Wochenplan</label>
              {scheduleLoading ? (
                <p>Lade Wochenplan...</p>
              ) : (
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Aktiv</th>
                      <th>Von</th>
                      <th>Bis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((entry) => (
                      <tr key={entry.weekday} className={entry.active ? undefined : 'tr--inactive'}>
                        <td data-label="Tag">{WEEKDAY_LABELS_FULL[entry.weekday]}</td>
                        <td data-label="Aktiv">
                          <input
                            type="checkbox"
                            checked={entry.active}
                            onChange={() => setSchedule(prev => prev.map(s => s.weekday === entry.weekday ? { ...s, active: !s.active } : s))}
                          />
                        </td>
                        <td data-label="Von">
                          <input
                            type="time"
                            value={entry.start_time}
                            disabled={!entry.active}
                            onChange={e => setSchedule(prev => prev.map(s => s.weekday === entry.weekday ? { ...s, start_time: e.target.value } : s))}
                          />
                        </td>
                        <td data-label="Bis">
                          <input
                            type="time"
                            value={entry.end_time}
                            disabled={!entry.active}
                            onChange={e => setSchedule(prev => prev.map(s => s.weekday === entry.weekday ? { ...s, end_time: e.target.value } : s))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="ssw-duration">Termindauer (Minuten)</label>
              <input id="ssw-duration" type="number" min={10} max={120} value={form.slot_duration_minutes} onChange={e => setForm({ ...form, slot_duration_minutes: parseInt(e.target.value) || 30 })} />
            </div>
            <div className="form-group">
              <label className="cb-form__urgent">
                <input
                  type="checkbox"
                  checked={form.requires_confirmation}
                  onChange={e => setForm({ ...form, requires_confirmation: e.target.checked })}
                />
                Manuelle Bestätigung erforderlich
              </label>
              <span className="cb-form__hint">Wenn deaktiviert, werden Buchungen direkt bestätigt.</span>
            </div>
            {!editingId && (
              <>
                <div className="form-group">
                  <label htmlFor="ssw-username">Benutzername <span className="label-hint">(optional – wird sonst automatisch generiert)</span></label>
                  <input id="ssw-username" type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="z.B. m.mueller" autoComplete="off" />
                </div>
                <div className="form-group">
                  <label htmlFor="ssw-password">Passwort <span className="label-hint">(optional – wird sonst automatisch generiert)</span></label>
                  <input id="ssw-password" type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Leer = Zufallspasswort" autoComplete="off" />
                </div>
              </>
            )}
            <div className="form-actions">
              <button className="btn-primary" type="submit">{editingId ? 'Speichern' : 'Erstellen'}</button>
              <button className="btn-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); setSchedule(defaultSchedule()); }}>Abbrechen</button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-resp-table-container">
        <table className="admin-resp-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Raum</th>
              <th>Zeiten</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {counselors.length === 0 ? (
              <tr><td colSpan={5}>Keine Berater/innen vorhanden.</td></tr>
            ) : counselors.map(c => (
              <tr key={c.id}>
                <td data-label="Name">{c.salutation ? `${c.salutation} ` : ''}{c.name}</td>
                <td data-label="E-Mail">{c.email || '–'}</td>
                <td data-label="Raum">{c.room || '–'}</td>
                <td data-label="Zeiten">
                  {(() => {
                    const sch = (schedulesMap[c.id] || []).filter(s => s.active);
                    if (sch.length === 0) return `${c.available_from?.toString().slice(0, 5) || '–'} – ${c.available_until?.toString().slice(0, 5) || '–'}`;
                    return sch.map(s => `${WEEKDAY_LABELS_FULL[s.weekday]?.slice(0, 2)} ${s.start_time?.toString().slice(0, 5)}–${s.end_time?.toString().slice(0, 5)}`).join(', ');
                  })()}
                </td>
                <td data-label="Aktionen">
                  <div className="action-btns">
                    <button className="btn-secondary" onClick={() => handleEdit(c)}>Bearbeiten</button>
                    <button className="btn-secondary btn--danger" onClick={() => handleDelete(c.id)}>Löschen</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
