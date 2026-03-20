# Flow Modul – Phase 4: Frontend Types und API Client

> Abhaengigkeiten: Phase 3 (Backend-Routes definiert)
> Aenderungen in:
> - `src/types/index.ts` (erweitern)
> - `src/services/api.ts` (erweitern)

## Types (src/types/index.ts)

Alle Types gehoeren nach `src/types/index.ts` (Hard Rule #7). Das Fachkonzept definiert eigene `src/modules/flow/types/` -- das widerspricht der Projektkonvention.

### Anpassungen gegenueber Fachkonzept

| Fachkonzept | Implementierung | Grund |
|---|---|---|
| `UserId = string` | `number` | `users.id` ist `SERIAL` (INTEGER) |
| `id: string` | `id: number` | Alle IDs sind `SERIAL` |
| `Date` fuer Zeitstempel | `string` (ISO 8601) | JSON-Serialisierung, Frontend parst bei Bedarf |
| Separates Types-Verzeichnis | Alles in `src/types/index.ts` | Projektkonvention |
| `DateiZuordnung` als Union | Flache Felder | Entspricht DB-Struktur |

### TypeScript-Interfaces

```ts
// ── Flow: Bildungsgang ──

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

// ── Flow: Arbeitspaket ──

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
    // Berechnete Felder (nicht in DB)
    fortschritt?: { erledigt: number; gesamt: number };
    tagungsZaehler?: { durchgefuehrt: number; geplant: number };
    createdAt: string;
    updatedAt: string;
}

// Aggregierte Version fuer Dashboard/Listen
export interface FlowArbeitspaketSummary {
    id: number;
    titel: string;
    bildungsgangName: string;
    status: FlowArbeitspaketStatus;
    deadline: string | null;
    fortschritt: { erledigt: number; gesamt: number };
    meineRolle: FlowArbeitspaketRolle;
}

// ── Flow: Aufgabe ──

export type FlowAufgabenStatus = 'offen' | 'in_bearbeitung' | 'erledigt';

export interface FlowAufgabe {
    id: number;
    arbeitspaketId: number;
    arbeitspaketTitel?: string; // Fuer paketuebergreifende Ansicht
    titel: string;
    beschreibung: string;
    zustaendig: number;
    zustaendigName?: string;
    erstelltVon: number;
    deadline: string | null;
    status: FlowAufgabenStatus;
    erstelltAus: 'planung' | 'tagung';
    tagungId: number | null;
    erledigtAt: string | null;
    createdAt: string;
    updatedAt: string;
}

// ── Flow: Tagung ──

export interface FlowTagung {
    id: number;
    arbeitspaketId: number;
    titel: string;
    startAt: string;
    endAt: string | null;
    raum: string | null;
    teilnehmende: FlowTagungTeilnehmer[];
    agendaPunkte: FlowAgendaPunkt[];
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

// ── Flow: Agenda-Punkt ──

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

// ── Flow: Datei ──

export interface FlowDatei {
    id: number;
    name: string;
    originalName: string;
    mimeType: string;
    groesse: number;
    hochgeladenVon: number;
    hochgeladenVonName?: string;
    createdAt: string;
}

// ── Flow: Aktivitaet ──

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
    akteur: number;
    akteurName?: string;
    arbeitspaketId: number;
    details: Record<string, unknown>;
    createdAt: string;
}

// ── Flow: Dashboard ──

export interface FlowDashboard {
    statistik: {
        offen: number;
        ueberfaellig: number;
        erledigtDiesenMonat: number;
    };
    meineAufgaben: FlowAufgabe[];
    aktiveArbeitspakete: FlowArbeitspaketSummary[];
    naechsteTagungen: FlowTagungSummary[];
    aktivitaeten: FlowAktivitaet[];
}

// ── Flow: Abteilungsleitung (aggregiert) ──

export interface FlowAbteilungsPaket {
    id: number;
    titel: string;
    bildungsgang: string;
    status: FlowArbeitspaketStatus;
    deadline: string | null;
}

// ── Flow: Statusuebergang ──

export interface FlowUebergangsPruefung {
    erlaubt: boolean;
    vorbedingungen: string[];
    warnungen: string[];
}

// ── Flow: Kalender (Phase 3) ──

export interface FlowKollision {
    typ: 'schulkalender' | 'bildungsgang_tagung' | 'teilnehmer_tagung';
    titel: string;
    startAt: string;
    endAt: string;
    betroffene?: string;
}
```

## API Client (src/services/api.ts)

Neuer Namespace `flow` im `api`-Objekt. Pattern: `requestJSON` mit `credentials: 'include'` (bereits in der Hilfsfunktion enthalten).

```ts
flow: {
    // Dashboard
    async getDashboard(): Promise<FlowDashboard> {
        return requestJSON('/flow/dashboard');
    },

    // Bildungsgaenge
    async getBildungsgaenge(): Promise<FlowBildungsgang[]> {
        const res = await requestJSON('/flow/bildungsgaenge');
        return res || [];  // Array-Normalisierung
    },
    async getBildungsgang(id: number): Promise<FlowBildungsgang> {
        return requestJSON(`/flow/bildungsgaenge/${id}`);
    },

    // Arbeitspakete
    async createArbeitspaket(bildungsgangId: number, data: {
        titel: string; istZustand: string; sollZustand: string;
        beteiligteBeschreibung: string;
    }): Promise<FlowArbeitspaket> {
        return requestJSON(`/flow/bildungsgaenge/${bildungsgangId}/arbeitspakete`, {
            method: 'POST', body: JSON.stringify(data),
        });
    },
    async getArbeitspaket(id: number): Promise<FlowArbeitspaket> {
        return requestJSON(`/flow/arbeitspakete/${id}`);
    },
    async updateArbeitspaket(id: number, data: Partial<FlowArbeitspaket>): Promise<FlowArbeitspaket> {
        return requestJSON(`/flow/arbeitspakete/${id}`, {
            method: 'PATCH', body: JSON.stringify(data),
        });
    },
    async updateArbeitspaketStatus(id: number, status: FlowArbeitspaketStatus): Promise<FlowUebergangsPruefung> {
        return requestJSON(`/flow/arbeitspakete/${id}/status`, {
            method: 'PATCH', body: JSON.stringify({ status }),
        });
    },
    async deleteArbeitspaket(id: number): Promise<void> {
        return requestJSON(`/flow/arbeitspakete/${id}`, { method: 'DELETE' });
    },
    async abschliessenArbeitspaket(id: number, data: {
        abschlussZusammenfassung: string; reflexion?: string | null;
    }): Promise<FlowArbeitspaket> {
        return requestJSON(`/flow/arbeitspakete/${id}/abschliessen`, {
            method: 'POST', body: JSON.stringify(data),
        });
    },
    async wiederaufnehmenArbeitspaket(id: number): Promise<FlowArbeitspaket> {
        return requestJSON(`/flow/arbeitspakete/${id}/wiederaufnehmen`, { method: 'POST' });
    },

    // Mitglieder
    async getMitglieder(paketId: number): Promise<FlowArbeitspaketMitglied[]> {
        const res = await requestJSON(`/flow/arbeitspakete/${paketId}/mitglieder`);
        return res || [];
    },
    async addMitglied(paketId: number, userId: number, rolle: FlowArbeitspaketRolle): Promise<void> {
        return requestJSON(`/flow/arbeitspakete/${paketId}/mitglieder`, {
            method: 'POST', body: JSON.stringify({ userId, rolle }),
        });
    },
    async updateMitgliedRolle(paketId: number, userId: number, rolle: FlowArbeitspaketRolle): Promise<void> {
        return requestJSON(`/flow/arbeitspakete/${paketId}/mitglieder/${userId}`, {
            method: 'PATCH', body: JSON.stringify({ rolle }),
        });
    },
    async removeMitglied(paketId: number, userId: number): Promise<void> {
        return requestJSON(`/flow/arbeitspakete/${paketId}/mitglieder/${userId}`, { method: 'DELETE' });
    },

    // Aufgaben
    async getAufgaben(paketId: number): Promise<FlowAufgabe[]> {
        const res = await requestJSON(`/flow/arbeitspakete/${paketId}/aufgaben`);
        return res || [];
    },
    async createAufgabe(paketId: number, data: {
        titel: string; beschreibung?: string; zustaendig: number;
        deadline?: string | null; tagungId?: number | null;
    }): Promise<FlowAufgabe> {
        return requestJSON(`/flow/arbeitspakete/${paketId}/aufgaben`, {
            method: 'POST', body: JSON.stringify(data),
        });
    },
    async updateAufgabe(id: number, data: Partial<FlowAufgabe>): Promise<FlowAufgabe> {
        return requestJSON(`/flow/aufgaben/${id}`, {
            method: 'PATCH', body: JSON.stringify(data),
        });
    },
    async updateAufgabeStatus(id: number, status: FlowAufgabenStatus): Promise<FlowAufgabe> {
        return requestJSON(`/flow/aufgaben/${id}/status`, {
            method: 'PATCH', body: JSON.stringify({ status }),
        });
    },
    async deleteAufgabe(id: number): Promise<void> {
        return requestJSON(`/flow/aufgaben/${id}`, { method: 'DELETE' });
    },
    async getMeineAufgaben(filter?: {
        status?: FlowAufgabenStatus; ueberfaellig?: boolean;
    }): Promise<FlowAufgabe[]> {
        const params = new URLSearchParams();
        if (filter?.status) params.set('status', filter.status);
        if (filter?.ueberfaellig) params.set('ueberfaellig', 'true');
        const qs = params.toString();
        const res = await requestJSON(`/flow/aufgaben/meine${qs ? '?' + qs : ''}`);
        return res || [];
    },

    // Tagungen
    async getTagungen(paketId: number): Promise<FlowTagung[]> {
        const res = await requestJSON(`/flow/arbeitspakete/${paketId}/tagungen`);
        return res || [];
    },
    async createTagung(paketId: number, data: {
        titel: string; startAt: string; endAt?: string | null;
        raum?: string | null; teilnehmende: number[];
    }): Promise<FlowTagung> {
        return requestJSON(`/flow/arbeitspakete/${paketId}/tagungen`, {
            method: 'POST', body: JSON.stringify(data),
        });
    },
    async getTagung(id: number): Promise<FlowTagung> {
        return requestJSON(`/flow/tagungen/${id}`);
    },
    async updateTagung(id: number, data: Partial<FlowTagung>): Promise<FlowTagung> {
        return requestJSON(`/flow/tagungen/${id}`, {
            method: 'PATCH', body: JSON.stringify(data),
        });
    },
    async addAgendaPunkt(tagungId: number, data: {
        titel: string; beschreibung?: string; referenzierteAufgabeId?: number | null;
    }): Promise<FlowAgendaPunkt> {
        return requestJSON(`/flow/tagungen/${tagungId}/agenda`, {
            method: 'POST', body: JSON.stringify(data),
        });
    },
    async dokumentiereAgendaPunkt(tagungId: number, punktId: number, data: {
        ergebnis?: string; entscheidung?: string;
    }): Promise<FlowAgendaPunkt> {
        return requestJSON(`/flow/tagungen/${tagungId}/agenda/${punktId}`, {
            method: 'PATCH', body: JSON.stringify(data),
        });
    },
    async createAufgabeAusAgenda(tagungId: number, punktId: number, data: {
        titel: string; zustaendig: number; deadline?: string | null;
    }): Promise<FlowAufgabe> {
        return requestJSON(`/flow/tagungen/${tagungId}/agenda/${punktId}/aufgaben`, {
            method: 'POST', body: JSON.stringify(data),
        });
    },

    // Dateien
    async getDateien(paketId: number): Promise<FlowDatei[]> {
        const res = await requestJSON(`/flow/arbeitspakete/${paketId}/dateien`);
        return res || [];
    },
    async uploadDatei(paketId: number, file: File): Promise<FlowDatei> {
        return uploadFile(`/flow/arbeitspakete/${paketId}/dateien`, 'datei', file);
    },
    async downloadDatei(id: number): Promise<Blob> {
        const res = await fetch(`/api/flow/dateien/${id}/download`, { credentials: 'include' });
        if (!res.ok) throw new Error('Download fehlgeschlagen');
        return res.blob();
    },

    // Abteilung
    async getAbteilungsPakete(): Promise<FlowAbteilungsPaket[]> {
        const res = await requestJSON('/flow/abteilung/arbeitspakete');
        return res || [];
    },
},
```

## Hinweise zur Integration

1. **`requestJSON` enthaelt bereits `credentials: 'include'`** -- kein manueller Zusatz noetig
2. **`uploadFile` ist bereits als Hilfsfunktion vorhanden** -- nutzt `FormData` + `fetch` mit `credentials: 'include'`
3. **Array-Normalisierung** (`|| []`) ist bei jeder Methode noetig, die Arrays zurueckgibt
4. **`downloadDatei` nutzt `fetch` direkt** statt `requestJSON`, da die Response ein Blob ist (kein JSON)
