import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/useAuth';
import { useActiveView } from '../../../hooks/useActiveView';
import { useBgStyle } from '../../../hooks/useBgStyle';
import { useFlash } from '../../../hooks/useFlash';
import type { Counselor, ScheduleEntry, CounselorTopic as Topic } from '../../../types';
import api from '../../../services/api';
import { AdminPageWrapper } from '../../../shared/components/AdminPageWrapper';
import { BLSprechzeitenTab } from './BLSprechzeitenTab';
import { BLTermineTab } from './BLTermineTab';
import { BLAnfragenTab } from './BLAnfragenTab';
import { BLCounselorsTab } from './BLCounselorsTab';
import { BLTopicsTab } from './BLTopicsTab';
import '../../../pages/AdminDashboard.css';

type Tab = 'sprechzeiten' | 'termine' | 'anfragen' | 'counselors' | 'topics';

const defaultSchedule: ScheduleEntry[] = [1, 2, 3, 4, 5].map(wd => ({
  weekday: wd,
  start_time: '08:00',
  end_time: '14:00',
  active: false,
}));

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

  // Admin tabs state
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [adminSchedulesMap, setAdminSchedulesMap] = useState<Record<number, ScheduleEntry[]>>({});
  const [topics, setTopics] = useState<Topic[]>([]);

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
      const entries: ScheduleEntry[] = Array.isArray(data?.schedule) ? data.schedule : [];
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

  // ── Load admin data ────────────────────────────────────────────────
  const loadAdminData = useCallback(async () => {
    try {
      const [cData, tData] = await Promise.all([
        api.bl.getAdminCounselors(),
        api.bl.getAdminTopics(),
      ]);
      const cList: Counselor[] = Array.isArray(cData?.counselors) ? cData.counselors : [];
      setCounselors(cList);
      setTopics(Array.isArray(tData?.topics) ? tData.topics : []);
      if (cList.length > 0) {
        const scheduleResults = await Promise.all(
          cList.map(c => api.bl.getAdminCounselorSchedule(c.id).catch(() => ({ schedule: [] })))
        );
        const map: Record<number, ScheduleEntry[]> = {};
        cList.forEach((c, i) => { map[c.id] = Array.isArray(scheduleResults[i]?.schedule) ? scheduleResults[i].schedule : []; });
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

      {tab === 'sprechzeiten' && profile && (
        <BLSprechzeitenTab profile={profile} initialSchedule={schedule} showFlash={showFlash} />
      )}
      {tab === 'termine' && profile && (
        <BLTermineTab profile={profile} showFlash={showFlash} />
      )}
      {tab === 'anfragen' && (
        <BLAnfragenTab showFlash={showFlash} />
      )}
      {tab === 'counselors' && isAdmin && (
        <BLCounselorsTab counselors={counselors} schedulesMap={adminSchedulesMap} />
      )}
      {tab === 'topics' && isAdmin && (
        <BLTopicsTab topics={topics} showFlash={showFlash} loadAdminData={loadAdminData} />
      )}
    </AdminPageWrapper>
  );
}
