# Budget- und Reichweiten-Dashboard · Projekt GOÄ-Novelle

**Öffnen:** `Budget-Dashboard.html` per Doppelklick im Browser starten (offline, kein Server, kein Login).

## Bedienung
1. **Reichweite:** Budget eingeben (Freitext wie `200.000` oder `200k`, oder Schnellwahl), netto/brutto wählen, festlegen ob Reisekosten aus dem Budget bezahlt werden und den Leistungsbeginn setzen (auch 2026). Oben rechts steht der Satz „… reicht bis ca. [Datum] (KW xx/Jahr)“ samt Beratertagen je Rolle.
2. **Umkehrrechnung:** Zieldatum wählen → benötigtes Budget netto/brutto.
3. **Kapazitätsplanung** (Reiter): FTE je Rolle und KW in 5-%-Schritten ändern; Bereich setzen (z. B. Senior Consultant KW05–KW12 auf 25 %); Rolle hinzufügen/entfernen; Plan verlängern; „Ausgangsplan wiederherstellen“. Alle Kennzahlen und Diagramme aktualisieren sich sofort.
4. **Parameter** (Reiter): Tagessätze, Tage je FTE-Woche, Onsite-Quote, Reisekosten je Onsite-Tag, MwSt.; optional Feiertage und Weihnachtspause.
5. **Szenarien** (Reiter): aktuellen Plan benennen und speichern (im Browser, optional), Vergleichstabelle mit Δ zum Basisplan.
6. **Export:** „Excel-Export“ (echte Formeln) und „Budget-Steckbrief drucken“ (eine A4-Seite, als PDF speicherbar).

## Entwicklung
`node build.js` baut die Einzeldatei aus `src/` und `config/basisplan.json`. `node --test tests/*.test.js` führt die Tests aus (der Excel-Rückrechnungstest benötigt LibreOffice und wird sonst übersprungen). `tools/extract_config.py` erzeugt den anonymisierten Basisplan aus der Quelldatei, `tools/anon_check.py` prüft, dass keine Namen aus der Quelldatei im Output stehen. Die Quelldatei gehört nicht ins Repository.

## Annahmen (auch im Dashboard unter „Annahmen“)
- Excel-Logik gilt: Beratertage = Auslastung × 5; Reisekosten = Beratertage × 40 % × 200 €; brutto = netto × 1,19 (auch auf Reisekosten).
- Plan-Woche 1 = Kalenderwoche des Leistungsbeginns; ein anderer Start verschiebt den ganzen Plan, ein Start mitten in der Woche rechnet nur die Resttage.
- Reisekosten fallen proportional zu den Beratertagen an (Excel: nur Gesamtsumme).
- In der Endwoche werden die Kosten gleichmäßig auf die Arbeitstage (Mo–Fr) verteilt; „reicht bis“ = Arbeitstag, an dem das Budget aufgebraucht wird (letzter voll gedeckter Tag wird zusätzlich genannt).
- Vorschuss wird auf den Gesamtplan angerechnet; angezeigt wird der noch ungedeckte Rest.
- Standards: Betrag netto, Reisekosten aus dem Budget, Feiertage/Weihnachtspause aus (Basisplan = Excel exakt). Feiertage: bundesweit; Weihnachtspause 24.–31.12.; Urlaub nur über die Auslastung abbildbar.
- Plan-Verlängerung übernimmt die Auslastung der letzten Woche; leere Quellzellen = 0 %.
- Datenbereinigung ggü. Quelle: #REF!-Durchschnitte neu berechnet, Platzhalterzeilen entfernt, eine Tagessatztabelle als einzige Quelle für Tagessätze.
- Szenarienvergleich nutzt für alle Szenarien den aktuell eingestellten Leistungsbeginn.
