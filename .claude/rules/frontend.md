---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "src/**/*.css"
---

# Frontend-Konventionen

- TypeScript strict, React Functional Components
- CSS-Dateien oder CSS-Module (kein Tailwind)
- Alle `fetch`-Aufrufe mit `credentials: 'include'`
- API-Responses zu Array normalisieren (verhindert `.map()`-Fehler auf undefined)
- Farben ausschliesslich ueber CSS Custom Properties: `var(--brand-primary)`, `var(--brand-dark)` etc.
- Keine Emojis in der UI (Sidebar, Tabs, Module)
- Neue Typen in `src/types/index.ts` ergaenzen
- API-Methoden in `src/services/api.ts` ergaenzen
- Neue Module in `src/modules/registry.ts` registrieren mit `ModuleDefinition`

## Layout-Constraint fuer Main Content

Jede Subpage im Admin/Teacher/Superadmin-Bereich MUSS diese Regeln einhalten:

- `max-width: 960px` (nicht volle Viewport-Breite)
- `padding: 32px 40px` auf Desktop, `24px 20px` auf Mobile (<=1024px)
- `margin: 0` (linkbuendig am Sidebar-Rand, NICHT `margin: 0 auto`)
- Auf Screens > 1400px entsteht rechts bewusst Whitespace — das ist gewollt
- Content-Elemente (Tabellen, Cards, Filter) duerfen `width: 100%` innerhalb des Containers sein
- Referenz-Klasse: `.admin-main` (shared.css) — fuer neue Admin/Teacher-Seiten nutzen
- Fuer Flow-Seiten: `.flow-content` (flow.css) uebernimmt dieselbe Rolle
- Fuer Superadmin-Seiten: `.superadmin__content` (SuperadminPage.css)
- KEINE Inline-Styles mit `maxWidth` oder `margin: '0 auto'` auf aeusseren Wrappern
