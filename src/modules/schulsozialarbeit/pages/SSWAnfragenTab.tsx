import api from '../../../services/api';
import { CounselorAnfragenTab } from '../../../shared/components/CounselorAnfragenTab';

const SSW_CONFIG = {
  topicColumnLabel: 'Kategorie',
  topicField: 'category_name' as const,
  getAppointments: (params: { status: string }) => api.ssw.getAppointments(params),
  confirmAppointment: (id: number) => api.ssw.confirmAppointment(id),
  cancelAppointment: (id: number) => api.ssw.cancelAppointment(id),
};

interface Props {
  showFlash: (msg: string) => void;
}

export function SSWAnfragenTab({ showFlash }: Props) {
  return <CounselorAnfragenTab config={SSW_CONFIG} showFlash={showFlash} />;
}
