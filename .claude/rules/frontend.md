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
