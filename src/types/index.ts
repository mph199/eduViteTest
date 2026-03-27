export interface Teacher {
  id: number;
  first_name?: string;
  last_name?: string;
  name: string;
  email?: string;
  salutation?: 'Herr' | 'Frau' | 'Divers';
  subject: string;
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

export interface CalendarTokenStatus {
  exists: boolean;
  expired?: boolean;
  createdAt?: string | null;
  expiresAt?: string | null;
  isExpired?: boolean;
}

export interface CalendarTokenCreated {
  token: string;
  createdAt: string;
  expiresAt: string;
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

export interface UserAccount {
  id: number;
  username: string;
  role: 'admin' | 'teacher' | 'superadmin';
  modules?: string[];
  adminModules?: string[];
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
  first_name?: string;
  last_name?: string;
  student_class?: string;
  student_email?: string;
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
  successCounselorLabel: string;
  successMessage: string;
  apiPathPrefix: string;
  moduleId: 'schulsozialarbeit' | 'beratungslehrer';
}

export interface CounselorCalendarTokenStatus {
  exists: boolean;
  createdAt?: string;
  expiresAt?: string;
  isExpired?: boolean;
}

export interface CounselorCalendarTokenCreated {
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface EmailBranding {
  school_name: string;
  logo_url: string;
  primary_color: string;
  footer_text: string;
}

// ── Auth types ───────────────────────────────────────────────────────

export type ActiveView = 'admin' | 'teacher';

export interface User {
  username: string;
  fullName?: string;
  role: 'admin' | 'teacher' | 'superadmin';
  modules?: string[];
  adminModules?: string[];
  teacherId?: number;
  forcePasswordChange?: boolean;
}

// ── Site Branding types ──────────────────────────────────────────────

export interface SiteBranding {
  school_name: string;
  logo_url: string;
  primary_color: string;
  primary_dark: string;
  primary_darker: string;
  secondary_color: string;
  ink_color: string;
  surface_1: string;
  surface_2: string;
  header_font_color: string;
  hero_title: string;
  hero_text: string;
  step_1: string;
  step_2: string;
  step_3: string;
  tile_images: Record<string, string>;
  background_images: Record<string, string>;
}

export interface TextBranding {
  booking_title: string;
  booking_text: string;
  booking_steps_title: string;
  booking_step_1: string;
  booking_step_2: string;
  booking_step_3: string;
  booking_hint: string;
  event_banner_template: string;
  event_banner_fallback: string;
  modal_title: string;
  modal_text: string;
  modal_button: string;
  booking_closed_text: string;
}

// ── Teacher types ────────────────────────────────────────────────────

export type TeacherInfo = {
  id: number;
  first_name?: string;
  last_name?: string;
  name: string;
  subject: string;
  system?: string;
};

export type TeacherOutletContext = {
  teacher: TeacherInfo | null;
  refreshTeacher: () => Promise<void>;
};

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

export type TeacherLoginResponse = {
  user?: {
    username: string;
    tempPassword: string;
  };
};

// ── CSV Import types ─────────────────────────────────────────────────

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

// ── BL Admin types ───────────────────────────────────────────────────

export interface BlFormData {
  enabled: boolean;
  phone: string;
  specializations: string;
  slot_duration_minutes: number;
  schedule: Array<{ weekday: number; start_time: string; end_time: string; active: boolean }>;
}

// ---------------------------------------------------------------------------
// Data Subject / DSGVO (Art. 15-21)
// ---------------------------------------------------------------------------

export interface DataSubjectSearchResult {
  email: string;
  total_records: number;
  data: Record<string, Record<string, unknown>[]>;
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


/** Response from slot generation endpoints (elternsprechtag, events). */
export interface GenerateSlotsResponse {
  success?: boolean;
  created?: number;
  skipped?: number;
  eventDate?: string | null;
  error?: string;
  message?: string;
}

// ── Flow: Bildungsgang ──────────────────────────────────────────────

export type FlowBildungsgangRolle = 'leitung' | 'mitglied';

export interface FlowBildungsgangMitglied {
  id: number;
  userId: number;
  vorname: string;
  nachname: string;
  rolle: FlowBildungsgangRolle;
  hinzugefuegtAm: string;
}

export interface FlowBildungsgang {
  id: number;
  name: string;
  erlaubtMitgliedernPaketErstellung: boolean;
  mitglieder: FlowBildungsgangMitglied[];
  arbeitspaketeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlowBildungsgangListItem {
  id: number;
  name: string;
  erlaubtMitgliedernPaketErstellung: boolean;
  mitgliederCount: string;
  arbeitspaketeCount: string;
}

export interface FlowUser {
  id: number;
  username: string;
  vorname: string | null;
  nachname: string | null;
  role: string;
}

// ── Flow: Arbeitspaket ──────────────────────────────────────────────

export type FlowArbeitspaketStatus = 'entwurf' | 'geplant' | 'aktiv' | 'abgeschlossen';
export type FlowArbeitspaketRolle = 'koordination' | 'mitwirkende' | 'lesezugriff';

export interface FlowArbeitspaketMitglied {
  id: number;
  userId: number;
  vorname: string;
  nachname: string;
  rolle: FlowArbeitspaketRolle;
  hinzugefuegtAm: string;
}

export interface FlowArbeitspaket {
  id: number;
  bildungsgangId: number;
  bildungsgangName?: string;
  titel: string;
  istZustand: string;
  sollZustand: string;
  beteiligteBeschreibung: string;
  status: FlowArbeitspaketStatus;
  deadline: string | null;
  geplanteTagungen: number | null;
  mitglieder: FlowArbeitspaketMitglied[];
  meineRolle?: FlowArbeitspaketRolle;
  abgeschlossenAt: string | null;
  abgeschlossenVon: number | null;
  abschlussZusammenfassung: string | null;
  reflexion: string | null;
  fortschritt?: { erledigt: number; gesamt: number };
  tagungsZaehler?: { durchgefuehrt: number; geplant: number };
  createdAt: string;
  updatedAt: string;
}

export interface FlowArbeitspaketSummary {
  id: number;
  titel: string;
  bildungsgangName: string;
  status: FlowArbeitspaketStatus;
  deadline: string | null;
  fortschritt: { erledigt: number; gesamt: number };
  meineRolle: FlowArbeitspaketRolle;
}

// ── Flow: Aufgabe ───────────────────────────────────────────────────

export type FlowAufgabenStatus = 'offen' | 'in_bearbeitung' | 'erledigt';

export interface FlowAufgabe {
  id: number;
  arbeitspaketId: number;
  arbeitspaketTitel?: string;
  titel: string;
  beschreibung: string;
  zustaendig: number | null;
  zustaendigName?: string;
  erstelltVon: number | null;
  deadline: string | null;
  status: FlowAufgabenStatus;
  erstelltAus: 'planung' | 'tagung';
  tagungId: number | null;
  erledigtAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Flow: Tagung ────────────────────────────────────────────────────

export interface FlowTagung {
  id: number;
  arbeitspaketId: number;
  titel: string;
  startAt: string;
  endAt: string | null;
  raum: string | null;
  teilnehmende: FlowTagungTeilnehmer[];
  agendaPunkte: FlowAgendaPunkt[];
  meineRolle: FlowArbeitspaketRolle | null;
  createdAt: string;
}

export interface FlowTagungTeilnehmer {
  userId: number;
  vorname: string;
  nachname: string;
}

export interface FlowTagungSummary {
  id: number;
  titel: string;
  startAt: string;
  raum: string | null;
  arbeitspaketTitel: string;
  teilnehmendeCount: number;
}

// ── Flow: Agenda-Punkt ──────────────────────────────────────────────

export interface FlowAgendaPunkt {
  id: number;
  tagungId: number;
  titel: string;
  beschreibung: string;
  referenzierteAufgabeId: number | null;
  ergebnis: string | null;
  entscheidung: string | null;
  neueAufgaben: FlowAufgabe[];
  sortierung: number;
}

// ── Flow: Datei ─────────────────────────────────────────────────────

export interface FlowDatei {
  id: number;
  name: string;
  originalName: string;
  mimeType: string;
  groesse: number;
  hochgeladenVon: number | null;
  hochgeladenVonName?: string;
  externalUrl: string | null;
  createdAt: string;
}

// ── Flow: Aktivitaet ────────────────────────────────────────────────

export type FlowAktivitaetTyp =
  | 'aufgabe_erstellt'
  | 'aufgabe_erledigt'
  | 'aufgabe_status_geaendert'
  | 'aufgabe_geloescht'
  | 'tagung_erstellt'
  | 'tagung_dokumentiert'
  | 'datei_hochgeladen'
  | 'arbeitspaket_erstellt'
  | 'arbeitspaket_status_geaendert'
  | 'arbeitspaket_abgeschlossen'
  | 'arbeitspaket_wiederaufgenommen'
  | 'mitglied_hinzugefuegt'
  | 'mitglied_entfernt'
  | 'rolle_geaendert';

export interface FlowAktivitaet {
  id: number;
  typ: FlowAktivitaetTyp;
  akteur: number | null;
  akteurName?: string;
  arbeitspaketId: number;
  details: Record<string, unknown>;
  createdAt: string;
}

// ── Flow: Dashboard ─────────────────────────────────────────────────

export interface FlowDashboard {
  statistik: {
    offen: number;
    ueberfaellig: number;
    erledigtDiesenMonat: number;
  };
  meineAufgaben: FlowAufgabe[];
  aktiveArbeitspakete: FlowArbeitspaketSummary[];
  naechsteTagungen: FlowTagungSummary[];
  aktivitaeten?: FlowAktivitaet[];
}

// ── Flow: Abteilungsleitung ─────────────────────────────────────────

export interface FlowAbteilungsPaket {
  id: number;
  titel: string;
  bildungsgang: string;
  status: FlowArbeitspaketStatus;
  deadline: string | null;
}

// ── OAuth ──

export interface OAuthProvider {
  providerKey: string;
  displayName: string;
}

export interface OAuthProviderFull {
  id: number;
  provider_key: string;
  display_name: string;
  enabled: boolean;
  client_id: string;
  discovery_url: string;
  scopes: string;
  email_claim: string;
  name_claim: string;
  allowed_domains: string | null;
  auto_provisioning: boolean;
  created_at: string;
  updated_at: string;
}

export interface OAuthProviderFormData {
  providerKey: string;
  displayName: string;
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  scopes: string;
  emailClaim: string;
  nameClaim: string;
  allowedDomains: string;
  autoProvisioning: boolean;
  enabled: boolean;
}
