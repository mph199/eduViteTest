import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/useAuth';
import { useActiveView } from '../../../hooks/useActiveView';
import { useBgStyle } from '../../../hooks/useBgStyle';
import { useFlash } from '../../../hooks/useFlash';
import type { Counselor, ScheduleEntry, CounselorTopic as Topic, CounselorAppointment as Appointment } from '../../../types';
import api from '../../../services/api';
import { AdminPageWrapper } from '../../../shared/components/AdminPageWrapper';
import { CalendarPanel } from '../../../shared/components/CalendarPanel';
import { WEEKDAY_LABELS, WEEKDAY_SHORT } from '../../../shared/constants/weekdays';
import { normalizeDate } from '../../../shared/utils/appointmentDate';
import '../../../pages/AdminDashboard.css';

type Tab = 'sprechzeiten' | 'termine' | 'anfragen' | 'counselors' | 'topics';

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
  useActiveView('admin');
  const adminBgStyle = useBgStyle('admin', '--page-bg');
  const [flash, showFlash] = useFlash();

  const [tab, setTab] = useState<Tab>(isAdmin ? 'counselors' : 'sprechzeiten');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) return <AdminPageWrapper style={adminBgStyle}><p>Lade...</p></AdminPageWrapper>;

  if (!profile && !isAdmin) {
    return (
      <AdminPageWrapper style={adminBgStyle}>
        <div className="admin-section-header"><h2>Beratungslehrkräfte</h2></div>
        <div className="admin-error">Kein Profil als Beratungslehrkraft zugeordnet. Bitte wenden Sie sich an einen Administrator.</div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper style={adminBgStyle}>
      <div className="admin-section-header">
        <h2>Beratungslehrkräfte</h2>
      </div>

      {flash && <div className="admin-success">{flash}</div>}
      {error && <div className="admin-error">{error}</div>}

      {/* Tabs */}
      <div className="module-tabs">
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

          <div className="info-banner">
            <p>
              Legen Sie fest, an welchen Tagen und zu welchen Zeiten Sie für Beratungen zur Verfügung stehen.
              Termine werden anhand dieses Wochenplans generiert.
            </p>
          </div>

          <div className="teacher-form-container">
            <div className="schedule-list">
              {schedule.map((entry, idx) => (
                <div key={entry.weekday} className={`schedule-row ${entry.active ? 'schedule-row--active' : 'schedule-row--inactive'}`}>
                  <label className="schedule-row__label">
                    <input
                      type="checkbox"
                      checked={entry.active}
                      onChange={e => {
                        const next = [...schedule];
                        next[idx] = { ...entry, active: e.target.checked };
                        setSchedule(next);
                      }}
                    />
                    <span>{WEEKDAY_LABELS[idx]}</span>
                  </label>
                  {entry.active && (
                    <div className="schedule-row__times">
                      <input
                        type="time"
                        value={entry.start_time}
                        onChange={e => {
                          const next = [...schedule];
                          next[idx] = { ...entry, start_time: e.target.value };
                          setSchedule(next);
                        }}
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
            <div className="profile-meta">
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
                <div className="date-range-row">
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

          <CalendarPanel
            calMonth={calMonth}
            setCalMonth={setCalMonth}
            appointments={calAppointments}
            loading={calLoading}
            selectedDate={calSelectedDate}
            setSelectedDate={setCalSelectedDate}
            selectedIds={calSelectedIds}
            setSelectedIds={setCalSelectedIds}
            deleting={calDeleting}
            onDeleteSelected={handleDeleteSelectedAppointments}
            statusLabel={statusLabel}
            today={today}
          />
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
            <div className="info-banner">
              <p>Keine offenen Anfragen vorhanden.</p>
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
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(a => {
                    const dateStr = normalizeDate(a.date);
                    return (
                      <tr key={a.id}>
                        <td data-label="Datum">{new Date(dateStr + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                        <td data-label="Uhrzeit" className="cell-bold">{a.time?.toString().slice(0, 5)}</td>
                        <td data-label="Status">
                          <span className={`status-pill ${a.status === 'requested' ? 'status-pill--requested' : 'status-pill--confirmed'}`}>
                            {statusLabel(a.status)}
                          </span>
                        </td>
                        <td data-label="Name">{a.student_name || '--'}</td>
                        <td data-label="Klasse">{a.student_class || '--'}</td>
                        <td data-label="Thema">{a.topic_name || '--'}</td>
                        <td data-label="Aktionen">
                          <div className="action-btns action-btns--sm">
                            {a.status === 'requested' && (
                              <button className="btn-primary btn--sm"
                                onClick={() => handleConfirm(a.id)}>
                                Bestätigen
                              </button>
                            )}
                            {(a.status === 'requested' || a.status === 'confirmed') && (
                              <button className="btn-secondary btn--sm btn--danger"
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

          <div className="info-banner">
            <p>
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
                    <td data-label="Name">{c.salutation ? `${c.salutation} ` : ''}{c.name}</td>
                    <td data-label="E-Mail">{c.email || '--'}</td>
                    <td data-label="Raum">{c.room || '--'}</td>
                    <td data-label="Zeiten">
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
                    <td data-label="Name">{t.name}</td>
                    <td data-label="Beschreibung">{t.description || '--'}</td>
                    <td data-label="Reihenfolge">{t.sort_order}</td>
                    <td data-label="Aktionen">
                      <button className="btn-secondary" onClick={() => handleEditTopic(t)}>Bearbeiten</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminPageWrapper>
  );
}
