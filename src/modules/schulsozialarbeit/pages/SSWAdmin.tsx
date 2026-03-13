import { useState, useEffect, useCallback } from 'react';
import '../../../pages/AdminDashboard.css';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

interface Counselor {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  salutation?: string;
  email?: string;
  room?: string;
  phone?: string;
  specializations?: string;
  available_from?: string;
  available_until?: string;
  slot_duration_minutes?: number;
  active?: boolean;
  user_id?: number;
}

interface ScheduleEntry {
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  active?: boolean;
}

interface Appointment {
  id: number;
  counselor_id: number;
  date: string;
  time: string;
  duration_minutes: number;
  status: string;
  student_name?: string;
  student_class?: string;
  concern?: string;
  category_name?: string;
  category_icon?: string;
}

type Tab = 'counselors' | 'categories' | 'termine';

const WEEKDAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function defaultSchedule(): ScheduleEntry[] {
  return WEEKDAY_LABELS.map((_, i) => ({
    weekday: i,
    start_time: '08:00',
    end_time: '14:00',
    active: i < 5, // Mon-Fri active by default
  }));
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
  username: '',
  password: '',
};

const emptyCategory = {
  name: '',
  description: '',
  icon: '',
  sort_order: 0,
};

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as any)?.error || `Fehler ${res.status}`);
  }
  return res.json();
}

export function SSWAdmin() {
  const [tab, setTab] = useState<Tab>('counselors');
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  // Counselor form
  const [showCounselorForm, setShowCounselorForm] = useState(false);
  const [editingCounselorId, setEditingCounselorId] = useState<number | null>(null);
  const [counselorForm, setCounselorForm] = useState(emptyCounselor);
  const [createdCreds, setCreatedCreds] = useState<{ username: string; tempPassword: string } | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(defaultSchedule());
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);

  // Slot generation
  const [slotGenFrom, setSlotGenFrom] = useState('');
  const [slotGenUntil, setSlotGenUntil] = useState('');
  const [generating, setGenerating] = useState(false);

  // Schedules overview for table display
  const [schedulesMap, setSchedulesMap] = useState<Record<number, ScheduleEntry[]>>({});

  // Termine (calendar) tab
  const [calCounselorId, setCalCounselorId] = useState<number | null>(null);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [calAppointments, setCalAppointments] = useState<Appointment[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null);
  const [calSelectedIds, setCalSelectedIds] = useState<Set<number>>(new Set());
  const [calDeleting, setCalDeleting] = useState(false);

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 3000); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cData, catData] = await Promise.all([
        apiFetch('/ssw/admin/counselors'),
        apiFetch('/ssw/admin/categories'),
      ]);
      setCounselors(cData.counselors || []);
      setCategories(catData.categories || []);
      // Load schedules for all counselors
      const cList: Counselor[] = cData.counselors || [];
      if (cList.length > 0) {
        const scheduleResults = await Promise.all(
          cList.map(c => apiFetch(`/ssw/admin/counselors/${c.id}/schedule`).catch(() => ({ schedule: [] })))
        );
        const map: Record<number, ScheduleEntry[]> = {};
        cList.forEach((c, i) => { map[c.id] = scheduleResults[i].schedule || []; });
        setSchedulesMap(map);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Counselor CRUD ────────────────────────────────────────────────
  const loadSchedule = async (counselorId: number) => {
    setScheduleLoading(true);
    try {
      const data = await apiFetch(`/ssw/admin/counselors/${counselorId}/schedule`);
      const rows: ScheduleEntry[] = data.schedule || [];
      if (rows.length > 0) {
        // Merge with defaults so all 7 days are present
        const merged = defaultSchedule().map(def => {
          const found = rows.find(r => r.weekday === def.weekday);
          return found ? { weekday: found.weekday, start_time: found.start_time?.toString().slice(0, 5) || '08:00', end_time: found.end_time?.toString().slice(0, 5) || '14:00', active: found.active } : def;
        });
        setSchedule(merged);
      } else {
        setSchedule(defaultSchedule());
      }
    } catch {
      setSchedule(defaultSchedule());
    } finally {
      setScheduleLoading(false);
    }
  };

  const saveSchedule = async (counselorId: number) => {
    await apiFetch(`/ssw/admin/counselors/${counselorId}/schedule`, {
      method: 'PUT',
      body: JSON.stringify({ schedule }),
    });
  };

  const handleSaveCounselor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counselorForm.first_name.trim() || !counselorForm.last_name.trim()) {
      alert('Vor- und Nachname sind Pflichtfelder.');
      return;
    }
    try {
      if (editingCounselorId) {
        await apiFetch(`/ssw/admin/counselors/${editingCounselorId}`, {
          method: 'PUT',
          body: JSON.stringify(counselorForm),
        });
        await saveSchedule(editingCounselorId);
        showFlash('Berater/in aktualisiert.');
      } else {
        const data = await apiFetch('/ssw/admin/counselors', {
          method: 'POST',
          body: JSON.stringify(counselorForm),
        });
        if (data.counselor?.id) {
          await saveSchedule(data.counselor.id);
        }
        if (data.user) {
          setCreatedCreds({ username: data.user.username, tempPassword: data.user.tempPassword });
        }
        showFlash('Berater/in erstellt.');
      }
      setShowCounselorForm(false);
      setEditingCounselorId(null);
      setCounselorForm(emptyCounselor);
      setSchedule(defaultSchedule());
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleEditCounselor = (c: Counselor) => {
    setCounselorForm({
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
      username: '',
      password: '',
    });
    setEditingCounselorId(c.id);
    setShowCounselorForm(true);
    loadSchedule(c.id);
  };

  const handleDeleteCounselor = async (id: number) => {
    if (!confirm('Berater/in wirklich löschen?')) return;
    try {
      await apiFetch(`/ssw/admin/counselors/${id}`, { method: 'DELETE' });
      showFlash('Berater/in gelöscht.');
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  // ── Category CRUD ─────────────────────────────────────────────────
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) { alert('Name ist Pflicht.'); return; }
    try {
      if (editingCategoryId) {
        await apiFetch(`/ssw/admin/categories/${editingCategoryId}`, {
          method: 'PUT',
          body: JSON.stringify(categoryForm),
        });
        showFlash('Kategorie aktualisiert.');
      } else {
        await apiFetch('/ssw/admin/categories', {
          method: 'POST',
          body: JSON.stringify(categoryForm),
        });
        showFlash('Kategorie erstellt.');
      }
      setShowCategoryForm(false);
      setEditingCategoryId(null);
      setCategoryForm(emptyCategory);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleEditCategory = (cat: Category) => {
    setCategoryForm({
      name: cat.name,
      description: cat.description || '',
      icon: cat.icon || '',
      sort_order: cat.sort_order || 0,
    });
    setEditingCategoryId(cat.id);
    setShowCategoryForm(true);
  };

  // ── Slot Generation ───────────────────────────────────────────────
  const handleGenerateSlots = async () => {
    if (!calCounselorId || !slotGenFrom || !slotGenUntil) {
      alert('Bitte Berater/in und Zeitraum wählen.');
      return;
    }
    setGenerating(true);
    try {
      const data = await apiFetch('/ssw/counselor/generate-slots', {
        method: 'POST',
        body: JSON.stringify({
          counselor_id: calCounselorId,
          date_from: slotGenFrom,
          date_until: slotGenUntil,
        }),
      });
      showFlash(`${data.created || 0} Termine erstellt (${data.skipped || 0} übersprungen).`);
      setSlotGenFrom('');
      setSlotGenUntil('');
      // Refresh calendar
      loadCalendarAppointments(calCounselorId, calMonth.year, calMonth.month);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setGenerating(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  // ── Calendar helpers ──────────────────────────────────────────────
  const loadCalendarAppointments = useCallback(async (counselorId: number, year: number, month: number) => {
    setCalLoading(true);
    try {
      const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const dateUntil = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const data = await apiFetch(`/ssw/admin/appointments?counselor_id=${counselorId}&date_from=${dateFrom}&date_until=${dateUntil}`);
      setCalAppointments(data.appointments || []);
    } catch {
      setCalAppointments([]);
    } finally {
      setCalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (calCounselorId && tab === 'termine') {
      loadCalendarAppointments(calCounselorId, calMonth.year, calMonth.month);
      setCalSelectedDate(null);
      setCalSelectedIds(new Set());
    }
  }, [calCounselorId, calMonth, tab, loadCalendarAppointments]);

  const handleDeleteSelectedAppointments = async () => {
    if (calSelectedIds.size === 0) return;
    const count = calSelectedIds.size;
    if (!confirm(`${count} Termin(e) wirklich löschen?`)) return;
    setCalDeleting(true);
    try {
      const data = await apiFetch('/ssw/admin/appointments', {
        method: 'DELETE',
        body: JSON.stringify({ ids: Array.from(calSelectedIds) }),
      });
      showFlash(`${data.deleted || 0} Termin(e) gelöscht.`);
      setCalSelectedIds(new Set());
      if (calCounselorId) loadCalendarAppointments(calCounselorId, calMonth.year, calMonth.month);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Löschen');
    } finally {
      setCalDeleting(false);
    }
  };

  if (loading) return <div className="admin-dashboard"><div className="admin-main"><p>Lade…</p></div></div>;

  return (
    <div className="admin-dashboard">
      <div className="admin-main">
        <div className="admin-section-header">
          <h2>Schulsozialarbeit</h2>
        </div>

        {flash && <div className="admin-success">{flash}</div>}
        {createdCreds && (
          <div className="admin-success" style={{ background: '#f0f9ff', border: '1px solid #38bdf8', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <strong>Zugangsdaten erstellt:</strong>
            <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.95rem' }}>
              Benutzername: <strong>{createdCreds.username}</strong><br />
              Passwort: <strong>{createdCreds.tempPassword}</strong>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#555' }}>
              Bitte Zugangsdaten notieren — das Passwort wird nicht erneut angezeigt.
            </p>
            <button className="btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => setCreatedCreds(null)}>Schließen</button>
          </div>
        )}
        {error && <div className="admin-error">{error}</div>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {([['counselors', 'Berater/innen'], ['termine', 'Terminverwaltung'], ['categories', 'Themen']] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Counselors Tab ─────────────────────────────────────── */}
        {tab === 'counselors' && (
          <>
            <div className="admin-section-header">
              <h3>Berater/innen</h3>
              <button
                className="btn-primary"
                onClick={() => { setCounselorForm(emptyCounselor); setEditingCounselorId(null); setSchedule(defaultSchedule()); setShowCounselorForm(true); }}
              >
                + Neue/r Berater/in
              </button>
            </div>

            {showCounselorForm && (
              <div className="teacher-form-container">
                <h3>{editingCounselorId ? 'Berater/in bearbeiten' : 'Neue/r Berater/in'}</h3>
                <form className="teacher-form" onSubmit={handleSaveCounselor}>
                  <div className="form-group">
                    <label htmlFor="ssw-salutation">Anrede</label>
                    <select id="ssw-salutation" value={counselorForm.salutation} onChange={e => setCounselorForm({ ...counselorForm, salutation: e.target.value })}>
                      <option value="Frau">Frau</option>
                      <option value="Herr">Herr</option>
                      <option value="">–</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="ssw-first-name">Vorname</label>
                    <input id="ssw-first-name" type="text" value={counselorForm.first_name} onChange={e => setCounselorForm({ ...counselorForm, first_name: e.target.value })} placeholder="z.B. Maria" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ssw-last-name">Nachname</label>
                    <input id="ssw-last-name" type="text" value={counselorForm.last_name} onChange={e => setCounselorForm({ ...counselorForm, last_name: e.target.value })} placeholder="z.B. Müller" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ssw-email">E-Mail</label>
                    <input id="ssw-email" type="email" value={counselorForm.email} onChange={e => setCounselorForm({ ...counselorForm, email: e.target.value })} placeholder="z.B. m.mueller@schule.de" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ssw-room">Raum</label>
                    <input id="ssw-room" type="text" value={counselorForm.room} onChange={e => setCounselorForm({ ...counselorForm, room: e.target.value })} placeholder="z.B. B12" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ssw-phone">Telefon</label>
                    <input id="ssw-phone" type="text" value={counselorForm.phone} onChange={e => setCounselorForm({ ...counselorForm, phone: e.target.value })} placeholder="z.B. 0123-456789" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ssw-specs">Schwerpunkte</label>
                    <input id="ssw-specs" type="text" value={counselorForm.specializations} onChange={e => setCounselorForm({ ...counselorForm, specializations: e.target.value })} placeholder="Kommasepariert, z.B. Mobbing, Familie" />
                  </div>
                  <div className="form-group">
                    <label>Wochenplan</label>
                    {scheduleLoading ? (
                      <p>Lade Wochenplan…</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem' }}>Tag</th>
                            <th style={{ textAlign: 'center', padding: '0.3rem 0.5rem' }}>Aktiv</th>
                            <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem' }}>Von</th>
                            <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem' }}>Bis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedule.map((entry) => (
                            <tr key={entry.weekday} style={{ opacity: entry.active ? 1 : 0.5 }}>
                              <td style={{ padding: '0.3rem 0.5rem', fontWeight: 500 }}>{WEEKDAY_LABELS[entry.weekday]}</td>
                              <td style={{ padding: '0.3rem 0.5rem', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={entry.active}
                                  onChange={() => setSchedule(prev => prev.map(s => s.weekday === entry.weekday ? { ...s, active: !s.active } : s))}
                                />
                              </td>
                              <td style={{ padding: '0.3rem 0.5rem' }}>
                                <input
                                  type="time"
                                  value={entry.start_time}
                                  disabled={!entry.active}
                                  onChange={e => setSchedule(prev => prev.map(s => s.weekday === entry.weekday ? { ...s, start_time: e.target.value } : s))}
                                  style={{ width: '100%' }}
                                />
                              </td>
                              <td style={{ padding: '0.3rem 0.5rem' }}>
                                <input
                                  type="time"
                                  value={entry.end_time}
                                  disabled={!entry.active}
                                  onChange={e => setSchedule(prev => prev.map(s => s.weekday === entry.weekday ? { ...s, end_time: e.target.value } : s))}
                                  style={{ width: '100%' }}
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
                    <input id="ssw-duration" type="number" min={10} max={120} value={counselorForm.slot_duration_minutes} onChange={e => setCounselorForm({ ...counselorForm, slot_duration_minutes: parseInt(e.target.value) || 30 })} />
                  </div>
                  {!editingCounselorId && (
                    <>
                      <div className="form-group">
                        <label htmlFor="ssw-username">Benutzername <span style={{ fontWeight: 'normal', color: '#888' }}>(optional – wird sonst automatisch generiert)</span></label>
                        <input id="ssw-username" type="text" value={counselorForm.username} onChange={e => setCounselorForm({ ...counselorForm, username: e.target.value })} placeholder="z.B. m.mueller" autoComplete="off" />
                      </div>
                      <div className="form-group">
                        <label htmlFor="ssw-password">Passwort <span style={{ fontWeight: 'normal', color: '#888' }}>(optional – wird sonst automatisch generiert)</span></label>
                        <input id="ssw-password" type="text" value={counselorForm.password} onChange={e => setCounselorForm({ ...counselorForm, password: e.target.value })} placeholder="Leer = Zufallspasswort" autoComplete="off" />
                      </div>
                    </>
                  )}
                  <div className="form-actions">
                    <button className="btn-primary" type="submit">{editingCounselorId ? 'Speichern' : 'Erstellen'}</button>
                    <button className="btn-secondary" type="button" onClick={() => { setShowCounselorForm(false); setEditingCounselorId(null); setSchedule(defaultSchedule()); }}>Abbrechen</button>
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
                      <td>{c.salutation ? `${c.salutation} ` : ''}{c.name}</td>
                      <td>{c.email || '–'}</td>
                      <td>{c.room || '–'}</td>
                      <td>
                        {(() => {
                          const sch = (schedulesMap[c.id] || []).filter(s => s.active);
                          if (sch.length === 0) return `${c.available_from?.toString().slice(0, 5) || '–'} – ${c.available_until?.toString().slice(0, 5) || '–'}`;
                          return sch.map(s => `${WEEKDAY_LABELS[s.weekday]?.slice(0, 2)} ${s.start_time?.toString().slice(0, 5)}–${s.end_time?.toString().slice(0, 5)}`).join(', ');
                        })()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn-secondary" onClick={() => handleEditCounselor(c)}>Bearbeiten</button>
                          <button className="btn-secondary" style={{ color: 'var(--color-error, #dc2626)' }} onClick={() => handleDeleteCounselor(c.id)}>Löschen</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Terminverwaltung Tab ─────────────────────────────── */}
        {tab === 'termine' && (
          <>
            <div className="admin-section-header">
              <h3>Terminverwaltung</h3>
            </div>

            {/* Counselor picker + Slot generation */}
            <div className="teacher-form-container" style={{ marginBottom: '1rem' }}>
              <form className="teacher-form" onSubmit={e => { e.preventDefault(); handleGenerateSlots(); }}>
                <div className="form-group">
                  <label htmlFor="cal-counselor">Berater/in</label>
                  <select
                    id="cal-counselor"
                    value={calCounselorId || ''}
                    onChange={e => {
                      const id = parseInt(e.target.value) || null;
                      setCalCounselorId(id);
                      setCalSelectedDate(null);
                      setCalSelectedIds(new Set());
                    }}
                  >
                    <option value="">– Bitte wählen –</option>
                    {counselors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Slots freischalten für Zeitraum</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="date" min={today} value={slotGenFrom} onChange={e => setSlotGenFrom(e.target.value)} />
                    <span>bis</span>
                    <input type="date" min={slotGenFrom || today} value={slotGenUntil} onChange={e => setSlotGenUntil(e.target.value)} />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn-primary" type="submit" disabled={generating || !calCounselorId}>
                    {generating ? 'Generiere…' : 'Termine freischalten'}
                  </button>
                </div>
              </form>
            </div>

            {calCounselorId && (
              <>
                {/* Month navigator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setCalMonth(prev => {
                      const d = new Date(prev.year, prev.month - 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })}
                  >
                    ◀
                  </button>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem', minWidth: '160px', textAlign: 'center' }}>
                    {new Date(calMonth.year, calMonth.month).toLocaleString('de-DE', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    className="btn-secondary"
                    onClick={() => setCalMonth(prev => {
                      const d = new Date(prev.year, prev.month + 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })}
                  >
                    ▶
                  </button>
                </div>

                {calLoading ? (
                  <p>Lade Termine…</p>
                ) : (
                  <>
                    {/* Calendar grid */}
                    {(() => {
                      const year = calMonth.year;
                      const month = calMonth.month;
                      const firstDay = new Date(year, month, 1);
                      const lastDay = new Date(year, month + 1, 0).getDate();
                      // Monday = 0 in our grid
                      let startOffset = firstDay.getDay() - 1;
                      if (startOffset < 0) startOffset = 6;

                      // Group appointments by date string
                      const byDate: Record<string, Appointment[]> = {};
                      for (const a of calAppointments) {
                        const ds = typeof a.date === 'string' ? a.date.slice(0, 10) : new Date(a.date).toISOString().slice(0, 10);
                        (byDate[ds] ||= []).push(a);
                      }

                      const cells: React.ReactNode[] = [];
                      // Header row
                      for (const label of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) {
                        cells.push(
                          <div key={`h-${label}`} style={{ fontWeight: 600, textAlign: 'center', padding: '0.3rem', fontSize: '0.85rem', color: 'var(--color-gray-600)' }}>
                            {label}
                          </div>
                        );
                      }
                      // Empty leading cells
                      for (let i = 0; i < startOffset; i++) {
                        cells.push(<div key={`e-${i}`} />);
                      }
                      // Day cells
                      for (let d = 1; d <= lastDay; d++) {
                        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const dayAppts = byDate[ds] || [];
                        const count = dayAppts.length;
                        const isSelected = calSelectedDate === ds;
                        const hasBooked = dayAppts.some(a => a.status !== 'available');
                        const isPast = ds < today;

                        cells.push(
                          <div
                            key={d}
                            onClick={() => { setCalSelectedDate(isSelected ? null : ds); setCalSelectedIds(new Set()); }}
                            style={{
                              border: isSelected ? '2px solid var(--brand-primary, #123C73)' : '1px solid var(--color-gray-200, #e5e7eb)',
                              borderRadius: '0.375rem',
                              padding: '0.3rem',
                              textAlign: 'center',
                              cursor: count > 0 ? 'pointer' : 'default',
                              background: isSelected ? 'var(--brand-surface-2, #f0f4fa)' : count > 0 ? '#fff' : 'var(--color-gray-50, #f9fafb)',
                              opacity: isPast ? 0.5 : 1,
                              minHeight: '50px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{d}</div>
                            {count > 0 && (
                              <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                                <span style={{ color: 'var(--brand-primary, #123C73)' }}>{count} Termin{count !== 1 ? 'e' : ''}</span>
                                {hasBooked && <span style={{ color: 'var(--color-warning, #d97706)', marginLeft: '2px' }}>*</span>}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '1.5rem' }}>
                          {cells}
                        </div>
                      );
                    })()}

                    {/* Selected day detail */}
                    {calSelectedDate && (() => {
                      const dayAppts = calAppointments
                        .filter(a => {
                          const ds = typeof a.date === 'string' ? a.date.slice(0, 10) : new Date(a.date).toISOString().slice(0, 10);
                          return ds === calSelectedDate;
                        })
                        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

                      if (dayAppts.length === 0) return (
                        <div style={{ padding: '1rem', background: 'var(--color-gray-50, #f9fafb)', borderRadius: '0.5rem' }}>
                          <strong>{new Date(calSelectedDate + 'T00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                          <p style={{ marginTop: '0.5rem', color: 'var(--color-gray-500)' }}>Keine Termine an diesem Tag.</p>
                        </div>
                      );

                      const allSelected = dayAppts.every(a => calSelectedIds.has(a.id));

                      const statusLabel = (s: string) => {
                        switch (s) {
                          case 'available': return '🟢 Frei';
                          case 'requested': return '🟡 Angefragt';
                          case 'confirmed': return '🔵 Bestätigt';
                          case 'cancelled': return '⚫ Abgesagt';
                          case 'completed': return '✅ Abgeschlossen';
                          default: return s;
                        }
                      };

                      return (
                        <div style={{ padding: '1rem', background: 'var(--color-gray-50, #f9fafb)', borderRadius: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <strong>{new Date(calSelectedDate + 'T00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  onChange={() => {
                                    if (allSelected) {
                                      setCalSelectedIds(new Set());
                                    } else {
                                      setCalSelectedIds(new Set(dayAppts.map(a => a.id)));
                                    }
                                  }}
                                />
                                Alle
                              </label>
                              {calSelectedIds.size > 0 && (
                                <button
                                  className="btn-secondary"
                                  style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.85rem' }}
                                  disabled={calDeleting}
                                  onClick={handleDeleteSelectedAppointments}
                                >
                                  {calDeleting ? 'Lösche…' : `${calSelectedIds.size} löschen`}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="admin-resp-table-container">
                            <table className="admin-resp-table" style={{ fontSize: '0.9rem' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '30px' }}></th>
                                  <th>Uhrzeit</th>
                                  <th>Status</th>
                                  <th>Schüler/in</th>
                                  <th>Kategorie</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dayAppts.map(a => (
                                  <tr key={a.id} style={{ background: calSelectedIds.has(a.id) ? 'var(--brand-surface-2, #eef2f9)' : undefined }}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={calSelectedIds.has(a.id)}
                                        onChange={() => setCalSelectedIds(prev => {
                                          const next = new Set(prev);
                                          if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                                          return next;
                                        })}
                                      />
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{a.time?.toString().slice(0, 5)}</td>
                                    <td>{statusLabel(a.status)}</td>
                                    <td>{a.student_name || '–'}</td>
                                    <td>{a.category_name || '–'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── Categories Tab ─────────────────────────────────────── */}
        {tab === 'categories' && (
          <>
            <div className="admin-section-header">
              <h3>Themen</h3>
              <button
                className="btn-primary"
                onClick={() => { setCategoryForm(emptyCategory); setEditingCategoryId(null); setShowCategoryForm(true); }}
              >
                + Neues Thema
              </button>
            </div>

            {showCategoryForm && (
              <div className="teacher-form-container">
                <h3>{editingCategoryId ? 'Thema bearbeiten' : 'Neues Thema'}</h3>
                <form className="teacher-form" onSubmit={handleSaveCategory}>
                  <div className="form-group">
                    <label htmlFor="ssw-cat-name">Name</label>
                    <input id="ssw-cat-name" type="text" value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ssw-cat-desc">Beschreibung</label>
                    <input id="ssw-cat-desc" type="text" value={categoryForm.description} onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ssw-cat-sort">Sortierung</label>
                    <input id="ssw-cat-sort" type="number" value={categoryForm.sort_order} onChange={e => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="form-actions">
                    <button className="btn-primary" type="submit">{editingCategoryId ? 'Speichern' : 'Erstellen'}</button>
                    <button className="btn-secondary" type="button" onClick={() => { setShowCategoryForm(false); setEditingCategoryId(null); }}>Abbrechen</button>
                  </div>
                </form>
              </div>
            )}

            <div className="admin-resp-table-container">
              <table className="admin-resp-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Beschreibung</th>
                    <th>#</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr><td colSpan={4}>Keine Themen vorhanden.</td></tr>
                  ) : categories.map(cat => (
                    <tr key={cat.id}>
                      <td>{cat.name}</td>
                      <td>{cat.description || '–'}</td>
                      <td>{cat.sort_order}</td>
                      <td>
                        <button className="btn-secondary" onClick={() => handleEditCategory(cat)}>Bearbeiten</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
