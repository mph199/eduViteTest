/**
 * Kysely database types — auto-generated structure, manually maintained.
 *
 * Regenerate from a live DB with:
 *   npx kysely-codegen --out-file backend/db/types.ts
 *
 * Keep in sync with migrations in backend/migrations/.
 */

import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

// ── Helper types ─────────────────────────────────────────────────────

type Timestamp = ColumnType<Date, Date | string, Date | string>;

// ── Database interface ───────────────────────────────────────────────

export interface DB {
  teachers: TeachersTable;
  slots: SlotsTable;
  events: EventsTable;
  booking_requests: BookingRequestsTable;
  users: UsersTable;
  settings: SettingsTable;
  feedback: FeedbackTable;
  email_branding: EmailBrandingTable;
  site_branding: SiteBrandingTable;
  text_branding: TextBrandingTable;
  module_config: ModuleConfigTable;
  ssw_counselors: SSWCounselorsTable;
  ssw_categories: SSWCategoriesTable;
  ssw_weekly_schedule: SSWWeeklyScheduleTable;
  ssw_appointments: SSWAppointmentsTable;
  bl_counselors: BLCounselorsTable;
  bl_topics: BLTopicsTable;
  bl_weekly_schedule: BLWeeklyScheduleTable;
  bl_appointments: BLAppointmentsTable;
  user_module_access: UserModuleAccessTable;
  user_admin_access: UserAdminAccessTable;
  consent_receipts: ConsentReceiptsTable;
  audit_log: AuditLogTable;
  oauth_providers: OAuthProvidersTable;
  oauth_user_links: OAuthUserLinksTable;
  applied_migrations: AppliedMigrationsTable;
  // Flow module
  flow_bildungsgang: FlowBildungsgangTable;
  flow_bildungsgang_mitglied: FlowBildungsgangMitgliedTable;
  flow_abteilungsleitung: FlowAbteilungsleitungTable;
  flow_arbeitspaket: FlowArbeitspaketTable;
  flow_arbeitspaket_mitglied: FlowArbeitspaketMitgliedTable;
  flow_tagung: FlowTagungTable;
  flow_tagung_teilnehmer: FlowTagungTeilnehmerTable;
  flow_aufgabe: FlowAufgabeTable;
  flow_agenda_punkt: FlowAgendaPunktTable;
  flow_datei: FlowDateiTable;
  flow_aktivitaet: FlowAktivitaetTable;
  flow_kalender_token: FlowKalenderTokenTable;
  flow_schulkalender: FlowSchulkalenderTable;
  // Choice module
  choice_groups: ChoiceGroupsTable;
  choice_options: ChoiceOptionsTable;
  choice_participants: ChoiceParticipantsTable;
  choice_submissions: ChoiceSubmissionsTable;
  choice_submission_items: ChoiceSubmissionItemsTable;
  choice_email_tokens: ChoiceEmailTokensTable;
}

// ── Core tables ──────────────────────────────────────────────────────

export interface TeachersTable {
  id: Generated<number>;
  first_name: string;
  last_name: string;
  name: string; // GENERATED ALWAYS AS
  email: string | null;
  salutation: string | null;
  subject: string;
  available_from: string | null;
  available_until: string | null;
  created_at: Timestamp;
}

export interface SlotsTable {
  id: Generated<number>;
  teacher_id: number;
  event_id: number | null;
  time: string;
  date: string;
  booked: boolean;
  status: string | null;
  parent_name: string | null;
  student_name: string | null;
  class_name: string | null;
  email: string | null;
  visitor_type: string | null;
  company_name: string | null;
  trainee_name: string | null;
  company_representative: string | null;
  verification_token_hash: string | null;
  verified_at: Timestamp | null;
  requires_confirmation: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface EventsTable {
  id: Generated<number>;
  name: string;
  school_year: string;
  starts_at: Timestamp;
  ends_at: Timestamp;
  timezone: string;
  status: string;
  booking_opens_at: Timestamp | null;
  booking_closes_at: Timestamp | null;
  closed_at: Timestamp | null;
  updated_at: Timestamp;
}

export interface BookingRequestsTable {
  id: Generated<number>;
  event_id: number;
  teacher_id: number;
  assigned_slot_id: number | null;
  status: string;
  parent_name: string | null;
  student_name: string | null;
  class_name: string | null;
  email: string | null;
  phone: string | null;
  visitor_type: string | null;
  company_name: string | null;
  trainee_name: string | null;
  company_representative: string | null;
  verification_token_hash: string | null;
  verified_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UsersTable {
  id: Generated<number>;
  username: string;
  email: string | null;
  password_hash: string;
  role: 'admin' | 'teacher' | 'superadmin';
  teacher_id: number | null;
  token_version: number;
  force_password_change: boolean;
  failed_login_attempts: number;
  locked_until: Timestamp | null;
  last_failed_login: Timestamp | null;
  updated_at: Timestamp;
}

export interface SettingsTable {
  id: Generated<number>;
  school_name: string | null;
  available_from: string | null;
  available_until: string | null;
  slot_duration: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface FeedbackTable {
  id: Generated<number>;
  rating: number | null;
  comment: string | null;
  created_at: Timestamp;
}

// ── Branding tables ──────────────────────────────────────────────────

export interface EmailBrandingTable {
  id: Generated<number>;
  school_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  footer_text: string | null;
  updated_at: Timestamp;
}

export interface SiteBrandingTable {
  id: number; // fixed = 1
  school_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  header_bg_color: string | null;
  header_font_color: string | null;
  footer_text: string | null;
  bg_image_url: string | null;
  bg_admin_image_url: string | null;
  bg_teacher_image_url: string | null;
  bg_image_map: string | null;
  bg_admin_image_map: string | null;
  bg_teacher_image_map: string | null;
  updated_at: Timestamp;
}

export interface TextBrandingTable {
  id: number;
  booking_intro_title: string | null;
  booking_intro_text: string | null;
  booking_success_title: string | null;
  booking_success_text: string | null;
  updated_at: Timestamp;
}

export interface ModuleConfigTable {
  module_key: string;
  enabled: boolean;
  updated_at: Timestamp;
}

// ── SSW tables ───────────────────────────────────────────────────────

export interface SSWCounselorsTable {
  id: Generated<number>;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  room: string | null;
  bio: string | null;
  active: boolean;
  calendar_token_hash: string | null;
  calendar_token_created_at: Timestamp | null;
  created_at: Timestamp;
}

export interface SSWCategoriesTable {
  id: Generated<number>;
  name: string;
  icon: string | null;
  active: boolean;
}

export interface SSWWeeklyScheduleTable {
  id: Generated<number>;
  counselor_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
}

export interface SSWAppointmentsTable {
  id: Generated<number>;
  counselor_id: number;
  category_id: number | null;
  date: string;
  start_time: string;
  end_time: string;
  student_name: string | null;
  parent_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  restricted: boolean;
  verification_token_hash: string | null;
  verified_at: Timestamp | null;
  created_at: Timestamp;
}

// ── BL tables ────────────────────────────────────────────────────────

export interface BLCounselorsTable {
  id: Generated<number>;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  room: string | null;
  bio: string | null;
  active: boolean;
  calendar_token_hash: string | null;
  calendar_token_created_at: Timestamp | null;
  created_at: Timestamp;
}

export interface BLTopicsTable {
  id: Generated<number>;
  name: string;
  active: boolean;
}

export interface BLWeeklyScheduleTable {
  id: Generated<number>;
  counselor_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
}

export interface BLAppointmentsTable {
  id: Generated<number>;
  counselor_id: number;
  topic_id: number | null;
  date: string;
  start_time: string;
  end_time: string;
  student_name: string | null;
  parent_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  restricted: boolean;
  verification_token_hash: string | null;
  verified_at: Timestamp | null;
  created_at: Timestamp;
}

// ── Access control tables ────────────────────────────────────────────

export interface UserModuleAccessTable {
  id: Generated<number>;
  user_id: number;
  module_key: string;
  granted_at: Timestamp;
}

export interface UserAdminAccessTable {
  id: Generated<number>;
  user_id: number;
  module_key: string;
  access_level: string;
  granted_by: number | null;
  granted_at: Timestamp;
}

export interface ConsentReceiptsTable {
  id: Generated<number>;
  module: string;
  appointment_id: number | null;
  ip_address: string | null;
  user_agent: string | null;
  consent_text: string;
  consented_at: Timestamp;
}

export interface AuditLogTable {
  id: Generated<number>;
  user_id: number | null;
  action: string;
  table_name: string | null;
  record_id: number | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Timestamp;
}

// ── OAuth tables ─────────────────────────────────────────────────────

export interface OAuthProvidersTable {
  id: Generated<number>;
  name: string;
  provider_type: string;
  client_id: string;
  client_secret: string;
  discovery_url: string | null;
  authorization_url: string | null;
  token_url: string | null;
  userinfo_url: string | null;
  scopes: string | null;
  enabled: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface OAuthUserLinksTable {
  id: Generated<number>;
  user_id: number;
  provider_id: number;
  external_id: string;
  email: string | null;
  created_at: Timestamp;
}

// ── Applied migrations tracking ──────────────────────────────────────

export interface AppliedMigrationsTable {
  filename: string;
  applied_at: Timestamp;
}

// ── Flow module tables ───────────────────────────────────────────────

export interface FlowBildungsgangTable {
  id: Generated<number>;
  name: string;
  beschreibung: string | null;
  erstellt_am: Timestamp;
}

export interface FlowBildungsgangMitgliedTable {
  id: Generated<number>;
  bildungsgang_id: number;
  user_id: number;
  rolle: string;
  beigetreten_am: Timestamp;
}

export interface FlowAbteilungsleitungTable {
  id: Generated<number>;
  user_id: number;
  erstellt_am: Timestamp;
}

export interface FlowArbeitspaketTable {
  id: Generated<number>;
  bildungsgang_id: number;
  titel: string;
  beschreibung: string | null;
  status: string;
  prioritaet: string;
  deadline: Timestamp | null;
  erstellt_am: Timestamp;
  aktualisiert_am: Timestamp;
  abgeschlossen_am: Timestamp | null;
  abgeschlossen_von: number | null;
}

export interface FlowArbeitspaketMitgliedTable {
  id: Generated<number>;
  arbeitspaket_id: number;
  user_id: number;
  rolle: string;
  beigetreten_am: Timestamp;
}

export interface FlowTagungTable {
  id: Generated<number>;
  arbeitspaket_id: number;
  titel: string;
  beschreibung: string | null;
  start_at: Timestamp;
  end_at: Timestamp | null;
  ort: string | null;
  status: string;
  erstellt_am: Timestamp;
}

export interface FlowTagungTeilnehmerTable {
  tagung_id: number;
  user_id: number;
  status: string;
}

export interface FlowAufgabeTable {
  id: Generated<number>;
  arbeitspaket_id: number;
  titel: string;
  beschreibung: string | null;
  status: string;
  prioritaet: string;
  zustaendig: number | null;
  deadline: Timestamp | null;
  erstellt_von: number | null;
  erstellt_am: Timestamp;
  aktualisiert_am: Timestamp;
  tagung_id: number | null;
}

export interface FlowAgendaPunktTable {
  id: Generated<number>;
  tagung_id: number;
  titel: string;
  beschreibung: string | null;
  reihenfolge: number;
  status: string;
  dauer_minuten: number | null;
  referenzierte_aufgabe_id: number | null;
  erstellt_am: Timestamp;
}

export interface FlowDateiTable {
  id: Generated<number>;
  dateiname: string;
  dateipfad: string;
  mime_type: string | null;
  groesse_bytes: number | null;
  hochgeladen_von: number | null;
  bildungsgang_id: number | null;
  arbeitspaket_id: number | null;
  aufgabe_id: number | null;
  tagung_id: number | null;
  erstellt_am: Timestamp;
}

export interface FlowAktivitaetTable {
  id: Generated<number>;
  arbeitspaket_id: number;
  akteur: number | null;
  aktion: string;
  details: Record<string, unknown> | null;
  erstellt_am: Timestamp;
}

export interface FlowKalenderTokenTable {
  id: Generated<number>;
  user_id: number;
  token: string;
  erstellt_am: Timestamp;
}

export interface FlowSchulkalenderTable {
  id: Generated<number>;
  uid_extern: string;
  quelle: string;
  titel: string;
  beschreibung: string | null;
  dtstart: Timestamp;
  dtend: Timestamp | null;
  ganztaegig: boolean;
  erstellt_am: Timestamp;
}

// ── Convenience type aliases ─────────────────────────────────────────

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type Teacher = Selectable<TeachersTable>;
export type Slot = Selectable<SlotsTable>;
export type Event = Selectable<EventsTable>;

// ── Choice module tables ────────────────────────────────────────────

export interface ChoiceGroupsTable {
  id: Generated<string>;
  title: string;
  description: string | null;
  status: string;
  min_choices: number;
  max_choices: number;
  ranking_mode: string;
  allow_edit_after_submit: boolean;
  opens_at: Timestamp | null;
  closes_at: Timestamp | null;
  created_by: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ChoiceOptionsTable {
  id: Generated<string>;
  group_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ChoiceParticipantsTable {
  id: Generated<string>;
  group_id: string;
  first_name: string;
  last_name: string;
  email: string;
  audience_label: string | null;
  is_active: boolean;
  created_at: Timestamp;
}

export interface ChoiceSubmissionsTable {
  id: Generated<string>;
  group_id: string;
  participant_id: string;
  status: string;
  submitted_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ChoiceSubmissionItemsTable {
  id: Generated<string>;
  submission_id: string;
  option_id: string;
  priority: number;
  created_at: Timestamp;
}

export interface ChoiceEmailTokensTable {
  id: Generated<string>;
  participant_id: string;
  token_hash: string;
  expires_at: Timestamp;
  used_at: Timestamp | null;
  created_at: Timestamp;
}

// Choice convenience aliases
export type ChoiceGroup = Selectable<ChoiceGroupsTable>;
export type NewChoiceGroup = Insertable<ChoiceGroupsTable>;
export type ChoiceOption = Selectable<ChoiceOptionsTable>;
export type NewChoiceOption = Insertable<ChoiceOptionsTable>;
export type ChoiceParticipant = Selectable<ChoiceParticipantsTable>;
export type NewChoiceParticipant = Insertable<ChoiceParticipantsTable>;
export type ChoiceSubmission = Selectable<ChoiceSubmissionsTable>;
export type ChoiceSubmissionItem = Selectable<ChoiceSubmissionItemsTable>;
export type ChoiceEmailToken = Selectable<ChoiceEmailTokensTable>;
export type UpdateChoiceGroup = Updateable<ChoiceGroupsTable>;
export type UpdateChoiceOption = Updateable<ChoiceOptionsTable>;
export type UpdateChoiceParticipant = Updateable<ChoiceParticipantsTable>;
