import { useState, useEffect, useCallback } from 'react';
import { useActiveView } from '../../../hooks/useActiveView';
import { useBgStyle } from '../../../hooks/useBgStyle';
import type { Counselor, ScheduleEntry } from '../../../types';
import api from '../../../services/api';
import { AdminPageWrapper } from '../../../shared/components/AdminPageWrapper';
import { loadSchedulesMap } from '../../../shared/utils/schedule';
import { BLCounselorsTab } from './BLCounselorsTab';
import '../../../pages/AdminDashboard.css';

export function BLAdmin() {
  useActiveView('admin');
  const adminBgStyle = useBgStyle('admin', '--page-bg');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [adminSchedulesMap, setAdminSchedulesMap] = useState<Record<number, ScheduleEntry[]>>({});

  const loadAdminData = useCallback(async () => {
    try {
      const cData = await api.bl.getAdminCounselors();
      const cList: Counselor[] = Array.isArray(cData?.counselors) ? cData.counselors : [];
      setCounselors(cList);
      setAdminSchedulesMap(await loadSchedulesMap(cList, api.bl.getAdminCounselorSchedule));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadAdminData();
      setLoading(false);
    }
    init();
  }, [loadAdminData]);

  if (loading) return <AdminPageWrapper style={adminBgStyle}><p>Lade...</p></AdminPageWrapper>;

  return (
    <AdminPageWrapper style={adminBgStyle}>
      <div className="admin-section-header">
        <h2>Beratungslehrkräfte</h2>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <BLCounselorsTab counselors={counselors} schedulesMap={adminSchedulesMap} />
    </AdminPageWrapper>
  );
}
