import { useOutletContext } from 'react-router-dom';
import api from '../../../services/api';
import { CounselorAnfragenTab } from '../../../shared/components/CounselorAnfragenTab';
import type { SSWCounselorContext } from './SSWCounselorLayout';

const SSW_CONFIG = {
  getAppointments: (params: { status: string }) => api.ssw.getAppointments(params),
  confirmAppointment: (id: number) => api.ssw.confirmAppointment(id),
  cancelAppointment: (id: number) => api.ssw.cancelAppointment(id),
  accent: 'coral' as const,
};

export function SSWCounselorAnfragenPage() {
  const { showFlash } = useOutletContext<SSWCounselorContext>();
  return <CounselorAnfragenTab config={SSW_CONFIG} showFlash={showFlash} />;
}
