import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../../services/api';
import type { CounselorAppointment as Appointment } from '../../../types';
import { CalendarPanel } from '../../../shared/components/CalendarPanel';
import { statusLabel } from '../../../shared/utils/statusLabel';
import { getMonthRange } from '../../../shared/utils/dateRange';
import type { SSWCounselorContext } from './SSWCounselorLayout';

export function SSWCounselorTerminePage() {
  const { profile, showFlash } = useOutletContext<SSWCounselorContext>();

  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calAppointments, setCalAppointments] = useState<Appointment[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null);
  const [calSelectedIds, setCalSelectedIds] = useState<Set<number>>(new Set());
  const [calDeleting, setCalDeleting] = useState(false);

  const [slotGenFrom, setSlotGenFrom] = useState('');
  const [slotGenUntil, setSlotGenUntil] = useState('');
  const [generating, setGenerating] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const loadCalendarAppointments = useCallback(async (year: number, month: number) => {
    setCalLoading(true);
    try {
      const { dateFrom, dateUntil } = getMonthRange(year, month);
      const data = await api.ssw.getAppointments({ date_from: dateFrom, date_until: dateUntil });
      setCalAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
    } catch {
      setCalAppointments([]);
    } finally {
      setCalLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendarAppointments(calMonth.year, calMonth.month);
    setCalSelectedDate(null);
    setCalSelectedIds(new Set());
  }, [calMonth, loadCalendarAppointments]);

  const handleGenerateSlots = async () => {
    if (!profile || !slotGenFrom || !slotGenUntil) {
      showFlash('Bitte Zeitraum wählen.');
      return;
    }
    setGenerating(true);
    try {
      const data = await api.ssw.counselorGenerateSlots(profile.id, slotGenFrom, slotGenUntil);
      showFlash(`${data?.created || 0} Termine erstellt (${data?.skipped || 0} übersprungen).`);
      setSlotGenFrom('');
      setSlotGenUntil('');
      loadCalendarAppointments(calMonth.year, calMonth.month);
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (calSelectedIds.size === 0) return;
    if (!confirm(`${calSelectedIds.size} Termin(e) wirklich löschen?`)) return;
    setCalDeleting(true);
    try {
      const data = await api.ssw.deleteAppointments(Array.from(calSelectedIds));
      showFlash(`${data?.deleted || 0} Termin(e) gelöscht.`);
      setCalSelectedIds(new Set());
      loadCalendarAppointments(calMonth.year, calMonth.month);
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Löschen');
    } finally {
      setCalDeleting(false);
    }
  };

  if (!profile) return <p>Kein Berater-Profil gefunden.</p>;

  return (
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
        onDeleteSelected={handleDeleteSelected}
        statusLabel={statusLabel}
        today={today}
      />
    </>
  );
}
