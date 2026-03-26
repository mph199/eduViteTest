import api from '../../../services/api';
import { CounselorAnfragenTab } from '../../../shared/components/CounselorAnfragenTab';

const BL_CONFIG = {
  getAppointments: (params: { status: string }) => api.bl.getAppointments(params),
  confirmAppointment: (id: number) => api.bl.confirmAppointment(id),
  cancelAppointment: (id: number) => api.bl.cancelAppointment(id),
};

interface Props {
  showFlash: (msg: string) => void;
}

export function BLAnfragenTab({ showFlash }: Props) {
  return <CounselorAnfragenTab config={BL_CONFIG} showFlash={showFlash} />;
}
