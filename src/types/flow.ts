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
