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

## Qualität

```bash
npm test         # Unit- und API-Tests
npm run lint     # ESLint + TypeScript (strict)
```

## Backup

Solange der Export (Phase 4) fehlt: Server stoppen und `data/finanzen.db` kopieren.

## Stand

- Phase 1: Transaktionen anlegen, bearbeiten, löschen; Liste mit Suche, Filtern, Sortierung und Inline-Kategorie.
- Phase 2: Kategorien verwalten (Farbe, „ist Sparen“, archivieren, löschen mit Umbuchung), Regeln („Empfänger enthält REWE → Lebensmittel“), Auto-Kategorisierung neuer Buchungen, Regelangebot nach manueller Kategorisierung, Übersicht „Unkategorisiert“.
- Phase 3: Dashboard mit Zeitraum-Auswahl (Monat, Quartal, Jahr, benutzerdefiniert, Vor/Zurück), KPI-Kacheln mit Vergleich zum Vorzeitraum, Ausgaben nach Kategorie (Donut, Klick filtert die Buchungsliste), 12-Monats-Verlauf mit Saldo-Linie, Kategorie-Trend, Top-Empfänger. Jedes Diagramm hat Tooltips mit exakten Beträgen, die Verläufe zusätzlich eine Tabellenansicht.

### Kennzahlen

- **Ausgaben:** alle Ausgaben außer Kategorien mit Flag „ist Sparen“.
- **Gespart:** Ausgaben in Sparen-Kategorien.
- **Saldo:** Einnahmen − Ausgaben − Gespartes.
- **Sparquote:** (Einnahmen − Ausgaben) / Einnahmen, ohne Einnahmen nicht definiert („–“).

### Regel-Vorrang

Bei mehreren Treffern gewinnt: höhere Priorität → genauerer Vergleich (gleich > beginnt mit > enthält) → längerer Suchtext → ältere Regel. Eine manuell gewählte Kategorie hat immer Vorrang vor Regeln.
