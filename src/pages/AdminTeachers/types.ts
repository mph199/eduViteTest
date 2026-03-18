import type { Teacher as ApiTeacher, UserAccount } from '../../types';
import { WEEKDAY_LABELS } from '../../shared/constants/weekdays';

export type { ApiTeacher };
export type { UserAccount };

export interface BlFormData {
  enabled: boolean;
  phone: string;
  specializations: string;
  slot_duration_minutes: number;
  schedule: Array<{ weekday: number; start_time: string; end_time: string; active: boolean }>;
}

export { WEEKDAY_LABELS as WEEKDAYS };

export const defaultBlForm = (): BlFormData => ({
  enabled: false,
  phone: '',
  specializations: '',
  slot_duration_minutes: 30,
  schedule: WEEKDAY_LABELS.map((_, i) => ({ weekday: i + 1, start_time: '08:00', end_time: '14:00', active: false })),
});

export type TeacherLoginResponse = {
  user?: {
    username: string;
    tempPassword: string;
  };
};

export interface CsvImportedTeacher {
  id: number;
  name: string;
  email: string;
  username: string;
  tempPassword: string;
  slotsCreated: number;
}

export interface CsvSkippedRow {
  line: number;
  reason: string;
  name?: string;
}

export interface CsvImportResult {
  success?: boolean;
  error?: string;
  hint?: string;
  imported?: number;
  skipped?: number;
  total?: number;
  details?: {
    imported?: CsvImportedTeacher[];
    skipped?: CsvSkippedRow[];
  };
}

export interface TeacherFormData {
  first_name: string;
  last_name: string;
  email: string;
  salutation: 'Herr' | 'Frau' | 'Divers';
  available_from: string;
  available_until: string;
  username: string;
  password: string;
}

export const defaultFormData = (): TeacherFormData => ({
  first_name: '', last_name: '', email: '', salutation: 'Herr',
  available_from: '16:00', available_until: '19:00', username: '', password: '',
});
