export interface Teacher {
  id: number;
  first_name?: string;
  last_name?: string;
  name: string;
  email?: string;
  salutation?: 'Herr' | 'Frau' | 'Divers';
  subject: string;
  room?: string;
  available_from?: string;
  available_until?: string;
}

export interface TimeSlot {
  id: number;
  teacherId: number;
  time: string;
  date: string;
  booked: boolean;
  status?: 'reserved' | 'confirmed';
  verifiedAt?: string | null;
  // Present on some admin/teacher booking list responses
  teacherName?: string;
  teacherSubject?: string;
  visitorType?: 'parent' | 'company';
  parentName?: string;
  companyName?: string;
  studentName?: string;
  traineeName?: string;
  representativeName?: string;
  className?: string;
  email?: string;
  message?: string;
}

export interface BookingFormData {
  visitorType: 'parent' | 'company';
  parentName?: string;
  companyName?: string;
  studentName?: string;
  traineeName?: string;
  representativeName?: string;
  className: string;
  email: string;
  message?: string;
  consent_version?: string;
}

export interface ConsentReceipt {
  id: number;
  module: string;
  appointment_id: number;
  consent_version: string;
  consent_purpose: string;
  ip_address?: string;
  user_agent?: string;
  consented_at: string;
}

export interface BrandingData {
  responsible_name?: string;
  responsible_address?: string;
  responsible_email?: string;
  responsible_phone?: string;
  dsb_name?: string;
  dsb_email?: string;
  supervisory_authority?: string;
}

export interface BookingRequest {
  id: number;
  eventId?: number | null;
  teacherId: number;
  requestedTime: string;
  date: string;
  status: 'requested' | 'accepted' | 'declined';
  verifiedAt?: string | null;
  confirmationSentAt?: string | null;
  assignedSlotId?: number | null;
  visitorType: 'parent' | 'company';
  parentName?: string | null;
  companyName?: string | null;
  studentName?: string | null;
  traineeName?: string | null;
  representativeName?: string | null;
  className: string;
  email: string;
  message?: string | null;
  assignableTimes?: string[];
  availableTimes?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Settings {
  id?: number;
  event_name: string;
  event_date: string;
  updated_at?: string;
}

export interface FeedbackItem {
  id: number;
  message: string;
  created_at: string;
}

export interface UserAccount {
  id: number;
  username: string;
  role: 'admin' | 'teacher' | 'superadmin' | 'ssw';
  modules?: string[];
  teacher_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

// ── Event types ────────────────────────────────────────────────────

export type EventStatus = 'draft' | 'published' | 'closed';

export interface AdminEvent {
  id: number;
  name: string;
  school_year: string;
  starts_at: string;
  ends_at: string;
  status: EventStatus;
  booking_opens_at?: string | null;
  booking_closes_at?: string | null;
  timezone?: string | null;
}

export interface EventStats {
  eventId: number;
  totalSlots: number;
  availableSlots: number;
  bookedSlots: number;
  reservedSlots: number;
  confirmedSlots: number;
}

// ── Counselor types (SSW / BL shared) ──────────────────────────────

export interface Counselor {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  salutation?: string;
  email?: string;
  room?: string;
  phone?: string;
  specializations?: string;
  available_from?: string;
  available_until?: string;
  slot_duration_minutes?: number;
  active?: boolean;
  user_id?: number;
  requires_confirmation?: boolean;
}

export interface ScheduleEntry {
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

export interface CounselorAppointment {
  id: number;
  counselor_id: number;
  date: string;
  time: string;
  duration_minutes: number;
  status: string;
  student_name?: string;
  student_class?: string;
  student_email?: string;
  category_name?: string;
  category_icon?: string;
  topic_name?: string;
}

export interface CounselorTopic {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  active?: boolean;
}

export interface AppointmentSlot {
  id: number;
  date: string;
  time: string;
  duration_minutes: number;
}

export interface CounselorBookingConfig {
  title: string;
  subtitle: string;
  counselorLabel: string;
  confidentialNotice: string;
  topicLabel: string;
  topicFieldKey: string;
  successCounselorLabel: string;
  successMessage: string;
  apiPathPrefix: string;
  topicEndpoint: string;
  topicResponseKey: string;
  moduleId: 'schulsozialarbeit' | 'beratungslehrer';
}

export interface RevokedModuleConflict {
  key: string;
  label: string;
  appointmentCount: number;
  scheduleCount: number;
}

export interface EmailBranding {
  school_name: string;
  logo_url: string;
  primary_color: string;
  footer_text: string;
}

// ---------------------------------------------------------------------------
// Data Subject / DSGVO (Art. 15-21)
// ---------------------------------------------------------------------------

export interface DataSubjectSearchResult {
  email: string;
  total_records: number;
  data: Record<string, Record<string, unknown>[]>;
}

export interface DataSubjectDeletionResult {
  message: string;
  protocol: {
    email: string;
    timestamp: string;
    actions: { table: string; anonymized: number; ids: number[] }[];
  };
}

export interface DataSubjectCorrectionResult {
  message: string;
  results: { table: string; corrected: number; fields: string[] }[];
}

export interface DataSubjectRestrictionResult {
  message: string;
  restricted: boolean;
  results: { table: string; affected: number }[];
}

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  table_name: string | null;
  record_id: number | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuditLogFilter {
  from?: string;
  to?: string;
  action?: string;
  table?: string;
  page?: number;
  limit?: number;
}
