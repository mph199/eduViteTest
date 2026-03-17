# Terminvorschlaege-UX

> Status: Entwurf | Erstellt: 2026-03-17

## Problem

Wenn ein Lehrer/Berater gewaehlt wird, erscheinen alle verfuegbaren Zeitfenster gleichzeitig (4-20 Buttons). Das kann ueberfordernd wirken, besonders auf mobilen Geraeten.

## Ziel

Nutzer sehen initial 5 vorgeschlagene Termine. Auf Wunsch koennen alle weiteren freien Termine eingeblendet werden.

## Ist-Zustand

| Modul | Komponente | Slot-Berechnung | Anzahl |
|-------|-----------|-----------------|--------|
| elternsprechtag | `SlotList.tsx` | `buildHalfHourWindows()` clientseitig | 4-20 |
| schulsozialarbeit | `SSWBookingApp.tsx` | Backend liefert Termine | variabel |
| beratungslehrer | `BLBookingApp.tsx` | Backend liefert Termine | variabel |

Keine Paginierung, kein Limit, alle Slots werden per `.map()` gerendert.

## Umsetzungsvorschlaege

### Variante A: Frontend-Only (empfohlen)

Slots werden wie bisher vollstaendig geladen, aber nur die ersten 5 gerendert.

**Ablauf:**
1. Alle Slots berechnen/laden (unveraendert)
2. `displayedSlots = showAll ? slots : slots.slice(0, 5)`
3. Button "Weitere X freie Termine anzeigen" einblenden wenn `slots.length > 5`
4. Klick setzt `showAll = true`

**Vorteile:**
- Kein Backend-Aenderung noetig
- Sofortige Reaktion (Daten bereits vorhanden)
- Einfach rueckgaengig machbar

**Betroffene Dateien:**
- `src/modules/elternsprechtag/components/SlotList.tsx`
- `src/modules/schulsozialarbeit/components/SSWBookingApp.tsx`
- `src/modules/beratungslehrer/components/BLBookingApp.tsx`

### Variante B: Intelligente Vorschlaege

Statt der ersten 5 chronologischen Slots werden 5 "optimale" Slots vorgeschlagen.

**Kriterien:**
- Gleichmaessig ueber den Tag verteilt (nicht nur die fruehesten)
- Randzeiten bevorzugen (erster + letzter Slot immer dabei)
- Mittlere Slots gleichmaessig verteilt

**Algorithmus (Beispiel):**
```
slots = [09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 12:00]
suggested = [09:00, 10:00, 11:00, 12:00, 09:30]  // Rand + verteilt + Auffuellung
```

**Vorteile:**
- Bessere UX fuer Nutzer mit wenig Zeit
- Reduziert "Choice Overload"

**Nachteile:**
- Komplexere Logik
- Nutzer erwarten moeglicherweise chronologische Reihenfolge

### Variante C: Backend-Limit mit Cursor

Backend liefert max. 5 Slots, weitere per "Load More" nachladen.

**Nachteile:**
- Zusaetzliche API-Calls
- Inkompatibel mit clientseitiger Slot-Berechnung (Elternsprechtag)
- Overengineered fuer 4-20 Elemente

**Nicht empfohlen.**

## Empfehlung

**Variante A** fuer den Start. Spaeter optional zu **B** erweitern wenn Nutzerfeedback zeigt, dass die chronologische Auswahl nicht optimal ist.

## Offene Fragen

- Soll die Anzahl (5) konfigurierbar sein oder hardcoded?
- Soll der "Weitere anzeigen"-Button die Anzahl restlicher Slots anzeigen?
- Gilt das Limit auch fuer Desktop oder nur Mobile?
