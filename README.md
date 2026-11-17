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

Phase 1: Transaktionen anlegen, bearbeiten, löschen; Liste mit Suche, Filtern, Sortierung und Inline-Kategorie.
