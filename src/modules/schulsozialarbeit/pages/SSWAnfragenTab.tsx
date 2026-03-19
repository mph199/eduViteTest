import { useMemo } from 'react';
import api from '../../../services/api';
import { CounselorAnfragenTab } from '../../../shared/components/CounselorAnfragenTab';

interface Props {
  showFlash: (msg: string) => void;
}

export function SSWAnfragenTab({ showFlash }: Props) {
  const config = useMemo(() => ({
    topicColumnLabel: 'Kategorie',
    topicField: 'category_name' as const,
    getAppointments: (params: { status: string }) => api.ssw.getAppointments(params),
    confirmAppointment: (id: number) => api.ssw.confirmAppointment(id),
    cancelAppointment: (id: number) => api.ssw.cancelAppointment(id),
  }), []);

  return <CounselorAnfragenTab config={config} showFlash={showFlash} />;
}
