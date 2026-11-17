# Finanz-Dashboard

Lokale Web-App für Einnahmen und Ausgaben. Alle Daten liegen in `data/finanzen.db` (SQLite) auf deinem Rechner, es gibt keine Cloud, kein Login und keine externen Aufrufe. Der Server lauscht nur auf `127.0.0.1`.

## Installation

Voraussetzung: Node.js ≥ 20.

```bash
npm install
```

## Starten

```bash
npm run dev      # Entwicklung: http://localhost:5173
npm start        # gebaut, ein Port: http://localhost:5174
```

Optional Beispieldaten (nur bei leerer Datenbank): `npm run seed`

## Tipps zur Bedienung

- Neue Buchung: `N` drücken, Betrag eingeben, mit `Tab` zum Empfänger, `Enter` speichert. Datum, Typ und Kategorie bleiben für die nächste Buchung stehen.
- Ist der Port belegt, startest du mit `PORT=5180 npm start` auf einem anderen. Im Entwicklungsmodus (`npm run dev`) nutzt das Frontend Port 5173 und der Server 5174.
- Beenden mit `Strg+C`; der Server schließt die Datenbank dabei sauber.

## Qualität

```bash
npm test         # Unit- und API-Tests
npm run lint     # ESLint + TypeScript (strict)
```

## Backup und Wiederherstellung

Alle Daten liegen in `data/finanzen.db` (SQLite). Es gibt zwei Wege zur Sicherung:

1. **In der App** unter „Daten“:
   - **JSON-Backup** enthält alles (Buchungen, Kategorien, Regeln, Budgets). Lege es regelmäßig an einem anderen Ort ab, z. B. auf einem USB-Stick oder in einem verschlüsselten Ordner.
   - **CSV** enthält nur die Buchungen (Semikolon, UTF-8, für Excel). Ausgaben stehen als negative Beträge.
   - **Wiederherstellen:** JSON-Datei wählen, Zusammenfassung prüfen, bestätigen. Dabei werden alle aktuellen Daten ersetzt. Der bisherige Stand wird vorher automatisch als `data/backups/vor-wiederherstellung-<Zeitstempel>.json` gesichert.
2. **Dateikopie:** Server stoppen und `data/finanzen.db` kopieren. Läuft der Server, liegen daneben die Dateien `finanzen.db-wal` und `finanzen.db-shm`, die dann mitkopiert werden müssen.

`data/` steht in der `.gitignore`, deine Finanzdaten landen also nicht im Repository.

## Stand

- Phase 1: Transaktionen anlegen, bearbeiten, löschen; Liste mit Suche, Filtern, Sortierung und Inline-Kategorie.
- Phase 2: Kategorien verwalten (Farbe, „ist Sparen“, archivieren, löschen mit Umbuchung), Regeln („Empfänger enthält REWE → Lebensmittel“), Auto-Kategorisierung neuer Buchungen, Regelangebot nach manueller Kategorisierung, Übersicht „Unkategorisiert“.
- Phase 3: Dashboard mit Zeitraum-Auswahl (Monat, Quartal, Jahr, benutzerdefiniert, Vor/Zurück), KPI-Kacheln mit Vergleich zum Vorzeitraum, Ausgaben nach Kategorie (Donut, Klick filtert die Buchungsliste), 12-Monats-Verlauf mit Saldo-Linie, Kategorie-Trend, Top-Empfänger. Jedes Diagramm hat Tooltips mit exakten Beträgen, die Verläufe zusätzlich eine Tabellenansicht.
- Phase 4: Monatsbudgets pro Kategorie (grün, gelb ab 80 %, rot bei Überschreitung) auf eigener Seite und im Dashboard, automatische Erkennung wiederkehrender Zahlungen mit Monatssumme, CSV-Export, JSON-Backup und Wiederherstellung.
- Phase 5: Hell/Dunkel/System-Umschalter (wird gemerkt), Dialoge mit Fokusfalle und Escape, Tastenkürzel (`N` springt zum Betragsfeld, `Enter` speichert), Skip-Link, Leerzustände, Fehlerseite, Tablet-Layout, saubere Fehlermeldungen von Server und API.

### Wiederkehrende Zahlungen

Erkannt werden Ausgaben mit gleichem Empfänger, ähnlichem Betrag (±10 %, mindestens ±0,50 €) und regelmäßigem Abstand: monatlich und vierteljährlich ab drei Buchungen, jährlich ab zwei. Ein ausgelassener Termin ist erlaubt. Eine Zahlung gilt als „beendet?“, wenn der letzte Termin länger als ein Rhythmus plus 10 Tage zurückliegt, und zählt dann nicht zur Monatssumme. Einnahmen und Sparen-Kategorien bleiben außen vor. Die Erkennung ist eine Heuristik: Gleich hohe Einkäufe im Monatsrhythmus (z. B. immer 32,70 € beim selben Händler) erscheinen ebenfalls.

### Kennzahlen

- **Ausgaben:** alle Ausgaben außer Kategorien mit Flag „ist Sparen“.
- **Gespart:** Ausgaben in Sparen-Kategorien.
- **Saldo:** Einnahmen − Ausgaben − Gespartes.
- **Sparquote:** (Einnahmen − Ausgaben) / Einnahmen, ohne Einnahmen nicht definiert („–“).

### Regel-Vorrang

Bei mehreren Treffern gewinnt: höhere Priorität → genauerer Vergleich (gleich > beginnt mit > enthält) → längerer Suchtext → ältere Regel. Eine manuell gewählte Kategorie hat immer Vorrang vor Regeln.
