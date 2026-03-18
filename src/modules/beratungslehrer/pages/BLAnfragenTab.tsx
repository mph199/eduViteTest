import { useMemo } from 'react';
import api from '../../../services/api';
import { CounselorAnfragenTab } from '../../../shared/components/CounselorAnfragenTab';

interface Props {
  showFlash: (msg: string) => void;
}

export function BLAnfragenTab({ showFlash }: Props) {
  const config = useMemo(() => ({
    topicColumnLabel: 'Thema',
    topicField: 'topic_name' as const,
    getAppointments: (params: { status: string }) => api.bl.getAppointments(params),
    confirmAppointment: (id: number) => api.bl.confirmAppointment(id),
    cancelAppointment: (id: number) => api.bl.cancelAppointment(id),
  }), []);

  return <CounselorAnfragenTab config={config} showFlash={showFlash} />;
}
