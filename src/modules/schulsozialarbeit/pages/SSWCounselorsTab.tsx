import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, MoreVertical, UserPlus } from 'lucide-react';
import type { Counselor, ScheduleEntry } from '../../../types';
import api from '../../../services/api';
import { WEEKDAY_LABELS_FULL } from '../../../shared/constants/weekdays';
import { buildDefaultSchedule, mergeScheduleEntries } from '../../../shared/utils/schedule';
import { groupAlphabetically, getInitials } from '../../../shared/utils/groupAlphabetically';
import '../../../shared/styles/um-components.css';
import './ssw-counselors.css';

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

function getCounselorLastName(c: Counselor): string {
  return c.last_name || '';
}

// ── Context Menu ────────────────────────────────────────────────────

function ContextMenu({ onEdit, onDelete, onClose }: {
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="um-context-menu" ref={ref}>
      <button className="um-context-menu__item" onClick={onEdit}>Bearbeiten</button>
      <div className="um-context-menu__divider" />
      <button className="um-context-menu__item um-context-menu__item--danger" onClick={onDelete}>Löschen</button>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

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
  const [openId, setOpenId] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const groups = useMemo(() => groupAlphabetically(counselors, getCounselorLastName), [counselors]);

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
    setMenuOpenId(null);
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

  const handleNew = () => {
    setForm(emptyCounselor);
    setEditingId(null);
    setSchedule(defaultSchedule());
    setShowForm(true);
  };

  return (
    <>
      {/* Header */}
      <div className="um-header">
        <div className="um-header__left">
          <h2 className="um-header__title">Berater/innen</h2>
          <span className="um-header__count">{counselors.length}</span>
        </div>
        <button className="um-header__add-btn" onClick={handleNew}>
          <UserPlus size={15} />
          <span className="um-header__btn-label">Hinzufügen</span>
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="ssw-form-section">
          <div className="teacher-form-container">
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
                    <input id="ssw-password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Leer = Zufallspasswort" autoComplete="off" />
                  </div>
                </>
              )}
              <div className="form-actions">
                <button className="btn-primary" type="submit">{editingId ? 'Speichern' : 'Erstellen'}</button>
                <button className="btn-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); setSchedule(defaultSchedule()); }}>Abbrechen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {counselors.length === 0 ? (
        <div className="um-empty">Keine Berater/innen vorhanden.</div>
      ) : (
        <div className="um-list">
          {groups.map((group) => (
            <div key={group.letter}>
              <div className="um-alpha-divider">
                <span className="um-alpha-divider__letter">{group.letter}</span>
                <span className="um-alpha-divider__line" />
              </div>
              {group.items.map((c) => {
                const isOpen = openId === c.id;
                const scheduleEntries = (schedulesMap[c.id] || []).filter(s => s.active);
                return (
                  <div key={c.id} className="um-row-wrapper">
                    <div className="um-row" onClick={() => setOpenId(isOpen ? null : c.id)}>
                      <div className="ssw-avatar">{getInitials(c.first_name || '', c.last_name || '')}</div>
                      <div className="um-info">
                        <span className="um-name">
                          {c.salutation ? `${c.salutation} ` : ''}{`${c.first_name || ''} ${c.last_name || ''}`.trim()}
                        </span>
                        <span className="um-email">{c.email || '--'}</span>
                      </div>
                      {c.room && <span className="ssw-room-badge">Raum {c.room}</span>}
                      <ChevronDown
                        size={16}
                        className={`tb-chevron${isOpen ? ' tb-chevron--open' : ''}`}
                      />
                      <div className="um-menu-anchor">
                        <button
                          className="um-menu-trigger"
                          onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === c.id ? null : c.id); }}
                          aria-label="Aktionen"
                        >
                          <MoreVertical size={18} />
                        </button>
                        {menuOpenId === c.id && (
                          <ContextMenu
                            onEdit={() => handleEdit(c)}
                            onDelete={() => { handleDelete(c.id); setMenuOpenId(null); }}
                            onClose={() => setMenuOpenId(null)}
                          />
                        )}
                      </div>
                    </div>

                    <div className={`um-detail-panel${isOpen ? ' um-detail-panel--open' : ''}`}>
                      <div className="um-detail-panel__inner">
                        <div className="um-detail-grid">
                          <div className="um-detail-item">
                            <span className="um-detail-label">E-Mail</span>
                            <span className="um-detail-value">
                              {c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '--'}
                            </span>
                          </div>
                          <div className="um-detail-item">
                            <span className="um-detail-label">Raum</span>
                            <span className="um-detail-value">{c.room || '--'}</span>
                          </div>
                          {c.phone && (
                            <div className="um-detail-item">
                              <span className="um-detail-label">Telefon</span>
                              <span className="um-detail-value">{c.phone}</span>
                            </div>
                          )}
                          {c.specializations && (
                            <div className="um-detail-item">
                              <span className="um-detail-label">Schwerpunkte</span>
                              <span className="um-detail-value">{c.specializations}</span>
                            </div>
                          )}
                          <div className="um-detail-item" style={{ gridColumn: '1 / -1' }}>
                            <span className="um-detail-label">Sprechzeiten</span>
                            <span className="um-detail-value">
                              {scheduleEntries.length === 0 ? (
                                `${c.available_from?.toString().slice(0, 5) || '--'} – ${c.available_until?.toString().slice(0, 5) || '--'}`
                              ) : (
                                <div className="ssw-schedule-list">
                                  {scheduleEntries.map((s) => (
                                    <div key={s.weekday} className="ssw-schedule-item">
                                      <span className="ssw-schedule-item__day">{WEEKDAY_LABELS_FULL[s.weekday]?.slice(0, 2)}</span>
                                      <span className="ssw-schedule-item__time">
                                        {s.start_time?.toString().slice(0, 5)} – {s.end_time?.toString().slice(0, 5)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </span>
                          </div>
                          <div className="um-detail-item">
                            <span className="um-detail-label">Termindauer</span>
                            <span className="um-detail-value">{c.slot_duration_minutes || 30} Min.</span>
                          </div>
                          <div className="um-detail-item">
                            <span className="um-detail-label">Bestätigung</span>
                            <span className="um-detail-value">{c.requires_confirmation !== false ? 'Manuell' : 'Automatisch'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
