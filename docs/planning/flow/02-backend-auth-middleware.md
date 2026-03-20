# Flow Modul – Phase 2: Auth-Konzept und Middleware

> Abhaengigkeiten: Phase 1 (DB-Schema), `backend/middleware/auth.js`
> Neue Dateien: `backend/modules/flow/middleware/flowAuth.js`

## Problemstellung

Die bestehenden Module (SSW, BL, Elternsprechtag) kennen nur systemweite Rollen (`admin`, `teacher`, `ssw`, `superadmin`) und modulweiten Zugang (`requireModuleAccess`).

Flow braucht **objektbezogene Rollen**: Ein User kann in Arbeitspaket A `koordination` sein, in Paket B `mitwirkende` und in Paket C keinen Zugang haben. Das ist ein neues Pattern im Projekt.

## Architektur-Entscheidung

### Option A: Middleware pro Route (gewaehlt)

Eigene Middleware-Funktionen im Flow-Modul, die pro Request die Mitgliedschaft in `flow_arbeitspaket_mitglied` pruefen.

Vorteile:
- Keine Aenderung an der bestehenden Auth-Infrastruktur
- Klare Trennung: Flow-Berechtigungen leben im Flow-Modul
- Einfach testbar

### Option B: Erweiterung von `requireModuleAccess` (verworfen)

Wuerde die bestehende Middleware mit objektbezogener Logik aufblaehen und die anderen Module beeinflussen.

## Middleware-Funktionen

```
backend/modules/flow/middleware/flowAuth.js
```

### 1. requireFlowBildungsgangRolle(minRolle)

Prueft: Ist der User Mitglied des Bildungsgangs mit mindestens der angegebenen Rolle?

```js
// Rollen-Hierarchie: leitung > mitglied
export function requireFlowBildungsgangRolle(minRolle) {
    return async (req, res, next) => {
        const userId = req.user.id;
        const bildungsgangId = req.params.bildungsgangId || req.params.id;

        const result = await query(
            'SELECT rolle FROM flow_bildungsgang_mitglied WHERE bildungsgang_id = $1 AND user_id = $2',
            [bildungsgangId, userId]
        );

        if (result.rows.length === 0) {
            // Admin/Superadmin Bypass
            if (['admin', 'superadmin'].includes(req.user.role)) {
                req.flowBgRolle = 'leitung'; // Implizite Vollberechtigung
                return next();
            }
            return res.status(403).json({ error: 'Kein Zugang zu diesem Bildungsgang' });
        }

        const rolle = result.rows[0].rolle;
        if (minRolle === 'leitung' && rolle !== 'leitung') {
            return res.status(403).json({ error: 'Bildungsgangleitung erforderlich' });
        }

        req.flowBgRolle = rolle;
        next();
    };
}
```

### 2. requireFlowPaketRolle(erlaubteRollen)

Prueft: Hat der User eine der erlaubten Rollen im Arbeitspaket?

**Entscheidung (2026-03-20): Kein Admin-Bypass fuer Paketdetails.** Auch `admin`/`superadmin` muessen explizit als Mitglied eingeladen sein, um Paketdetails zu sehen. Admins sehen nur die aggregierte Abteilungssicht.

```js
// Verwendung: requireFlowPaketRolle(['koordination'])
//             requireFlowPaketRolle(['koordination', 'mitwirkende'])
//             requireFlowPaketRolle(['koordination', 'mitwirkende', 'lesezugriff'])
export function requireFlowPaketRolle(erlaubteRollen) {
    return async (req, res, next) => {
        const userId = req.user.id;
        const arbeitspaketId = req.params.arbeitspaketId || req.params.id;

        const result = await query(
            'SELECT rolle FROM flow_arbeitspaket_mitglied WHERE arbeitspaket_id = $1 AND user_id = $2',
            [arbeitspaketId, userId]
        );

        if (result.rows.length === 0) {
            // KEIN Admin-Bypass! Bewusste Entscheidung.
            // Admins sehen nur die aggregierte Abteilungssicht.
            return res.status(403).json({ error: 'Kein Zugang zu diesem Arbeitspaket' });
        }

        const rolle = result.rows[0].rolle;
        if (!erlaubteRollen.includes(rolle)) {
            return res.status(403).json({ error: 'Unzureichende Berechtigung' });
        }

        req.flowPaketRolle = rolle;
        next();
    };
}
```

### 3. requireFlowAbteilungsleitung

Fuer den aggregierten Abteilungsleitungs-Endpunkt. Prueft gegen die **dedizierte Tabelle** `flow_abteilungsleitung` (keine Systemrolle).

```js
export async function requireFlowAbteilungsleitung(req, res, next) {
    const userId = req.user.id;

    // Superadmin hat immer Zugriff auf die Abteilungssicht
    if (req.user.role === 'superadmin') return next();

    const result = await query(
        'SELECT 1 FROM flow_abteilungsleitung WHERE user_id = $1',
        [userId]
    );

    if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Nur fuer Abteilungsleitung' });
    }

    next();
}
```

### 4. requireFlowPaketAnlage(bildungsgangId)

Prueft auf Bildungsgang-Ebene, ob der User Arbeitspakete anlegen darf.

```js
export async function requireFlowPaketAnlage(req, res, next) {
    const userId = req.user.id;
    const bildungsgangId = req.params.bildungsgangId || req.params.id;

    // Admin/Superadmin Bypass
    if (['admin', 'superadmin'].includes(req.user.role)) {
        return next();
    }

    const bgResult = await query(
        `SELECT bgm.rolle, bg.erlaubt_mitgliedern_paket_erstellung
         FROM flow_bildungsgang_mitglied bgm
         JOIN flow_bildungsgang bg ON bg.id = bgm.bildungsgang_id
         WHERE bgm.bildungsgang_id = $1 AND bgm.user_id = $2`,
        [bildungsgangId, userId]
    );

    if (bgResult.rows.length === 0) {
        return res.status(403).json({ error: 'Kein Mitglied des Bildungsgangs' });
    }

    const { rolle, erlaubt_mitgliedern_paket_erstellung } = bgResult.rows[0];

    if (rolle === 'leitung') return next();
    if (rolle === 'mitglied' && erlaubt_mitgliedern_paket_erstellung) return next();

    return res.status(403).json({ error: 'Keine Berechtigung zur Paketanlage' });
}
```

## Abteilungsleitung: Architektonische Grenze

Die harte Grenze fuer die Abteilungsleitung wird auf drei Ebenen durchgesetzt:

### 1. Eigener Router

Die Abteilungsleitungs-Endpunkte laufen auf einem **separaten Router** (`/api/flow/abteilung/...`), der physisch von den Arbeitspaket-Detail-Routen getrennt ist.

### 2. Eigener Service

Der `abteilungService` fuehrt eigene SQL-Queries aus, die **strukturell** nur `id`, `titel`, `bildungsgang_name`, `status`, `deadline` selektieren. Es gibt keine Funktion im Service, die Details zurueckgibt.

### 3. Kein Fallthrough

Selbst wenn ein Admin/Superadmin die Detail-API aufruft, prueft `requireFlowPaketRolle` die Mitgliedschaft. Admins haben zwar Bypass, aber die Abteilungsleitung-Rolle (`admin`) hat keinen automatischen Bypass auf Arbeitspaket-Ebene -- es sei denn, sie ist explizit als `lesezugriff` eingeladen.

**Entscheidung (2026-03-20):** Admin-Bypass ist fuer Flow bewusst **deaktiviert**. Admins sehen nur die aggregierte Abteilungssicht (falls sie in `flow_abteilungsleitung` eingetragen sind). Fuer Paketdetails muessen sie explizit als Mitglied eingeladen werden. Das ist eine bewusste Abweichung vom bisherigen Pattern, die dem datenschutzrechtlichen Grundsatz der Datensparsamkeit entspricht.

Einzige Ausnahme: `superadmin` hat Zugriff auf die Abteilungssicht (Systemverwaltung).

## Aufgaben-Erstellung: Kontextbasierte Berechtigung

Die Regel "Mitwirkende duerfen nur aus Tagungen heraus Aufgaben an andere zuweisen" erfordert eine kontextbasierte Pruefung:

```js
export function requireFlowAufgabeErstellen(req, res, next) {
    const rolle = req.flowPaketRolle;
    const { zustaendig, tagungId } = req.body;

    if (rolle === 'koordination') return next(); // Darf alles

    if (rolle === 'mitwirkende') {
        // Ohne Tagung-Kontext: nur sich selbst zuweisen
        if (!tagungId && zustaendig !== req.user.id) {
            return res.status(403).json({
                error: 'Mitwirkende duerfen ausserhalb von Tagungen nur sich selbst Aufgaben zuweisen'
            });
        }
        // Mit Tagung-Kontext: frei zuweisen (inkl. Deadline)
        return next();
    }

    return res.status(403).json({ error: 'Keine Berechtigung' });
}
```

## Route-Middleware-Kette (Beispiel)

```js
// Arbeitspaket-Detail abrufen
router.get('/:id',
    requireAuth,
    requireFlowPaketRolle(['koordination', 'mitwirkende', 'lesezugriff']),
    getArbeitspaketDetail
);

// Aufgabe erstellen
router.post('/:id/aufgaben',
    requireAuth,
    requireFlowPaketRolle(['koordination', 'mitwirkende']),
    requireFlowAufgabeErstellen,
    createAufgabe
);

// Arbeitspaket abschliessen
router.post('/:id/abschliessen',
    requireAuth,
    requireFlowPaketRolle(['koordination']),
    abschliessenArbeitspaket
);
```
