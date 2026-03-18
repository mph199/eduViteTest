import { useState, useEffect, useCallback } from 'react';
import type { Counselor, ScheduleEntry, CounselorTopic as Category } from '../../../types';
import { useBgStyle } from '../../../hooks/useBgStyle';
import api from '../../../services/api';
import { SSWCounselorsTab } from './SSWCounselorsTab';
import { SSWTermineTab } from './SSWTermineTab';
import { SSWAnfragenTab } from './SSWAnfragenTab';
import { SSWCategoriesTab } from './SSWCategoriesTab';
import '../../../pages/AdminDashboard.css';

type Tab = 'counselors' | 'categories' | 'termine' | 'anfragen';

export function SSWAdmin() {
  const adminBgStyle = useBgStyle('admin', '--page-bg');
  const [tab, setTab] = useState<Tab>('counselors');
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ username: string; tempPassword: string } | null>(null);
  const [schedulesMap, setSchedulesMap] = useState<Record<number, ScheduleEntry[]>>({});

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 3000); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cData, catData] = await Promise.all([
        api.ssw.getAdminCounselors(),
        api.ssw.getAdminCategories(),
      ]);
      setCounselors(Array.isArray(cData?.counselors) ? cData.counselors : []);
      setCategories(Array.isArray(catData?.categories) ? catData.categories : []);
      const cList: Counselor[] = Array.isArray(cData?.counselors) ? cData.counselors : [];
      if (cList.length > 0) {
        const scheduleResults = await Promise.all(
          cList.map(c => api.ssw.getAdminCounselorSchedule(c.id).catch(() => ({ schedule: [] })))
        );
        const map: Record<number, ScheduleEntry[]> = {};
        cList.forEach((c, i) => { map[c.id] = scheduleResults[i]?.schedule || []; });
        setSchedulesMap(map);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="admin-dashboard admin-dashboard--admin page-bg-overlay page-bg-overlay--subtle" style={adminBgStyle}><main className="admin-main"><p>Lade…</p></main></div>;

  return (
    <div className="admin-dashboard admin-dashboard--admin page-bg-overlay page-bg-overlay--subtle" style={adminBgStyle}>
      <main className="admin-main">
        <div className="admin-section-header">
          <h2>Schulsozialarbeit</h2>
        </div>

        {flash && <div className="admin-success">{flash}</div>}
        {createdCreds && (
          <div className="creds-box">
            <strong>Zugangsdaten erstellt:</strong>
            <div className="creds-box__mono">
              Benutzername: <strong>{createdCreds.username}</strong><br />
              Passwort: <strong>{createdCreds.tempPassword}</strong>
            </div>
            <p className="creds-box__hint">
              Bitte Zugangsdaten notieren — das Passwort wird nicht erneut angezeigt.
            </p>
            <button className="btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => setCreatedCreds(null)}>Schliessen</button>
          </div>
        )}
        {error && <div className="admin-error">{error}</div>}

        <div className="module-tabs">
          {([['counselors', 'Berater/innen'], ['termine', 'Terminverwaltung'], ['anfragen', 'Anfragen'], ['categories', 'Themen']] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'counselors' && (
          <SSWCounselorsTab
            counselors={counselors}
            schedulesMap={schedulesMap}
            showFlash={showFlash}
            loadData={loadData}
            setCreatedCreds={setCreatedCreds}
          />
        )}
        {tab === 'termine' && (
          <SSWTermineTab
            counselors={counselors}
            showFlash={showFlash}
            loadData={loadData}
          />
        )}
        {tab === 'anfragen' && <SSWAnfragenTab showFlash={showFlash} />}
        {tab === 'categories' && (
          <SSWCategoriesTab
            categories={categories}
            showFlash={showFlash}
            loadData={loadData}
          />
        )}
      </main>
    </div>
  );
}
