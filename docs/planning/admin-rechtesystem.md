# Granulares Admin-Rechtesystem

## Überblick

Das System unterscheidet drei Ebenen:

| Ebene | Rolle/Mechanismus | Kann |
|-------|-------------------|------|
| **Superadmin** | `role=superadmin` (env-basiert) | Alles: Branding, Module, OAuth, Admin-Rechte vergeben |
| **Global-Admin** | `role=admin` | Alle Module verwalten, Benutzer verwalten |
| **Modul-Admin** | `role=teacher` + `user_admin_access` | Nur zugewiesene Module verwalten |

## Rollen (nach Migration 061)

| Rolle | DB-Wert | Beschreibung |
|-------|---------|-------------|
| Superadmin | `superadmin` | Env-basiert, kein DB-User |
| Admin | `admin` | Vollzugriff auf alle Module |
| Lehrkraft | `teacher` | Eigene Termine, optional Modul-Zugang |

**Rolle `ssw` wurde eliminiert.** SSW-Berater sind jetzt `role=teacher` + `module_access=schulsozialarbeit`.

## Modul-Zugang (user_module_access)

| module_key | Bedeutung |
|-----------|-----------|
| `beratungslehrer` | Zugang zum BL-Counselor-Bereich |
| `schulsozialarbeit` | Zugang zum SSW-Counselor-Bereich |
| `flow` | Zugang zum Flow-Modul |

## Admin-Modulrechte (user_admin_access, Migration 062)

| module_key | Bedeutung |
|-----------|-----------|
| `elternsprechtag` | Admin-Zugang: Sprechtage, Sprechzeiten |
| `schulsozialarbeit` | Admin-Zugang: SSW-Berater verwalten |
| `beratungslehrer` | Admin-Zugang: BL-Berater verwalten |
| `flow` | Admin-Zugang: Flow-Modul verwalten |

Vergabe nur durch Superadmin: `PUT /api/admin/users/:id/admin-access`

## Middleware-Hierarchie

```
requireAuth              → Jeder authentifizierte User
requireAdmin             → role=admin ODER superadmin
requireSuperadmin        → role=superadmin only
requireModuleAccess(key) → admin/superadmin ODER user_module_access
requireModuleAdmin(key)  → admin/superadmin ODER user_admin_access
```

## API-Endpunkte (neu)

| Method | Path | Auth | Beschreibung |
|--------|------|------|-------------|
| GET | `/api/admin/users/:id/admin-access` | requireAdmin | Admin-Modulrechte lesen |
| PUT | `/api/admin/users/:id/admin-access` | requireSuperadmin | Admin-Modulrechte setzen |

## Beispiel: SSW-Modul-Admin einrichten

1. Superadmin erstellt einen User (Lehrkraft) über "Benutzer & Rechte"
2. Superadmin vergibt `module_access: schulsozialarbeit` (Counselor-Zugang)
3. Superadmin vergibt `admin_access: schulsozialarbeit` (Admin-Zugang)
4. User sieht jetzt "Schulsozialarbeit" in der Sidebar und kann Berater verwalten

## Migration

### 061: SSW-Rolle eliminieren
- Token-Version aller SSW-User inkrementiert (Session-Invalidierung)
- `user_module_access` mit `schulsozialarbeit` befüllt
- `role` von `ssw` auf `teacher` gesetzt
- DB-Constraint aktualisiert

### 062: user_admin_access Tabelle
- Neue Tabelle mit `(user_id, module_key, access_level, granted_by)`
- UNIQUE-Constraint auf `(user_id, module_key)`
