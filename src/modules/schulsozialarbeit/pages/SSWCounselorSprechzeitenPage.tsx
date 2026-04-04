import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../../services/api';
import { WEEKDAY_LABELS } from '../../../shared/constants/weekdays';
import { buildDefaultSchedule } from '../../../shared/utils/schedule';
import type { ScheduleEntry } from '../../../types';
import type { SSWCounselorContext } from './SSWCounselorLayout';

const defaultSchedule: ScheduleEntry[] = buildDefaultSchedule([1, 2, 3, 4, 5]);

export function SSWCounselorSprechzeitenPage() {
  const { profile, schedule: initialSchedule, showFlash } = useOutletContext<SSWCounselorContext>();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(
    initialSchedule.length > 0 ? initialSchedule : defaultSchedule
  );
  const [saving, setSaving] = useState(false);

  if (!profile) return <p>Kein Berater-Profil gefunden.</p>;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.ssw.updateSchedule(schedule);
      showFlash('Sprechzeiten gespeichert.');
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
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
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichere...' : 'Sprechzeiten speichern'}
          </button>
        </div>
      </div>

      {profile.room && (
        <div className="profile-meta">
          Raum: <strong>{profile.room}</strong> | Terminlänge: <strong>{profile.slot_duration_minutes || 30} Min.</strong>
        </div>
      )}
    </>
  );
}
