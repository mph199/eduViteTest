import { useState, useEffect, useCallback } from 'react';
import type { Counselor, CounselorAppointment as Appointment } from '../../../types';
import api from '../../../services/api';
import { CalendarPanel } from '../../../shared/components/CalendarPanel';
import { statusLabel } from '../../../shared/utils/statusLabel';
import { getMonthRange } from '../../../shared/utils/dateRange';

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
      const { dateFrom, dateUntil } = getMonthRange(year, month);
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
              {generating ? 'Generiere...' : 'Termine freischalten'}
            </button>
          </div>
        </form>
      </div>

      {calCounselorId && (
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
          detailColumnLabel="Kategorie"
          detailColumnValue={a => a.category_name}
        />
      )}
    </>
  );
}
