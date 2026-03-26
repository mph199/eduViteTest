import { useState, useEffect, useCallback } from 'react';
import type { Counselor, ScheduleEntry } from '../../../types';
import { useActiveView } from '../../../hooks/useActiveView';
import { useBgStyle } from '../../../hooks/useBgStyle';
import { useFlash } from '../../../hooks/useFlash';
import api from '../../../services/api';
import { AdminPageWrapper } from '../../../shared/components/AdminPageWrapper';
import { loadSchedulesMap } from '../../../shared/utils/schedule';
import { SSWCounselorsTab } from './SSWCounselorsTab';
import { SSWTermineTab } from './SSWTermineTab';
import { SSWAnfragenTab } from './SSWAnfragenTab';
import '../../../pages/AdminDashboard.css';

type Tab = 'counselors' | 'termine' | 'anfragen';

export function SSWAdmin() {
  useActiveView('admin');
  const adminBgStyle = useBgStyle('admin', '--page-bg');
  const [flash, showFlash] = useFlash();

  const [tab, setTab] = useState<Tab>('counselors');
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ username: string; tempPassword: string } | null>(null);
  const [schedulesMap, setSchedulesMap] = useState<Record<number, ScheduleEntry[]>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cData = await api.ssw.getAdminCounselors();
      const cList: Counselor[] = Array.isArray(cData?.counselors) ? cData.counselors : [];
      setCounselors(cList);
      setSchedulesMap(await loadSchedulesMap(cList, api.ssw.getAdminCounselorSchedule));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <AdminPageWrapper style={adminBgStyle}><p>Lade...</p></AdminPageWrapper>;

  return (
    <AdminPageWrapper style={adminBgStyle}>
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
        {([['counselors', 'Berater/innen'], ['termine', 'Terminverwaltung'], ['anfragen', 'Anfragen']] as [Tab, string][]).map(([key, label]) => (
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
    </AdminPageWrapper>
  );
}
