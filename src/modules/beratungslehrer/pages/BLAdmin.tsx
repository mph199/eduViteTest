import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/useAuth';
import type { Counselor, ScheduleEntry, CounselorTopic as Topic, CounselorAppointment as Appointment } from '../../../types';
import api from '../../../services/api';
import '../../../pages/AdminDashboard.css';

type Tab = 'sprechzeiten' | 'termine' | 'anfragen' | 'counselors' | 'topics';

const WEEKDAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

const defaultSchedule: ScheduleEntry[] = [1, 2, 3, 4, 5].map(wd => ({
  weekday: wd,
  start_time: '08:00',
  end_time: '14:00',
  active: false,
}));

const emptyTopic = { name: '', description: '', sort_order: 0 };

export function BLAdmin() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isBLUser = !isAdmin && Array.isArray(user?.modules) && user.modules.includes('beratungslehrer');

  const [tab, setTab] = useState<Tab>(isAdmin ? 'counselors' : 'sprechzeiten');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  // Own profile & schedule
  const [profile, setProfile] = useState<Counselor | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(defaultSchedule);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Slot generation
  const [slotGenFrom, setSlotGenFrom] = useState('');
  const [slotGenUntil, setSlotGenUntil] = useState('');
  const [generating, setGenerating] = useState(false);

  // Calendar (own appointments)
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calAppointments, setCalAppointments] = useState<Appointment[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null);
  const [calSelectedIds, setCalSelectedIds] = useState<Set<number>>(new Set());
  const [calDeleting, setCalDeleting] = useState(false);

  // Anfragen (requested/confirmed bookings)
  const [requests, setRequests] = useState<Appointment[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Admin tabs state
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [adminSchedulesMap, setAdminSchedulesMap] = useState<Record<number, ScheduleEntry[]>>({});
  const [topics, setTopics] = useState<Topic[]>([]);
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [topicForm, setTopicForm] = useState(emptyTopic);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 3000);
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  // ── Load own profile ──────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    try {
      const data = await api.bl.getProfile();
      setProfile(data?.counselor || null);
    } catch {
      setProfile(null);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      const data = await api.bl.getSchedule();
      const entries: ScheduleEntry[] = data?.schedule || [];
      const merged = defaultSchedule.map(def => {
        const existing = entries.find(e => e.weekday === def.weekday);
        return existing ? {
          weekday: existing.weekday,
          start_time: existing.start_time?.toString().slice(0, 5) || def.start_time,
          end_time: existing.end_time?.toString().slice(0, 5) || def.end_time,
          active: existing.active,
        } : def;
      });
      setSchedule(merged);
    } catch {
      setSchedule(defaultSchedule);
    }
  }, []);

  // ── Load calendar appointments ─────────────────────────────────────
  const loadCalendarAppointments = useCallback(async (year: number, month: number) => {
    setCalLoading(true);
    try {
      const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const dateUntil = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const data = await api.bl.getAppointments({ date_from: dateFrom, date_until: dateUntil });
      setCalAppointments(data?.appointments || []);
    } catch {
      setCalAppointments([]);
    } finally {
      setCalLoading(false);
    }
  }, []);

  // ── Load requests ──────────────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const data = await api.bl.getAppointments({ status: 'requested,confirmed' });
      setRequests(data?.appointments || []);
    } catch {
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  // ── Load admin data ────────────────────────────────────────────────
  const loadAdminData = useCallback(async () => {
    try {
      const [cData, tData] = await Promise.all([
        api.bl.getAdminCounselors(),
        api.bl.getAdminTopics(),
      ]);
      const cList: Counselor[] = cData?.counselors || [];
      setCounselors(cList);
      setTopics(tData?.topics || []);
      if (cList.length > 0) {
        const scheduleResults = await Promise.all(
          cList.map(c => api.bl.getAdminCounselorSchedule(c.id).catch(() => ({ schedule: [] })))
        );
        const map: Record<number, ScheduleEntry[]> = {};
        cList.forEach((c, i) => { map[c.id] = scheduleResults[i]?.schedule || []; });
        setAdminSchedulesMap(map);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true);
      if (isBLUser) {
        await loadProfile();
        await loadSchedule();
      }
      if (isAdmin) await loadAdminData();
      setLoading(false);
    }
    init();
  }, [loadProfile, loadSchedule, loadAdminData, isAdmin, isBLUser]);

  // Load calendar when tab=termine
  useEffect(() => {
    if (tab === 'termine' && profile) {
      loadCalendarAppointments(calMonth.year, calMonth.month);
      setCalSelectedDate(null);
      setCalSelectedIds(new Set());
    }
  }, [tab, calMonth, profile, loadCalendarAppointments]);

  // Load requests when tab=anfragen
  useEffect(() => {
    if (tab === 'anfragen') loadRequests();
  }, [tab, loadRequests]);

  // ── Schedule save ──────────────────────────────────────────────────
  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    try {
      await api.bl.updateSchedule(schedule);
      showFlash('Sprechzeiten gespeichert.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setScheduleSaving(false);
    }
  };

  // ── Slot generation ────────────────────────────────────────────────
  const handleGenerateSlots = async () => {
    if (!profile || !slotGenFrom || !slotGenUntil) {
      alert('Bitte Zeitraum wählen.');
      return;
    }
    setGenerating(true);
    try {
      const data = await api.bl.generateSlots(profile.id, slotGenFrom, slotGenUntil);
      showFlash(`${data?.created || 0} Termine erstellt (${data?.skipped || 0} übersprungen).`);
      setSlotGenFrom('');
      setSlotGenUntil('');
      loadCalendarAppointments(calMonth.year, calMonth.month);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setGenerating(false);
    }
  };

  // ── Delete appointments ────────────────────────────────────────────
  const handleDeleteSelectedAppointments = async () => {
    if (calSelectedIds.size === 0) return;
    if (!confirm(`${calSelectedIds.size} Termin(e) wirklich löschen?`)) return;
    setCalDeleting(true);
    try {
      const data = await api.bl.deleteAppointments(Array.from(calSelectedIds));
      showFlash(`${data?.deleted || 0} Termin(e) gelöscht.`);
      setCalSelectedIds(new Set());
      loadCalendarAppointments(calMonth.year, calMonth.month);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Löschen');
    } finally {
      setCalDeleting(false);
    }
  };

  // ── Confirm / Cancel appointment ───────────────────────────────────
  const handleConfirm = async (id: number) => {
    try {
      await api.bl.confirmAppointment(id);
      showFlash('Termin bestätigt.');
      loadRequests();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Termin wirklich absagen?')) return;
    try {
      await api.bl.cancelAppointment(id);
      showFlash('Termin abgesagt.');
      loadRequests();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  // ── Topic CRUD ─────────────────────────────────────────────────────
  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicForm.name.trim()) { alert('Name ist Pflicht.'); return; }
    try {
      if (editingTopicId) {
        await api.bl.updateTopic(editingTopicId, topicForm);
        showFlash('Thema aktualisiert.');
      } else {
        await api.bl.createTopic(topicForm);
        showFlash('Thema erstellt.');
      }
      setShowTopicForm(false);
      setEditingTopicId(null);
      setTopicForm(emptyTopic);
      loadAdminData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleEditTopic = (t: Topic) => {
    setTopicForm({
      name: t.name,
      description: t.description || '',
      sort_order: t.sort_order || 0,
    });
    setEditingTopicId(t.id);
    setShowTopicForm(true);
  };

  // ── Status label helper ────────────────────────────────────────────
  const statusLabel = (s: string) => {
    switch (s) {
      case 'available': return 'Frei';
      case 'requested': return 'Angefragt';
      case 'confirmed': return 'Bestätigt';
      case 'cancelled': return 'Abgesagt';
      case 'completed': return 'Abgeschlossen';
      default: return s;
    }
  };

  // ── Tab definitions ────────────────────────────────────────────────
  const blTabs: [Tab, string][] = isBLUser ? [
    ['sprechzeiten', 'Meine Sprechzeiten'],
    ['termine', 'Termine verwalten'],
    ['anfragen', 'Anfragen'],
  ] : [];
  const adminTabs: [Tab, string][] = isAdmin ? [
    ['counselors', 'Alle Berater'],
    ['topics', 'Themen'],
  ] : [];
  const allTabs = [...adminTabs, ...blTabs];

  if (loading) return <div className="admin-dashboard"><div className="admin-main"><p>Lade...</p></div></div>;

  if (!profile && !isAdmin) {
    return (
      <div className="admin-dashboard">
        <div className="admin-main">
          <div className="admin-section-header"><h2>Beratungslehrkräfte</h2></div>
          <div className="admin-error">Kein Profil als Beratungslehrkraft zugeordnet. Bitte wenden Sie sich an einen Administrator.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-main">
        <div className="admin-section-header">
          <h2>Beratungslehrkräfte</h2>
        </div>

        {flash && <div className="admin-success">{flash}</div>}
        {error && <div className="admin-error">{error}</div>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {allTabs.map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Meine Sprechzeiten ──────────────────────────────── */}
        {tab === 'sprechzeiten' && profile && (
          <>
            <div className="admin-section-header">
              <h3>Wochenplan</h3>
            </div>

            <div style={{ padding: '1rem', background: 'var(--brand-surface-1)', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <p style={{ margin: 0, color: 'var(--color-gray-500)' }}>
                Legen Sie fest, an welchen Tagen und zu welchen Zeiten Sie für Beratungen zur Verfügung stehen.
                Termine werden anhand dieses Wochenplans generiert.
              </p>
            </div>

            <div className="teacher-form-container">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {schedule.map((entry, idx) => (
                  <div key={entry.weekday} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem',
                    background: entry.active ? 'var(--color-white)' : 'var(--color-gray-50)',
                    borderRadius: '0.375rem', border: '1px solid var(--color-gray-200)',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '140px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={entry.active}
                        onChange={e => {
                          const next = [...schedule];
                          next[idx] = { ...entry, active: e.target.checked };
                          setSchedule(next);
                        }}
                      />
                      <span style={{ fontWeight: 500 }}>{WEEKDAY_LABELS[idx]}</span>
                    </label>
                    {entry.active && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="time"
                          value={entry.start_time}
                          onChange={e => {
                            const next = [...schedule];
                            next[idx] = { ...entry, start_time: e.target.value };
                            setSchedule(next);
                          }}
                          style={{ padding: '0.25rem 0.5rem' }}
                        />
                        <span>bis</span>
                        <input
                          type="time"
                          value={entry.end_time}
                          onChange={e => {
                            const next = [...schedule];
                            next[idx] = { ...entry, end_time: e.target.value };
                            setSchedule(next);
                          }}
                          style={{ padding: '0.25rem 0.5rem' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button className="btn-primary" onClick={handleSaveSchedule} disabled={scheduleSaving}>
                  {scheduleSaving ? 'Speichere...' : 'Sprechzeiten speichern'}
                </button>
              </div>
            </div>

            {profile.room && (
              <div style={{ marginTop: '1rem', color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>
                Raum: <strong>{profile.room}</strong> | Terminlänge: <strong>{profile.slot_duration_minutes || 30} Min.</strong>
              </div>
            )}
          </>
        )}

        {/* ── Termine verwalten ───────────────────────────────── */}
        {tab === 'termine' && profile && (
          <>
            <div className="admin-section-header">
              <h3>Termine verwalten</h3>
            </div>

            <div className="teacher-form-container" style={{ marginBottom: '1rem' }}>
              <form className="teacher-form" onSubmit={e => { e.preventDefault(); handleGenerateSlots(); }}>
                <div className="form-group">
                  <label>Termine freischalten für Zeitraum</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="date" min={today} value={slotGenFrom} onChange={e => setSlotGenFrom(e.target.value)} />
                    <span>bis</span>
                    <input type="date" min={slotGenFrom || today} value={slotGenUntil} onChange={e => setSlotGenUntil(e.target.value)} />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn-primary" type="submit" disabled={generating}>
                    {generating ? 'Generiere...' : 'Termine freischalten'}
                  </button>
                </div>
              </form>
            </div>

            {renderCalendar(calMonth, calAppointments, calLoading, calSelectedDate, calSelectedIds, today,
              setCalMonth, setCalSelectedDate, setCalSelectedIds, calDeleting, handleDeleteSelectedAppointments, statusLabel)}
          </>
        )}

        {/* ── Anfragen ────────────────────────────────────────── */}
        {tab === 'anfragen' && (
          <>
            <div className="admin-section-header">
              <h3>Buchungsanfragen</h3>
            </div>

            {requestsLoading ? (
              <p>Lade Anfragen...</p>
            ) : requests.length === 0 ? (
              <div style={{ padding: '1rem', background: 'var(--brand-surface-1)', borderRadius: '0.5rem' }}>
                <p style={{ margin: 0, color: 'var(--color-gray-500)' }}>Keine offenen Anfragen vorhanden.</p>
              </div>
            ) : (
              <div className="admin-resp-table-container">
                <table className="admin-resp-table">
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Uhrzeit</th>
                      <th>Status</th>
                      <th>Schüler/in</th>
                      <th>Klasse</th>
                      <th>Thema</th>
                      <th>Anliegen</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(a => {
                      const dateStr = typeof a.date === 'string' ? a.date.slice(0, 10) : new Date(a.date).toISOString().slice(0, 10);
                      return (
                        <tr key={a.id}>
                          <td>{new Date(dateStr + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                          <td style={{ fontWeight: 500 }}>{a.time?.toString().slice(0, 5)}</td>
                          <td>
                            <span style={{
                              padding: '0.15rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.85rem',
                              background: a.status === 'requested' ? 'var(--color-warning-light)' : 'var(--color-success-light)',
                              color: a.status === 'requested' ? 'var(--color-warning, #d97706)' : 'var(--color-success-accent)',
                            }}>
                              {statusLabel(a.status)}
                            </span>
                          </td>
                          <td>{a.student_name || '--'}</td>
                          <td>{a.student_class || '--'}</td>
                          <td>{a.topic_name || '--'}</td>
                          <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.concern || '--'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              {a.status === 'requested' && (
                                <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                                  onClick={() => handleConfirm(a.id)}>
                                  Bestätigen
                                </button>
                              )}
                              {(a.status === 'requested' || a.status === 'confirmed') && (
                                <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', color: 'var(--color-error, #dc2626)' }}
                                  onClick={() => handleCancel(a.id)}>
                                  Absagen
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Admin: Alle Berater ─────────────────────────────── */}
        {tab === 'counselors' && isAdmin && (
          <>
            <div className="admin-section-header">
              <h3>Alle Beratungslehrkräfte</h3>
            </div>

            <div style={{ padding: '1rem', background: 'var(--brand-surface-1)', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <p style={{ margin: 0, color: 'var(--color-gray-500)' }}>
                Beratungslehrkräfte werden über <strong>Benutzer &amp; Rechte</strong> angelegt und bearbeitet.
                Aktivieren Sie dort beim Anlegen oder Bearbeiten eines Nutzers die Sektion &quot;Beratungslehrkräfte&quot;.
              </p>
            </div>

            <div className="admin-resp-table-container">
              <table className="admin-resp-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>E-Mail</th>
                    <th>Raum</th>
                    <th>Zeiten</th>
                  </tr>
                </thead>
                <tbody>
                  {counselors.length === 0 ? (
                    <tr><td colSpan={4}>Keine Beratungslehrkräfte vorhanden.</td></tr>
                  ) : counselors.map(c => (
                    <tr key={c.id}>
                      <td>{c.salutation ? `${c.salutation} ` : ''}{c.name}</td>
                      <td>{c.email || '--'}</td>
                      <td>{c.room || '--'}</td>
                      <td>
                        {(() => {
                          const sch = (adminSchedulesMap[c.id] || []).filter(s => s.active);
                          if (sch.length === 0) return `${c.available_from?.toString().slice(0, 5) || '--'} -- ${c.available_until?.toString().slice(0, 5) || '--'}`;
                          return sch.map(s => `${WEEKDAY_SHORT[s.weekday - 1] || '?'} ${s.start_time?.toString().slice(0, 5)}--${s.end_time?.toString().slice(0, 5)}`).join(', ');
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Admin: Themen ───────────────────────────────────── */}
        {tab === 'topics' && isAdmin && (
          <>
            <div className="admin-section-header">
              <h3>Themen</h3>
              <button
                className="btn-primary"
                onClick={() => { setTopicForm(emptyTopic); setEditingTopicId(null); setShowTopicForm(true); }}
              >
                + Neues Thema
              </button>
            </div>

            {showTopicForm && (
              <div className="teacher-form-container">
                <h3>{editingTopicId ? 'Thema bearbeiten' : 'Neues Thema'}</h3>
                <form className="teacher-form" onSubmit={handleSaveTopic}>
                  <div className="form-group">
                    <label htmlFor="bl-topic-name">Name</label>
                    <input id="bl-topic-name" type="text" value={topicForm.name} onChange={e => setTopicForm({ ...topicForm, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="bl-topic-desc">Beschreibung</label>
                    <input id="bl-topic-desc" type="text" value={topicForm.description} onChange={e => setTopicForm({ ...topicForm, description: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="bl-topic-sort">Sortierung</label>
                    <input id="bl-topic-sort" type="number" value={topicForm.sort_order} onChange={e => setTopicForm({ ...topicForm, sort_order: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="form-actions">
                    <button className="btn-primary" type="submit">{editingTopicId ? 'Speichern' : 'Erstellen'}</button>
                    <button className="btn-secondary" type="button" onClick={() => { setShowTopicForm(false); setEditingTopicId(null); }}>Abbrechen</button>
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
                  {topics.length === 0 ? (
                    <tr><td colSpan={4}>Keine Themen vorhanden.</td></tr>
                  ) : topics.map(t => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.description || '--'}</td>
                      <td>{t.sort_order}</td>
                      <td>
                        <button className="btn-secondary" onClick={() => handleEditTopic(t)}>Bearbeiten</button>
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

// ── Calendar rendering (shared between BL and admin) ─────────────────
function renderCalendar(
  calMonth: { year: number; month: number },
  calAppointments: Appointment[],
  calLoading: boolean,
  calSelectedDate: string | null,
  calSelectedIds: Set<number>,
  today: string,
  setCalMonth: React.Dispatch<React.SetStateAction<{ year: number; month: number }>>,
  setCalSelectedDate: React.Dispatch<React.SetStateAction<string | null>>,
  setCalSelectedIds: React.Dispatch<React.SetStateAction<Set<number>>>,
  calDeleting: boolean,
  handleDeleteSelected: () => void,
  statusLabel: (s: string) => string,
) {
  const { year, month } = calMonth;

  return (
    <>
      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button className="btn-secondary" onClick={() => setCalMonth(prev => {
          const d = new Date(prev.year, prev.month - 1, 1);
          return { year: d.getFullYear(), month: d.getMonth() };
        })}>&lt;</button>
        <span style={{ fontWeight: 600, fontSize: '1.1rem', minWidth: '160px', textAlign: 'center' }}>
          {new Date(year, month).toLocaleString('de-DE', { month: 'long', year: 'numeric' })}
        </span>
        <button className="btn-secondary" onClick={() => setCalMonth(prev => {
          const d = new Date(prev.year, prev.month + 1, 1);
          return { year: d.getFullYear(), month: d.getMonth() };
        })}>&gt;</button>
      </div>

      {calLoading ? (
        <p>Lade Termine...</p>
      ) : (
        <>
          {(() => {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0).getDate();
            let startOffset = firstDay.getDay() - 1;
            if (startOffset < 0) startOffset = 6;

            const byDate: Record<string, Appointment[]> = {};
            for (const a of calAppointments) {
              const ds = typeof a.date === 'string' ? a.date.slice(0, 10) : new Date(a.date).toISOString().slice(0, 10);
              (byDate[ds] ||= []).push(a);
            }

            const cells: React.ReactNode[] = [];
            for (const label of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) {
              cells.push(
                <div key={`h-${label}`} style={{ fontWeight: 600, textAlign: 'center', padding: '0.3rem', fontSize: '0.85rem', color: 'var(--color-gray-600)' }}>
                  {label}
                </div>
              );
            }
            for (let i = 0; i < startOffset; i++) {
              cells.push(<div key={`e-${i}`} />);
            }
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
                    borderRadius: '0.375rem', padding: '0.3rem', textAlign: 'center',
                    cursor: count > 0 ? 'pointer' : 'default',
                    background: isSelected ? 'var(--brand-surface-2)' : count > 0 ? 'var(--color-white)' : 'var(--color-gray-50)',
                    opacity: isPast ? 0.5 : 1,
                    minHeight: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
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
                          if (allSelected) setCalSelectedIds(new Set());
                          else setCalSelectedIds(new Set(dayAppts.map(a => a.id)));
                        }}
                      />
                      Alle
                    </label>
                    {calSelectedIds.size > 0 && (
                      <button
                        className="btn-secondary"
                        style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.85rem' }}
                        disabled={calDeleting}
                        onClick={handleDeleteSelected}
                      >
                        {calDeleting ? 'Lösche...' : `${calSelectedIds.size} löschen`}
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
                        <th>Thema</th>
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
                          <td>{a.student_name || '--'}</td>
                          <td>{a.topic_name || '--'}</td>
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
  );
}
