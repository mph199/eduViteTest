# Flow Modul – Phase 5: Frontend-Komponenten und Modul-Registrierung

> **Implementierungsstand (2026-03-21):**
> - Alle Kern-Komponenten implementiert (FlowLayout, FlowSidebar, FlowDashboard, etc.)
> - Admin-Seiten (BGL-Verwaltung, Abteilungssicht) laufen jetzt unter `/teacher/flow/admin/*` innerhalb FlowLayout (statt unter `/admin/flow/*` als separate adminRoutes)
> - FlowSidebar zeigt rollenabhaengig Admin-Sektion fuer admin/superadmin
> - Burger-Menue zeigt nur noch einen einzelnen Einstiegslink "Hier geht's zu Flow"
> - Hooks-Verzeichnis (`hooks/`) und Utils-Verzeichnis (`utils/`) nicht implementiert – Logik direkt in Komponenten
> - QueryClientProvider liegt zentral in FlowLayout (nicht pro Seite)

> Abhaengigkeiten: Phase 4 (Types + API Client)
> Neue Dateien:
> - `src/modules/flow/index.ts`
> - `src/modules/flow/components/*.tsx`
> - `src/modules/flow/hooks/*.ts`
> - `src/modules/flow/utils/*.ts`
> Aenderungen in:
> - `src/modules/registry.ts` (Interface + Import)
> - `src/App.tsx` (Guard fuer Module ohne PublicPage)
> - `src/pages/LandingPage.tsx` (Filter fuer interne Module)
> - CSS: `--module-accent-flow` definieren

## Entscheidung (2026-03-20): Rein internes Modul

Flow ist **kein oeffentliches Buchungstool**. Es gibt:
- Keine Kachel auf der Landing Page
- Keine oeffentliche Seite (`PublicPage`)
- Keinen oeffentlichen `basePath`

Zugang nur ueber den eingeloggten Bereich (Lehrer-/Admin-Layout).

### Konsequenz: Anpassung am Modulsystem

Flow ist das erste Modul ohne oeffentlichen Einstiegspunkt. Das erfordert drei Aenderungen am bestehenden Code:

#### 1. `src/modules/registry.ts` -- PublicPage optional machen

```ts
// VORHER:
PublicPage: LazyExoticComponent<ComponentType>;

// NACHHER:
PublicPage?: LazyExoticComponent<ComponentType>;
```

Die bestehenden Module (Elternsprechtag, SSW, BL) sind davon nicht betroffen -- sie setzen `PublicPage` weiterhin.

#### 2. `src/App.tsx` -- Guard fuer Module ohne PublicPage

In der Route-Generierung (ca. Zeile 53-59) muss geprueft werden, ob `mod.PublicPage` existiert:

```tsx
// VORHER:
{activeModules.map((mod) => (
    <Route key={mod.id} path={`${mod.basePath}/*`}
        element={<mod.PublicPage />} />
))}

// NACHHER:
{activeModules.filter((mod) => mod.PublicPage).map((mod) => (
    <Route key={mod.id} path={`${mod.basePath}/*`}
        element={<mod.PublicPage />} />
))}
```

#### 3. `src/pages/LandingPage.tsx` -- Interne Module ausfiltern

Die Landing Page rendert Kacheln fuer alle `activeModules`. Module ohne `PublicPage` muessen herausgefiltert werden:

```tsx
// VORHER:
{activeModules.map((mod) => (
    <Link to={mod.basePath}>...</Link>
))}

// NACHHER:
{activeModules.filter((mod) => mod.PublicPage).map((mod) => (
    <Link to={mod.basePath}>...</Link>
))}
```

## Modul-Registrierung

### Frontend-Manifest (src/modules/flow/index.ts)

```ts
import { lazy } from 'react';
import type { ModuleDefinition } from '../registry';

const FlowDashboard = lazy(() =>
    import('./components/FlowDashboard').then((m) => ({ default: m.FlowDashboard }))
);

const FlowRouter = lazy(() =>
    import('./components/FlowRouter').then((m) => ({ default: m.FlowRouter }))
);

const AbteilungsDashboard = lazy(() =>
    import('./components/AbteilungsDashboard').then((m) => ({ default: m.AbteilungsDashboard }))
);

const flowModule: ModuleDefinition = {
    id: 'flow',
    title: 'Flow',
    description: 'Kollaborationsformat fuer Bildungsgaenge',
    icon: '',
    basePath: '/flow',
    accent: 'var(--module-accent-flow)',
    accentRgb: '59, 130, 246',
    requiredModule: 'flow',
    // KEIN PublicPage -- rein internes Modul
    adminRoutes: [
        {
            path: '/admin/flow/abteilung',
            label: 'Flow Abteilungssicht',
            Component: AbteilungsDashboard,
        },
    ],
    teacherLayout: FlowRouter,
    teacherRoutes: [
        { index: true, Component: FlowDashboard },
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

### Entscheidung (2026-03-20): Routing unter `/teacher/flow/*`

Flow laeuft unter `/teacher/flow/*` (konsistent mit bestehendem Pattern), bleibt aber ein **eigenstaendiges, anschaltbares Modul**:

| Steuerung | Mechanismus | Wert |
|---|---|---|
| Backend-Laden | `ENABLED_MODULES` (env) | `...,flow` |
| Frontend-Laden | `VITE_ENABLED_MODULES` (env, Build-time) | `...,flow` |
| Superadmin-Aktivierung | `module_config`-Tabelle | `module_id = 'flow'` |
| User-Zugang | `user_module_access`-Tabelle | `module_key = 'flow'` |
| Frontend-Sichtbarkeit | `requiredModule: 'flow'` im Manifest | Sidebar/Routen nur bei Zugang |

Flow kann unabhaengig von anderen Modulen aktiviert/deaktiviert werden. Das Routing unter `/teacher/` ist nur der URL-Pfad -- die Modul-Logik (Laden, Auth, Sichtbarkeit) laeuft komplett eigenstaendig.

### Registry-Eintrag (src/modules/registry.ts)

```ts
import flowModule from './flow/index';

const allModules: ModuleDefinition[] = [
    elternsprechtagModule,
    schulsozialarbeitModule,
    beratungslehrerModule,
    flowModule,              // NEU – kein PublicPage
];
```

## Komponentenstruktur (angepasst an eduVite-Patterns)

Das Fachkonzept definiert eine umfangreiche Komponentenhierarchie. Fuer die Integration in eduVite wird diese angepasst:

### Verzeichnisstruktur

```
src/modules/flow/
├── index.ts                          # ModuleDefinition (kein PublicPage)
├── components/
│   ├── FlowRouter.tsx                # Internes Routing (teacherLayout)
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
│   ├── DateiBereich.tsx             # Metadaten + externe Links (kein lokaler Upload)
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

Flow nutzt `FlowRouter.tsx` als `teacherLayout`. Dieser rendert ein `<Outlet>` und definiert die Unterrouten.

```tsx
// FlowRouter.tsx – wird als teacherLayout gemountet
import { Outlet, Routes, Route } from 'react-router-dom';

export function FlowRouter() {
    return (
        <Routes>
            <Route index element={<FlowDashboard />} />
            <Route path="bildungsgang/:id" element={<BildungsgangUebersicht />} />
            <Route path="arbeitspaket/neu/:bgId" element={<ArbeitspaketErstellen />} />
            <Route path="arbeitspaket/:id" element={<ArbeitspaketDetail />} />
            <Route path="arbeitspaket/:id/tagung/:tid" element={<TagungDetail />} />
            <Route path="aufgaben" element={<MeineAufgaben />} />
        </Routes>
    );
}
```

Alle Pfade relativ zum Mount-Point (vermutlich `/teacher/flow/`).

Die Abteilungssicht laeuft **separat** als `adminRoute` unter `/admin/flow/abteilung` -- damit ist sie nur fuer User mit `flow_abteilungsleitung`-Eintrag erreichbar und physisch vom Arbeitspaket-Routing getrennt.

## State Management

**Entscheidung (2026-03-20): TanStack Query wird als neue Dependency eingefuehrt.**

Gruende:
- Flow hat ~20 API-Methoden mit komplexen Invalidierungs-Abhaengigkeiten (Paket-Detail invalidiert Aufgaben, Mitglieder, Aktivitaeten)
- Optimistic Updates bei Aufgaben-Status-Wechsel (Checkbox → sofort visuell erledigt) sind mit TanStack Query trivial
- Manuelles `useState`/`useEffect` wuerde zu massivem Boilerplate und Race Conditions fuehren
- Die Dependency nuetzt auch kuenftigen Modulen

### Setup

```bash
npm install @tanstack/react-query
```

`QueryClientProvider` wird in `FlowApp.tsx` oder global in `App.tsx` eingebunden (pruefen ob andere Module profitieren).

### Query-Key-Konvention

```ts
// Alle Flow-Keys beginnen mit ['flow', ...]
queryKey: ['flow', 'arbeitspakete', paketId]
queryKey: ['flow', 'aufgaben', paketId]
queryKey: ['flow', 'aufgaben', 'meine']
queryKey: ['flow', 'tagungen', paketId]
queryKey: ['flow', 'dashboard']
queryKey: ['flow', 'abteilung']
```

### Invalidierung

```ts
// Nach Aufgabe erstellen/aendern:
queryClient.invalidateQueries({ queryKey: ['flow', 'aufgaben', paketId] });
queryClient.invalidateQueries({ queryKey: ['flow', 'aufgaben', 'meine'] });
queryClient.invalidateQueries({ queryKey: ['flow', 'dashboard'] });

// Nach Mitglied hinzufuegen/entfernen:
queryClient.invalidateQueries({ queryKey: ['flow', 'arbeitspakete', paketId] });
```

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
