# Arbeitsablaeufe

## Neues Modul erstellen

1. Migration: `backend/migrations/<nnn>_<name>.sql`
2. Backend-Routes: `backend/modules/<name>/routes/*.js`
3. Backend-Manifest: `backend/modules/<name>/index.js` mit `register(app, db)`
4. Frontend-Komponenten: `src/modules/<name>/components/*.tsx`
5. Frontend-Manifest: `src/modules/<name>/index.ts` mit `ModuleDefinition`
6. Registry: `src/modules/registry.ts` (Import + allModules-Eintrag)
7. Env: `ENABLED_MODULES` / `VITE_ENABLED_MODULES` erweitern
8. Referenz-Module: `elternsprechtag`, `schulsozialarbeit`

## Feature erweitern

1. Backend vor Frontend implementieren
2. Neue Typen in `src/types/index.ts`
3. API-Client in `src/services/api.ts`
4. Build pruefen: `npm run build`

## Commit-Nachrichten

```
feat(scope): Beschreibung     # Neues Feature
fix(scope): Beschreibung      # Bugfix
ui(scope): Beschreibung       # UI-Aenderung
style(scope): Beschreibung    # Code-Formatierung
docs(scope): Beschreibung     # Dokumentation
```
