import { useState, useEffect, useCallback } from 'react';
import type { Counselor, CounselorAppointment as Appointment } from '../../../types';
import api from '../../../services/api';

interface Props {
  counselors: Counselor[];
  showFlash: (msg: string) => void;
  loadData: () => void;
}

export function SSWTermineTab({ counselors, showFlash, loadData }: Props) {
  const [calCounselorId, setCalCounselorId] = useState<number | null>(null);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [calAppointments, setCalAppointments] = useState<Appointment[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null);
  const [calSelectedIds, setCalSelectedIds] = useState<Set<number>>(new Set());
  const [calDeleting, setCalDeleting] = useState(false);

  const [slotGenFrom, setSlotGenFrom] = useState('');
  const [slotGenUntil, setSlotGenUntil] = useState('');
  const [generating, setGenerating] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const loadCalendarAppointments = useCallback(async (counselorId: number, year: number, month: number) => {
    setCalLoading(true);
    try {
      const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const dateUntil = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const data = await api.ssw.getAdminAppointments(counselorId, dateFrom, dateUntil);
      setCalAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
    } catch {
      setCalAppointments([]);
    } finally {
      setCalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (calCounselorId) {
      loadCalendarAppointments(calCounselorId, calMonth.year, calMonth.month);
      setCalSelectedDate(null);
      setCalSelectedIds(new Set());
    }
  }, [calCounselorId, calMonth, loadCalendarAppointments]);

  const handleGenerateSlots = async () => {
    if (!calCounselorId || !slotGenFrom || !slotGenUntil) {
      alert('Bitte Berater/in und Zeitraum waehlen.');
      return;
    }
    setGenerating(true);
    try {
      const data = await api.ssw.generateSlots(calCounselorId, slotGenFrom, slotGenUntil);
      showFlash(`${data.created || 0} Termine erstellt (${data.skipped || 0} uebersprungen).`);
      setSlotGenFrom('');
      setSlotGenUntil('');
      loadCalendarAppointments(calCounselorId, calMonth.year, calMonth.month);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteSelectedAppointments = async () => {
    if (calSelectedIds.size === 0) return;
    const count = calSelectedIds.size;
    if (!confirm(`${count} Termin(e) wirklich loeschen?`)) return;
    setCalDeleting(true);
    try {
      const data = await api.ssw.deleteAppointments(Array.from(calSelectedIds));
      showFlash(`${data.deleted || 0} Termin(e) geloescht.`);
      setCalSelectedIds(new Set());
      if (calCounselorId) loadCalendarAppointments(calCounselorId, calMonth.year, calMonth.month);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Loeschen');
    } finally {
      setCalDeleting(false);
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'available': return 'Frei';
      case 'requested': return 'Angefragt';
      case 'confirmed': return 'Bestaetigt';
      case 'cancelled': return 'Abgesagt';
      case 'completed': return 'Abgeschlossen';
      default: return s;
    }
  };

  return (
    <>
      <div className="admin-section-header">
        <h3>Terminverwaltung</h3>
      </div>

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
              <option value="">– Bitte waehlen –</option>
              {counselors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Slots freischalten fuer Zeitraum</label>
            <div className="date-range-row">
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
          <div className="cal-nav">
            <button
              className="btn-secondary"
              onClick={() => setCalMonth(prev => {
                const d = new Date(prev.year, prev.month - 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}
            >
              &lt;
            </button>
            <span className="cal-nav__label">
              {new Date(calMonth.year, calMonth.month).toLocaleString('de-DE', { month: 'long', year: 'numeric' })}
            </span>
            <button
              className="btn-secondary"
              onClick={() => setCalMonth(prev => {
                const d = new Date(prev.year, prev.month + 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}
            >
              &gt;
            </button>
          </div>

          {calLoading ? (
            <p>Lade Termine…</p>
          ) : (
            <>
              {(() => {
                const year = calMonth.year;
                const month = calMonth.month;
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
                  cells.push(<div key={`h-${label}`} className="cal-grid__header">{label}</div>);
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

                  const dayCls = ['cal-day',
                    count > 0 && 'cal-day--has-appts',
                    isSelected && 'cal-day--selected',
                    isPast && 'cal-day--past',
                  ].filter(Boolean).join(' ');

                  cells.push(
                    <div
                      key={d}
                      onClick={() => { setCalSelectedDate(isSelected ? null : ds); setCalSelectedIds(new Set()); }}
                      className={dayCls}
                    >
                      <div className="cal-day__number">{d}</div>
                      {count > 0 && (
                        <div className="cal-day__count">
                          <span className="cal-day__count-text">{count} Termin{count !== 1 ? 'e' : ''}</span>
                          {hasBooked && <span className="cal-day__booked-marker">*</span>}
                        </div>
                      )}
                    </div>
                  );
                }

                return <div className="cal-grid">{cells}</div>;
              })()}

              {calSelectedDate && (() => {
                const dayAppts = calAppointments
                  .filter(a => {
                    const ds = typeof a.date === 'string' ? a.date.slice(0, 10) : new Date(a.date).toISOString().slice(0, 10);
                    return ds === calSelectedDate;
                  })
                  .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

                if (dayAppts.length === 0) return (
                  <div className="cal-day-panel">
                    <strong>{new Date(calSelectedDate + 'T00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                    <p style={{ marginTop: '0.5rem', color: 'var(--color-gray-500)' }}>Keine Termine an diesem Tag.</p>
                  </div>
                );

                const allSelected = dayAppts.every(a => calSelectedIds.has(a.id));

                return (
                  <div className="cal-day-panel">
                    <div className="cal-day-panel__header">
                      <strong>{new Date(calSelectedDate + 'T00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                      <div className="cal-day-panel__actions">
                        <label className="cal-day-panel__select-all">
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
                            className="btn-secondary btn--sm btn--danger"
                            disabled={calDeleting}
                            onClick={handleDeleteSelectedAppointments}
                          >
                            {calDeleting ? 'Loesche…' : `${calSelectedIds.size} loeschen`}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="admin-resp-table-container">
                      <table className="admin-resp-table">
                        <thead>
                          <tr>
                            <th></th>
                            <th>Uhrzeit</th>
                            <th>Status</th>
                            <th>Schueler/in</th>
                            <th>Kategorie</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayAppts.map(a => (
                            <tr key={a.id} className={calSelectedIds.has(a.id) ? 'row--selected' : undefined}>
                              <td data-label="">
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
                              <td data-label="Uhrzeit" className="cell-bold">{a.time?.toString().slice(0, 5)}</td>
                              <td data-label="Status">{statusLabel(a.status)}</td>
                              <td data-label="Name">{a.student_name || '–'}</td>
                              <td data-label="Kategorie">{a.category_name || '–'}</td>
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
  );
}
