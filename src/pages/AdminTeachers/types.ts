import type { Teacher as ApiTeacher, UserAccount } from '../../types';
import { WEEKDAY_LABELS } from '../../shared/constants/weekdays';

export type { ApiTeacher };
export type { UserAccount };

// Domain types re-exported from central types
export type {
  BlFormData,
  TeacherLoginResponse,
  CsvImportedTeacher,
  CsvSkippedRow,
  CsvImportResult,
  TeacherFormData,
} from '../../types';

export { WEEKDAY_LABELS as WEEKDAYS };

export const defaultBlForm = (): import('../../types').BlFormData => ({
  enabled: false,
  phone: '',
  specializations: '',
  slot_duration_minutes: 30,
  schedule: WEEKDAY_LABELS.map((_, i) => ({ weekday: i + 1, start_time: '08:00', end_time: '14:00', active: false })),
});

export const defaultFormData = (): import('../../types').TeacherFormData => ({
  first_name: '', last_name: '', email: '', salutation: 'Herr',
  available_from: '16:00', available_until: '19:00', username: '', password: '',
});
