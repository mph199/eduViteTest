/**
 * BLCounselorLayout — Layout für die Berater-eigene BL-Ansicht im Lehrkraftbereich.
 *
 * Lädt Profil und Wochenplan des eingeloggten Beraters und
 * stellt sie als Outlet-Context für die Unterseiten bereit.
 */

import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useBgStyle } from '../../../hooks/useBgStyle';
import api from '../../../services/api';
import type { Counselor, ScheduleEntry } from '../../../types';
import '../../../pages/AdminDashboard.css';

export interface BLCounselorContext {
  profile: Counselor | null;
  schedule: ScheduleEntry[];
  showFlash: (msg: string) => void;
}

export function BLCounselorLayout() {
  const adminBgStyle = useBgStyle('admin', '--page-bg');
  const [profile, setProfile] = useState<Counselor | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 4000);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, scheduleRes] = await Promise.all([
          api.bl.getProfile(),
          api.bl.getSchedule(),
        ]);
        setProfile((profileRes as { counselor?: Counselor })?.counselor || null);
        const sched = (scheduleRes as { schedule?: ScheduleEntry[] })?.schedule;
        setSchedule(Array.isArray(sched) ? sched : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ctx: BLCounselorContext = { profile, schedule, showFlash };

  if (loading) {
    return (
      <div className="admin-dashboard admin-dashboard--teacher page-bg-overlay page-bg-overlay--subtle" style={adminBgStyle}>
        <div className="admin-main"><p>Lade...</p></div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard admin-dashboard--teacher page-bg-overlay page-bg-overlay--subtle" style={adminBgStyle}>
      <div className="admin-main">
        {error && <div className="admin-error">{error}</div>}
        {flash && <div className="admin-success">{flash}</div>}
        <Outlet context={ctx} />
      </div>
    </div>
  );
}
