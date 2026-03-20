# Flow Modul – Phase 5: Frontend-Komponenten und Modul-Registrierung

> Abhaengigkeiten: Phase 4 (Types + API Client)
> Neue Dateien:
> - `src/modules/flow/index.ts`
> - `src/modules/flow/components/*.tsx`
> - `src/modules/flow/hooks/*.ts`
> - `src/modules/flow/utils/*.ts`
> Aenderungen in:
> - `src/modules/registry.ts`
> - CSS: `--module-accent-flow` definieren

## Modul-Registrierung

### Frontend-Manifest (src/modules/flow/index.ts)

```ts
import { lazy } from 'react';
import type { ModuleDefinition } from '../registry';

const FlowApp = lazy(() =>
    import('./components/FlowApp').then((m) => ({ default: m.FlowApp }))
);

const FlowDashboard = lazy(() =>
    import('./components/FlowDashboard').then((m) => ({ default: m.FlowDashboard }))
);

const flowModule: ModuleDefinition = {
    id: 'flow',
    title: 'Flow',
    description: 'Kollaborationsformat fuer Bildungsgaenge',
    icon: '',
    basePath: '/flow',
    accent: 'var(--module-accent-flow)',
    accentRgb: '59, 130, 246',  // Blau-Ton, muss abgestimmt werden
    requiredModule: 'flow',
    PublicPage: FlowApp,
    adminRoutes: [],  // Flow hat kein separates Admin-Panel
    teacherLayout: FlowDashboard,
    teacherRoutes: [
        { index: true, Component: FlowDashboard },
        // Weitere Routen werden hier ergaenzt
    ],
    sidebarNav: {
        label: 'Flow',
        items: [
            { path: '/flow', label: 'Dashboard' },
            { path: '/flow/aufgaben', label: 'Meine Aufgaben' },
        ],
    },
};

export default flowModule;
```

### Registry-Eintrag (src/modules/registry.ts)

```ts
// Hinzufuegen:
import flowModule from './flow/index';

// In allModules[]:
const allModules: ModuleDefinition[] = [
    elternsprechtagModule,
    schulsozialarbeitModule,
    beratungslehrerModule,
    flowModule,              // NEU
];
```

## Komponentenstruktur (angepasst an eduVite-Patterns)

Das Fachkonzept definiert eine umfangreiche Komponentenhierarchie. Fuer die Integration in eduVite wird diese angepasst:

### Verzeichnisstruktur

```
src/modules/flow/
├── index.ts                          # ModuleDefinition
├── components/
│   ├── FlowApp.tsx                   # Einstiegspunkt (PublicPage)
│   ├── FlowDashboard.tsx             # Persoenliches Dashboard
│   ├── BildungsgangUebersicht.tsx    # Bildungsgang-Detail
│   ├── ArbeitspaketErstellen.tsx     # Neues Paket anlegen
│   ├── ArbeitspaketDetail.tsx        # Hauptansicht eines Pakets
│   ├── ArbeitspaketHeader.tsx        # Status, Deadline, Zaehler
│   ├── ProblemBeschreibung.tsx       # Ist/Soll-Anzeige
│   ├── AufgabenListe.tsx            # Checkliste
│   ├── AufgabeItem.tsx              # Einzelne Aufgabe mit Status
│   ├── AufgabeErstellen.tsx         # Formular
│   ├── MeineAufgaben.tsx            # Paketuebergreifend
│   ├── TagungenUebersicht.tsx       # Alle Tagungen
│   ├── TagungDetail.tsx             # Agenda + Dokumentation
│   ├── TagungErstellen.tsx          # Formular
│   ├── AgendaPunktEditor.tsx        # Ergebnis/Entscheidung/Aufgaben
│   ├── MitgliederVerwalten.tsx      # Rollen zuweisen
│   ├── DateiBereich.tsx             # Upload + Liste
│   ├── AbschlussDialog.tsx          # Zusammenfassung + Reflexion
│   ├── AbschlussZusammenfassung.tsx # Ergebnisseite
│   ├── AbteilungsDashboard.tsx      # Aggregierte Sicht
│   ├── HinweisLeiste.tsx            # Kontextbezogene Hinweise
│   ├── StatusBadge.tsx              # Entwurf/Geplant/Aktiv/Abgeschlossen
│   ├── FortschrittsBalken.tsx       # x von y Aufgaben
│   └── DeadlineAnzeige.tsx          # ok/bald/ueberfaellig
├── hooks/
│   ├── useArbeitspakete.ts          # CRUD + Status (TanStack Query)
│   ├── useAufgaben.ts              # CRUD + Statuswechsel
│   ├── useTagungen.ts              # CRUD + Dokumentation
│   ├── useMeineAufgaben.ts         # Persoenliche Aggregation
│   ├── useBildungsgang.ts          # Bildungsgang-Daten
│   ├── useFlowBerechtigungen.ts    # Rollenbasierte Pruefung
│   └── useHinweise.ts              # Hinweis-Berechnung
└── utils/
    ├── berechtigungen.ts            # darfAusfuehren()
    ├── statusmaschine.ts            # pruefeUebergang()
    └── hinweise.ts                  # berechneHinweise()
```

### Abweichungen vom Fachkonzept

| Fachkonzept | Implementierung | Grund |
|---|---|---|
| `components/layout/` (Sidebar, Topbar, AppShell) | Nicht im Modul | eduVite hat ein globales Layout |
| `components/shared/RollenGuard.tsx` | `components/RollenGuard.tsx` oder inline | Kein shared-Ordner noetig, nur Flow nutzt es |
| `components/shared/AvatarGruppe.tsx` | Pruefen ob global vorhanden | Koennte in `src/components/` existieren |
| `components/shared/LeerZustand.tsx` | Inline oder globale Komponente | Kein eigener shared-Ordner |
| `context/AuthContext.tsx` | Bestehender `AuthContext` nutzen | eduVite hat bereits Auth-Context |
| `context/BerechtigungsContext.tsx` | `hooks/useFlowBerechtigungen.ts` | Hook statt Context, einfacher |
| `hooks/useKalenderAbo.ts` | Phase 3, nicht MVP | Priorisierung |
| `utils/kalender.ts` | Phase 3, Backend-seitig | iCal-Generierung gehoert ins Backend |
| `utils/statistiken.ts` | Backend liefert aggregiert | Keine Client-seitige Berechnung |

## Routing innerhalb des Moduls

Flow braucht mehr Routen als die bisherigen Module. Empfehlung: eigenen Router innerhalb von `FlowApp.tsx`.

```tsx
// FlowApp.tsx
import { Routes, Route } from 'react-router-dom';

export function FlowApp() {
    return (
        <Routes>
            <Route index element={<FlowDashboard />} />
            <Route path="bildungsgang/:id" element={<BildungsgangUebersicht />} />
            <Route path="arbeitspaket/neu/:bgId" element={<ArbeitspaketErstellen />} />
            <Route path="arbeitspaket/:id" element={<ArbeitspaketDetail />} />
            <Route path="arbeitspaket/:id/tagung/:tid" element={<TagungDetail />} />
            <Route path="aufgaben" element={<MeineAufgaben />} />
            <Route path="abteilung" element={<AbteilungsDashboard />} />
        </Routes>
    );
}
```

Alle Pfade relativ zu `/flow/`.

## State Management

TanStack Query (React Query) ist im Fachkonzept empfohlen. Pruefung: Ist TanStack Query bereits im Projekt?

Falls nicht vorhanden, zwei Optionen:
1. **TanStack Query hinzufuegen** -- sauberer, aber neue Dependency
2. **Eigene Hooks mit `useState` + `useEffect`** -- kein neues Paket, aber mehr Boilerplate

Empfehlung: Pruefen ob TanStack Query in `package.json` steht. Falls nicht, als Teil des Flow-Moduls einfuehren -- der Nutzen ist projektuebergreifend.

## CSS Custom Property

In der globalen CSS-Datei (pruefen wo `--module-accent-schulsozialarbeit` definiert ist):

```css
--module-accent-flow: #3B82F6;  /* Blau, abzustimmen */
```

## Hinweissystem-Darstellung

Die Hinweis-Stufen muessen auf bestehende CSS-Klassen oder -Variablen gemappt werden:

| Stufe | CSS-Klasse | Farbe |
|---|---|---|
| `info` | Dezent, `var(--brand-muted)` | Grau/Blau |
| `warnung` | Hervorgehoben, `var(--brand-warning)` | Gelb/Orange |
| `ueberfaellig` | Dringend, `var(--brand-danger)` | Rot |

Pruefen welche `--brand-*` Variablen existieren und die Hinweis-Darstellung daran anpassen.

## MVP-Scope fuer Komponenten

### MVP (Phase 1)

- FlowApp, FlowDashboard
- BildungsgangUebersicht
- ArbeitspaketErstellen, ArbeitspaketDetail, ArbeitspaketHeader
- ProblemBeschreibung
- AufgabenListe, AufgabeItem, AufgabeErstellen
- MeineAufgaben
- TagungErstellen, TagungDetail (Basis)
- MitgliederVerwalten
- DateiBereich (Upload + Liste)
- AbschlussDialog
- AbteilungsDashboard
- HinweisLeiste, StatusBadge, FortschrittsBalken, DeadlineAnzeige
- Alle Hooks und Utils

### Phase 2

- AgendaPunktEditor (erweitert)
- AbschlussZusammenfassung (automatisch generiert)
- AktivitaetsFeed
- TagungenUebersicht (mit Zaehler)

### Phase 3 (Kalender)

- Kalender-Abo-Einstellungen
- KollisionsHinweis
