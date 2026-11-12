# QS-Bericht – GOÄneu Steigerungsdashboard

- Quelle Zuordnungen: `input/GO__2028_AB_Steigerungsmatrix.xlsx`, Blatt „Steigerungsmatrix“
- Gebührenverzeichnis des Entwurfs (Excel): `input/gesetz/Gebuehrenverzeichnis_v6_20260715.xlsx`
- Zuordnung Ziffer → Kapitel/Abschnitt (JSON): `input/kapitel/GOAeneu_Ziffer_zu_Kapitel.json`
- Gesetzesentwurf mit Allgemeinen Bestimmungen (PDF): **lag beim Build nicht vor**
- Abnahmetests Daten: **23 von 23 bestanden**

## 1. Abnahmetests (Daten)

| Test | Ergebnis | Ist-Wert |
|---|---|---|
| Durch AB steigerfähige Ziffern (Matrix) = 1.999 | ✅ bestanden | 1999 |
| Dashboard enthält alle Ziffern der Zuordnungsdatei (5.580) ohne Duplikate | ✅ bestanden | 5580 Zeilen, 5580 eindeutig |
| Nicht durch AB steigerfähig = Gesamt − Matrix (3.581) | ✅ bestanden | 3581 |
| Alle Matrixziffern in der Zuordnungsdatei, Kapitel/Abschnitt identisch | ✅ bestanden | 0 fehlend, 0 abweichend |
| Ziffer 4500: Kapitel G, III. Psychotherapieverfahren …, 145,00 €, nicht durch AB steigerfähig | ✅ bestanden | Kapitel G · III. Psychotherapieverfahren, -methoden und -techniken · 145,00 € · kein Steigerungsgrund |
| Anzahl möglicher AB-Gründe je Ziffer: 0 → 3.581 · 1 → 197 · 2 → 95 · 3 → 1.472 · 4 → 235 | ✅ bestanden | 0 → 3581 · 1 → 197 · 2 → 95 · 3 → 1472 · 4 → 235 |
| Wortlaut der AB-Regel für alle 5 Gründe hinterlegt | ✅ bestanden | G: 972 Zeichen · B: 367 Zeichen · S: 313 Zeichen · F: 386 Zeichen · V: 272 Zeichen |
| Nebeneinander – Ziffer 1: „Nicht neben“ Ziffer 2 | ✅ bestanden | N [2] |
| Nebeneinander – Ziffer 310: „Nur neben“ 306, 307, 308, 309 | ✅ bestanden | U [306, 307, 308, 309] |
| Nebeneinander – Ziffern mit „Nicht neben“-Regel: 1.051, mit „Nur neben“-Regel: 6 | ✅ bestanden | 1051 / 6 |
| Nebeneinander – alle genannten Ziffern existieren im Gebührenverzeichnis | ✅ bestanden | 0 unbekannte Nennungen |
| Jede nicht steigerfähige Ziffer hat eine Leistungsbezeichnung | ✅ bestanden | 0 ohne Text |
| Keine doppelten Ziffern | ✅ bestanden | 1999 eindeutig |
| Steigerfähige Ziffern je Kapitel C=100 · D=2 · F=31 · L=1.705 · O=161 | ✅ bestanden | C=100 · D=2 · F=31 · L=1705 · O=161 |
| Reihenfolge der Kapitel C, D, F, L, O | ✅ bestanden | C, D, F, L, O |
| 23 Abschnitte mit steigerfähigen Ziffern | ✅ bestanden | 23 |
| Ziffer 1200: 21,00 €, nur B ×1,5 → max. 31,50 € | ✅ bestanden | 21,00 €, B ×1,5 → 31,50 € |
| Ziffer 900: 27,49 €, nur G ×2,0 → max. 54,98 € | ✅ bestanden | 27,49 €, G ×2,0 → 54,98 € |
| Ziffer 5600: 43,46 €; 1,5/2,0/3,0/4,0 praktisch, 6,0 nur theoretisch; 4,0 = 173,84 €; 6,0 = 260,76 € | ✅ bestanden | 43,46 €; 1,5 / 2,0 / 3,0 / 4,0 / 6,0 (theor.); praktisch 173,84 €; theoretisch 260,76 € |
| Verteilung max. praktischer Faktor (142/55/58/37/1.470/2/235) | ✅ bestanden | 1,5 → 142 · 2,0 → 55 · 2,25 → 58 · 3,0 → 37 · 4,0 → 1470 · 4,5 → 2 · 6,0 → 235 |
| AB-IDs der Definitionszeile vollständig (11) | ✅ bestanden | 02.03-4 · 03.01-6 · 05.03-1 · L-8 · 14.01-10 · 02.06-3 · L-11 · 14.01-11 · L-9 · L-10 · 14.01-12 |
| Faktoren der Definitionszeile G 2,0 · B 1,5 · S 2,0 · F 2,0 · V 1,5 | ✅ bestanden | G 2,0 · B 1,5 · S 2,0 · F 2,0 · V 1,5 |
| Excel in sich konsistent (Formeln M/U, Formatierung, Herleitung, Nachrechnung) | ✅ bestanden | keine Auffälligkeiten |

## 2. Abnahmetests (Oberfläche, Playwright)

| Test | Ergebnis | Ist-Wert |
|---|---|---|
| Startansicht: Status „5.580 von 5.580 Ziffern“ | ✅ bestanden | 5.580 von 5.580 Ziffern |
| Navigation: 17 Kapitel (B bis S) mit Titel, z. B. „L Chirurgie 2.478“ | ✅ bestanden | 17 Kapitel; G Neurologische, psychiatrische, psychotherapeutische und psychosomatische Leistungen 135 | L Chirurgie 2.478 |
| Navigation: Klick auf Kapitel L zeigt dessen Abschnitte und filtert auf 2.478 Ziffern | ✅ bestanden | 20 Abschnitte; 2.478 von 5.580 Ziffern |
| Virtualisierung: weniger als 80 Zeilen im DOM | ✅ bestanden | 23 Elemente |
| Faktorfilter zeigt Verteilung 142 / 55 / 58 / 37 / 1.470 / 2 / 235 | ✅ bestanden | ×1,0 – keine AB-Steigerung (3.581) ×1,5 (142) ×2,0 (55) ×2,25 (58) ×3,0 (37) ×4,0 (1.470) ×4,5 (2) ×6,0 (235) |
| Startansicht: alle Abschnitte eingeklappt | ✅ bestanden | 23 eingeklappt, 0 Zeilen |
| Klick auf Abschnitt klappt auf (B I, erste Ziffer 1) | ✅ bestanden | 1 |
| Suche „1200“ + Enter öffnet Ziffer 1200: 21,00 €, B ×1,5, max. 31,50 € | ✅ bestanden | Ziffer 1200 Schließen Esc Kapitel C – Nichtgebietsbezogene Sonderleistungen · VI. Sonographische Leistungen · Seite 92 Sonographische (Teil-)Untersuchung mit Be |
| URL-Hash gesetzt (#1200) | ✅ bestanden | GOAeneu_Steigerungsdashboard.html#1200 |
| Filter Chips G + S: 235 Ziffern | ✅ bestanden | 235 von 5.580 Ziffern |
| Schalter „theoretisch“: Faktorfilter nennt theoretische Höchstwerte (×6,0 → 1.470, ×12,0 → 235) | ✅ bestanden | ×1,0 – keine AB-Steigerung (3.581) ×1,5 (142) ×2,0 (55) ×2,25 (58) ×3,0 (37) ×4,5 (2) ×6,0 (1.470) ×12,0 (235) |
| Filter „Anzahl AB-Gründe“: 0 → 3.581 · 1 → 197 · 2 → 95 · 3 → 1.472 · 4 → 235 | ✅ bestanden | 0 – nicht steigerfähig (3.581) | 1 Grund (197) | 2 Gründe (95) | 3 Gründe (1.472) | 4 Gründe (235) |
| Anzahl = 1 + Suche „sonograph“: nur Ziffern mit genau einem Grund, darunter 1200 | ✅ bestanden | 66 von 5.580 Ziffern |
| Anzahl = 3: 1.472 Ziffern | ✅ bestanden | 1.472 von 5.580 Ziffern |
| Hover auf Tag B zeigt Wortlaut („Body-Mass-Index (BMI) ≥ 40 … 1,5fache Gebühr“) | ✅ bestanden | B Adipositas BMI ≥ 40 · ×1,5 Bei Patienten mit einem Body-Mass-Index (BMI) ≥ 40 (bei Kindern und Jugendlichen > 97. gesc |
| Hover auf Badge G in der Liste zeigt Wortlaut („Bei Gerinnungsstörungen …“) | ✅ bestanden | G Gerinnungsstörung · ×2,0 Bei Gerinnungsstörungen unter Therapie mit Vitamin K-Antagonisten, Gerinnungsstörun |
| Chip „Nicht durch AB steigerfähig“: 3.581 Ziffern | ✅ bestanden | 3.581 von 5.580 Ziffern |
| Ziffer 4500 (PSY): Kapitel G, 145,00 €, „Nicht durch AB steigerfähig“, max. Faktor ×1,0, kein Szenario | ✅ bestanden | Ziffer 4500 Schließen Esc Kapitel G – Neurologische, psychiatrische, psychotherapeutische und psychosomatische Leistungen · III. Psychotherapieverfahren, -methoden und -techniken · Seite 256 Analytische Psychotherapie, E |
| Direktlink #5600: 43,46 €, praktisch ×4,0 = 173,84 €, theoretisch ×6,0 = 260,76 € | ✅ bestanden | Ziffer 5600 Schließen Esc Kapitel L – Chirurgie · I. Plastische Chirurgie, Oberflächenchirurgie, Replantationschirurgie · Seite 323 Exzision eines kleinen kutanen Prozesses (Tumor, entzündlicher Proze |
| Ziffer 5600: Tabelle der Möglichkeiten | ✅ bestanden | p:×1,5:65,19 € p:×2,0:86,92 € p:×3,0:130,38 € p:×4,0:173,84 € t:×6,0:260,76 € |
| Szenario 5600 G+F: ×4,0 = 173,84 € (praktisch) | ✅ bestanden | G×F · Faktor ×4,0 173,84 € |
| Szenario 5600 G+B+F: ×6,0 = 260,76 €, als nur theoretisch markiert | ✅ bestanden | G×B×F · Faktor ×6,0 260,76 € / ✗ Nur theoretisch möglich – diese Kombin |
| Direktlink #900: 27,49 €, nur G ×2,0, max. 54,98 € | ✅ bestanden | Ziffer 900 Schließen Esc Kapitel C – Nichtgebietsbezogene Sonderleistungen · III. Punktionen · Seite 72 Punktion eines der folgenden Gelenke: Grund-, Mittel- od |
| Tastatur: von Ziffer 900 aus Pfeil ab, Pfeil ab, Enter öffnet Ziffer 902 | ✅ bestanden | Ziffer 902 |
| CSV-Export (Filter V): Kopf + 60 Zeilen, deutsche Dezimalzahlen | ✅ bestanden | 61 Zeilen; 13242;"O";"I. Radiologie";"CT- …  ×1,5, V ×1,5";"2,25";453,26 |
| Reiter „Nebeneinanderberechnung“: Chips Nicht neben 1.051 · Nur neben 6 · Keine Neben-Regel 4.525 | ✅ bestanden | ≠ Nicht neben 1.051 | + Nur neben 6 | – Keine Neben-Regel 4.525 |
| Chip „Nur neben“: 6 Ziffern | ✅ bestanden | 6 von 5.580 Ziffern |
| Ziffer 310: „Nur neben“ mit Wortlaut und Ziffern 306, 307, 308, 309 | ✅ bestanden | 306,307,308,309 · GOAeneu_Steigerungsdashboard.html#neben/310 |
| Klick auf genannte Ziffer 306 öffnet diese und zeigt „In Regeln anderer Ziffern genannt“ (310, 311) | ✅ bestanden | Ziffer 306 Schließen Esc Kapitel B – Grundleistungen, Allgemeinmedizin · IV. Berichte, Bri |
| Direktlink #neben/1: „Nicht neben“ Ziffer 2 mit Wortlaut | ✅ bestanden | Ziffer 1 Schließen Esc Kapitel B – Grundleistungen, Allgemei |
| Filter „Regelart“ und Schalter „Nennungen einbeziehen“ ändern die Treffer | ✅ bestanden | 321 von 5.580 Ziffern · ≠ Nicht neben 1.541 | + Nur neben 25 | – Keine Neben-Regel 4.025 |
| CSV-Export Nebeneinander (Filter Nur neben): Kopf + 6 Zeilen | ✅ bestanden | 7 Zeilen; 310;"B";"IV. Berichte, Briefe";"Schreibgebühr, je angefangen |
| Zurück zum Reiter „AB-Steigerungsgründe“: AB-Filter wieder sichtbar, 5.580 Ziffern | ✅ bestanden | 5.580 von 5.580 Ziffern |
| Laptop 1280×720 mit offenem Detailbereich: kein horizontaler Überlauf | ✅ bestanden | kein Überlauf |
| Offline: keine externen Anfragen | ✅ bestanden | keine |
| Keine JavaScript-Fehler | ✅ bestanden | keine |

Screenshots: `output/screenshots/01_startansicht.png`, `output/screenshots/02_gefilterte_ansicht.png`, `output/screenshots/06_tooltip_wortlaut.png`, `output/screenshots/05_nicht_steigerfaehig.png`, `output/screenshots/03_detailbereich.png`, `output/screenshots/07_neben_start.png`, `output/screenshots/08_neben_detail_310.png`, `output/screenshots/04_laptop_1280.png`

## 3. Verifikation des Excel-Aufbaus

- Kopfblock Zeilen 1–11, Tabellenkopf Zeile 12, 1999 Datenzeilen (Ziffer 900 bis 13399).
- 7 Kombinationsmuster: G (55) · B (142) · GBF (1470) · GBSF (235) · BV (58) · GB (37) · GBV (2).
- Kennzeichnung praktisch/theoretisch wurde aus der Zellformatierung gelesen (`font.strike`, Schrift-/Füllfarbe) und je Muster gegen die Spalte „Herleitung“ sowie gegen eine eigene Nachrechnung aller Teilmengen geprüft (theoretisch = Kombination enthält S×F oder B×F, Zelle A8).
- Spalten M und U (Formeln) wurden gegen die Regelspalten H–L nachgerechnet; S gegen Prüfmerkmal Bauchraum, V gegen Prüfmerkmal CT/MRT.

Auffälligkeiten innerhalb der Excel: **keine**.

## 4. Abgleich Steigerungsmatrix ↔ Gebührenverzeichnis (Excel)

Statt einer Stichprobe wurden **alle 1999 Ziffern** gegen das Gebührenverzeichnis geprüft (5580 Nummern, Spalte „Nummer v6“, Gebührenverzeichnis v6, Dateistand 15.07.2026; Stand aus dem Dateinamen abgeleitet).

| Prüfung | Ergebnis |
|---|---|
| Ziffer im Gebührenverzeichnis vorhanden | 1999 von 1999 |
| Gebühr identisch (Matrix Spalte E = Bewertung) | 1999 von 1999 |
| Bezeichnung identisch mit „Legenden“ (ohne Leerraum/Schlusskomma) | 1903 |
| Bezeichnung in der Matrix gekürzt (Anfang der Legende) | 50 |
| Bezeichnung der Matrix = Legende + (Anfang des) Zusatz | 46 |
| Bezeichnung inhaltlich abweichend | 0 |
| Doppelte Nummern im Gebührenverzeichnis | 0 |

Die gekürzten bzw. um den Zusatz ergänzten Bezeichnungen sind redaktionelle Unterschiede der Kurzbezeichnung, keine inhaltlichen Abweichungen. Betroffene Ziffern: 901, 918, 1234, 1313, 1331, 5605, 5606, 5609, 5901, 5903, 5905, 5907, 7201, 7317, 7416, 7418, 7565, 7569, 7570, 7575, 7576, 7709, 7733, 7734, 7902, 7903, 7904, 7917, 7918, 7924, 7925, 7926, 7931, 7932, 7933, 7938, 7939, 7941, 7948, 7949, 7950, 8050, 8051, 8052, 8053, 8054, 8358, 8369, 8539, 8555, 8562, 8727, 8728, 9010, 9020, 9059, 9062, 9071, 9129, 9173, 9529, 9530, 9534, 9550, 9571, 9575, 9613, 9617, 9621, 9622, 9735, 9748, 9822, 9823, 9960, 10118, 10132, 10133, 10344, 10524, 10608, 10683, 10685, 10738, 10912, 10913, 13209, 13216, 13238, 13239, 13257, 13273, 13275, 13329, 13357, 13375.

### Abschnitte der Matrix ↔ Abschnittscodes des Gebührenverzeichnisses

| Kapitel · Abschnitt (Matrix) | Code(s) | Ziffern in der Matrix | Nummern im Gebührenverzeichnis |
|---|---|---|---|
| C · III. Punktionen | 02.03 | 22 | 32 |
| C · VI. Sonographische Leistungen | 02.06 | 78 | 136 |
| D · I. Anästhesieleistungen | 03.01 | 2 | 47 |
| F · III. Invasive Kardiologie | 05.03 | 31 | 86 |
| L · I. Plastische Chirurgie, Oberflächenchirurgie, Replantationschirurgie | 11.01.01 – 11.01.19 (19 Codes) | 204 | 296 |
| L · II. Operative Orthopädie und Traumatologie | 11.02 | 265 | 306 |
| L · III. Arthroskopien | 11.03 | 43 | 56 |
| L · IV. Endoprothetik | 11.04 | 115 | 177 |
| L · V. Neurochirurgie | 11.05 | 75 | 90 |
| L · VI. Wirbelsäulenchirurgie | 11.06 | 44 | 96 |
| L · VII. Mund-, Kiefer-, Gesichtschirurgie | 11.07 | 79 | 141 |
| L · VIII. Halschirurgie | 11.08 | 22 | 40 |
| L · IX. HNO-Chirurgie | 11.09 | 125 | 180 |
| L · X. Thoraxchirurgie | 11.10 | 66 | 116 |
| L · XI. Herzchirurgie | 11.11 | 114 | 138 |
| L · XII. Gefäßchirurgie | 11.12 | 97 | 131 |
| L · XIII. Operative Gynäkologie | 11.13 | 80 | 101 |
| L · XIV. Operative Urologie | 11.14 | 128 | 178 |
| L · XV. Operative Augenheilkunde | 11.15 | 68 | 96 |
| L · XVI. Hernienchirurgie | 11.16 | 25 | 42 |
| L · XVII. Viszeralchirurgie | 11.17 | 113 | 220 |
| L · XVIII. Operative Proktologie | 11.18 | 42 | 62 |
| O · I. Radiologie | 14.01 | 161 | 203 |

Die Matrix enthält je Abschnitt weniger Ziffern als das Gebührenverzeichnis (laut Matrix sind u. a. Zuschläge ausgenommen; C III, D I und O I gelten nur für Teilbereiche). Ob die Auswahl vollständig ist, wurde nicht bewertet – siehe offene Punkte.

### AB-IDs

Das Gebührenverzeichnis enthält nur Nummern, Legenden, Zusätze, leistungsbezogene Abrechnungsbestimmungen, Abschnittscode und Bewertung. **Die Allgemeinen Bestimmungen (Wortlaut der AB-Regeln) sind darin nicht enthalten.** Geprüft werden konnte nur, ob der Abschnittscode vor dem Bindestrich existiert:

| AB-ID | Abschnittscode | im Gebührenverzeichnis | Wortlaut |
|---|---|---|---|
| 02.03-4 | 02.03 | ja (32 Nummern) | nicht enthalten |
| 03.01-6 | 03.01 | ja (47 Nummern) | nicht enthalten |
| 05.03-1 | 05.03 | ja (86 Nummern) | nicht enthalten |
| L-8 | L | kein Abschnittscode (Kapitel-Bestimmung) | nicht enthalten |
| 14.01-10 | 14.01 | ja (203 Nummern) | nicht enthalten |
| 02.06-3 | 02.06 | ja (136 Nummern) | nicht enthalten |
| L-11 | L | kein Abschnittscode (Kapitel-Bestimmung) | nicht enthalten |
| 14.01-11 | 14.01 | ja (203 Nummern) | nicht enthalten |
| L-9 | L | kein Abschnittscode (Kapitel-Bestimmung) | nicht enthalten |
| L-10 | L | kein Abschnittscode (Kapitel-Bestimmung) | nicht enthalten |
| 14.01-12 | 14.01 | ja (203 Nummern) | nicht enthalten |

## 4a. Zuordnungsdatei Ziffer → Kapitel/Abschnitt (alle GO-Ziffern)

Die Zuordnungsdatei enthält **5580 Ziffern**. Davon stehen 1999 in der Steigerungsmatrix; die übrigen **3581 Ziffern** werden im Dashboard als „Nicht durch AB steigerfähig“ geführt (Bezeichnung und Zusatz aus dem Gebührenverzeichnis, Kapitel, Abschnitt, Seite und Gebühr aus der Zuordnungsdatei).

| Prüfung | Ergebnis |
|---|---|
| Nummern identisch mit dem Gebührenverzeichnis | ja |
| Matrixziffern in der Zuordnungsdatei vorhanden | 1999 von 1999 |
| Kapitel/Abschnitt der Matrix = Zuordnungsdatei | 1999 von 1999 |
| Gebühr Matrix = Zuordnungsdatei | 1999 von 1999 |
| Gebühr Zuordnungsdatei = Gebührenverzeichnis | 5579 von 5580 |

- **Abweichung Gebühr** Ziffer 4409: Zuordnungsdatei 38,45 € ≠ Gebührenverzeichnis 38.45589627481 (kaufmännisch gerundet 38,46 €)

Abschnittscodes, die sich zwischen Zuordnungsdatei und Gebührenverzeichnis unterscheiden (nur zur Information, das Dashboard verwendet die Codes nicht):

| Kapitel · Abschnitt | Code Zuordnungsdatei | Code Gebührenverzeichnis | Ziffern |
|---|---|---|---|
| D · Zuschläge für ambulante Anästhesieleistungen | (leer) | 03.001 | 5 |
| L · Zuschläge für ambulantes Operieren | (leer) | 11.001 | 6 |
| L · Zuschläge für Kinder bis zum vollendeten 8. Lebensjahr | (leer) | 11.002 | 3 |

## 4c. Nebeneinanderberechnung („Nicht neben“ / „Nur neben“)

Quelle ist ausschließlich die Spalte „Abrechnungsbestimmung“ des Gebührenverzeichnisses. Der Text wird in Sätze zerlegt; ein Satz mit „neben“ gilt als **Nur neben**, wenn er „nur neben“ enthält, sonst als **Nicht neben**, wenn er eine Verneinung der Berechnungsfähigkeit enthält („nicht … berechnungsfähig“, „nicht neben“, „keine Leistungen … berechnungsfähig“, „ausgeschlossen“). Genannte Ziffern werden aus „Nummer(n) …“-Aufzählungen gelesen, „bis“-Bereiche auf die vorhandenen Ziffern aufgelöst.

| Kennzahl | Wert |
|---|---|
| Ziffern mit Abrechnungsbestimmung | 1949 |
| Ziffern mit „Nicht neben“-Regel | 1051 (1089 Regelsätze) |
| Ziffern mit „Nur neben“-Regel | 6 (6 Regelsätze) |
| Regelsätze im Standardwortlaut (eindeutig, nur Ziffern) | 766 |
| Regelsätze mit Bedingung oder Textbezug (im Dashboard mit ⚑ markiert) | 329 |
| … davon ohne einzelne genannte Ziffer (Bezug nur im Wortlaut) | 162 |
| Genannte Nummern, die es im Gebührenverzeichnis nicht gibt | 0 |
| Sätze mit „neben“, die keiner der beiden Kategorien zugeordnet wurden | 80 |

„Nur neben“-Regeln:

- Ziffer 310: „Die Schreibgebühr ist nur neben der Leistung nach Nummer 306, 307, 308 oder 309 berechnungsfähig.“
- Ziffer 311: „Die Kopiergebühr ist nur neben der Leistung nach Nummer 306, 307, 308 oder 309 berechnungsfähig.“
- Ziffer 500: „Der Zuschlag nach Nummer 500 ist nur neben der Leistung nach Nummer 202 oder 203 sowie Leistungen des Abschnitts B V berechnungsfähig.“
- Ziffer 501: „Der Zuschlag nach Nummer 501 ist nur neben der Leistung nach Nummer 1, 2, 4, 5, 15, 16, 17, 18, 19, 202, 203, 205, 206 oder 207 sowie Leistungen des Abschnitts B V berechnungsfähig.“
- Ziffer 502: „Der Zuschlag nach Nummer 502 ist nur neben der Leistung nach Nummer 1, 2, 4, 5, 15, 16, 17, 18, 19, 202, 203, 205, 206 oder 207 sowie Leistungen des Abschnitts B V berechnungsfähig.“
- Ziffer 13341: „Die Leistung nach Nummer 13341 ist nur neben der Leistung nach Nummer 13340 berechnungsfähig, wenn nicht dieselbe Extremität angiographiert wird.“

<details><summary>Nicht zugeordnete Sätze mit „neben“ (80)</summary>

- Ziffer 116: „Die Leistung nach Nummer 116 ist neben der Leistung nach Nummer 117 berechnungsfähig.“
- Ziffer 117: „Die Leistung nach Nummer 117 ist neben der Leistung nach Nummer 116 berechnungsfähig.“
- Ziffer 122: „Neben der Leistung nach Nummer 122 ist Wegegeld berechnungsfähig.“
- Ziffer 503: „Werden Leistungen an Samstagen, Sonn- oder Feiertagen zwischen 20 und 8 Uhr erbracht, ist neben dem Zuschlag nach Nummer 503 ein Zuschlag nach Nummer 501 oder 502 berechnungsfähig.“
- Ziffer 1292: „Die Leistung nach Nummer 1292 ist neben in gleicher Sitzung erbrachten endoskopischen Leistungen des oberen Gastrointestinaltraktes nur mit medizinischer Begründung berechnungsfähig.“
- Ziffer 1293: „Die Leistung nach Nummer 1293 ist neben in gleicher Sitzung erbrachten endoskopischen Leistungen des oberen Gastrointestinaltraktes nur mit medizinischer Begründung berechnungsfähig.“
- Ziffer 1294: „Die Leistung nach Nummer 1294 ist neben in gleicher Sitzung erbrachten endoskopischen Leistungen des Rektums bzw. Analkanals nur mit medizinischer Begründung berechnungsfähig.“
- Ziffer 1295: „Die Leistung nach Nummer 1295 ist neben in gleicher Sitzung erbrachten endoskopischen Leistungen des Kolons nur mit medizinischer Begründung berechnungsfähig.“
- Ziffer 1320: „Bei gegebener Indikation ist die Leistung nach Nummer 1320 auch neben der Leistung nach Nummer 1318, 1326 oder 1327 berechnungsfähig.“
- Ziffer 1326: „Bei gegebener Indikation ist die Leistung nach Nummer 1326 auch neben der Leistung nach Nummer 1320 oder 1327 berechnungsfähig.“
- Ziffer 1327: „Bei gegebener Indikation ist die Leistung nach Nummer 1327 auch neben der Leistung nach Nummer 1318, 1320 oder 1326 berechnungsfähig.“
- Ziffer 1328: „Die Leistung nach Nummer 1328 ist neben der Nummer 1814 oder 1815 bis zu zweimal berechnungsfähig.“
- Ziffer 2902: „Bei Nebeneinanderberechnung der Leistungen nach den Nummern 2902 und 2903 ist eine medizinische Begründung in der Rechnung anzugeben.“
- Ziffer 3203: „Bei Ansatz der Nummer 3203 neben der Nummer 4966 ist die medizinische Begründung in der Rechnung anzugeben.“
- Ziffer 3242: „Die Kosten für die Sonde sind neben dem Zuschlag nach Nummer 3242 nicht gesondert berechnungsfähig.“
- Ziffer 4010: „Neben der Leistung nach Nummer 4010 sind kurative Leistungen und Leistungen zur Impfberatung nach Nummer 8 und 9 zusätzlich berechnungsfähig.“
- Ziffer 4010: „Die Leistung nach Nummer 4010 umfasst nicht Funktions-, Entwicklungs- oder technische Untersuchungen der Organsysteme; diese sind neben der Leistung nach Nummer 4010 berechnungsfähig.“
- Ziffer 4120: „Bei Nebeneinanderberechnung der Leistungen nach den Nummern 4120 und 4119 ist eine medizinische Begründung in der Rechnung anzugeben.“
- Ziffer 4343: „Bei Nebeneinanderberechnung der Leistungen nach den Nummern 4344 und 4343 ist eine medizinische Begründung in der Rechnung anzugeben.“
- Ziffer 4344: „Bei Nebeneinanderberechnung der Leistungen nach den Nummern 4344 und 4343 ist eine medizinische Begründung in der Rechnung anzugeben.“
- Ziffer 4348: „Neben der Leistung nach Nummer 4348 ist Wegegeld berechnungsfähig.“
- Ziffer 4606: „Der Zuschlag nach Nummer 4606 ist bis zu viermal neben der Leistung nach Nummer 4605 berechnungsfähig.“
- Ziffer 4966: „Bei Ansatz der Nummer 4966 neben der Nummer 3203 ist die medizinische Begründung in der Rechnung anzugeben.“
- Ziffer 6717: „Der Zuschlag nach Nummer 6717 ist bei einem Simultaneingriff neben der Leistung nach Nummer 6715 höchstens sechsmal und neben der Leistung nach Nummer 6716 höchstens achtmal berechnungsfähig.“
- Ziffer 7683: „Neben der Leistung nach Nummer 7683 ist das Herrichten des Transplantatbettes innerhalb der Defektzone nicht gesondert berechnet werden.“
- Ziffer 8573: „Bei einzeitiger dorsoventraler Rekonstruktion sind die Leistungen nach Nummer 8573 und 8574 nebeneinander berechnungsfähig.“
- Ziffer 8574: „Bei einzeitiger dorsoventraler Rekonstruktion sind die Leistungen nach Nummer 8573 und 8574 nebeneinander berechnungsfähig.“
- Ziffer 8576: „Bei einzeitiger dorsoventraler Rekonstruktion sind die Leistungen nach Nummer 8576 und 8577 nebeneinander berechnungsfähig.“
- Ziffer 8577: „Bei einzeitiger dorsoventraler Rekonstruktion sind die Leistungen nach Nummer 8576 und 8577 nebeneinander berechnungsfähig.“
- Ziffer 8712: „Der Zuschlag nach Nummer 8712 ist neben der Leistung nach Nummer 9003 der GOZ für das Einbringen dentaler Implantate berechnungsfähig.“
- Ziffer 8712: „Der Zuschlag nach Nummer 8712 ist neben der Leistung nach Nummer 8739 berechnungsfähig.“
- Ziffer 8804: „Wird der Zuschlag nach Nummer 8804 neben einer Leistung für einen mikrochirurgischen Lappen berechnet, ist nur ein Drittel dieses Zuschlags berechnungsfähig.“
- Ziffer 8811: „Wird die Leistung nach Nummer 8811 neben einer Leistung für einen mikrochirurgischen Lappen berechnet, ist nur ein Drittel dieses Zuschlags berechnungsfähig.“
- Ziffer 9032: „Die Rekonstruktion des N. facialis ist neben der Leistung nach Nummer 9032 gesondert berechnungsfähig.“
- Ziffer 9911: „Gesonderte Zuschläge mit eigenständigem Leistungsinhalt bleiben neben der robotischen Hauptleistung nach Nummer 9911 berechenbar, sofern sie nicht Bestandteil der Sakrokolpopexie/Promontofixation sind.“
- Ziffer 9932: „Die Leistung nach Nummer 9932 ist neben der Leistung nach Nummer 9933 berechnungsfähig.“
- Ziffer 9933: „Die Leistung nach Nummer 9933 ist neben der Leistung nach Nummer 9932 berechnungsfähig.“
- Ziffer 9968: „Gesonderte Zuschläge mit eigenständigem Leistungsinhalt, insbesondere Adnexentfernung oder Netzplombe bleiben neben der robotischen Hauptleistung nach Nummer 9968 berechnungsfähig.“
- Ziffer 10161: „Die Leistung nach Nummer 10161 ist neben der Leistung nach Nummer 10167, 10168, 10169, 10170, 10179 oder 10180 berechnungsfähig.“
- Ziffer 10162: „Die Leistung nach Nummer 10162 ist neben der Leistung nach Nummer 10167, 10168, 10169, 10170, 10179 oder 10180 berechnungsfähig.“
- Ziffer 10164: „Die Leistung nach Nummer 10164 ist neben der Leistung nach Nummer 10167, 10168, 10169, 10170, 10179 oder 10180 berechnungsfähig.“
- Ziffer 10507: „Gesonderte Zuschläge mit eigenständigem Leistungsinhalt, z.B. Komponentenseparation oder Nabelrekonstruktion bleiben neben der robotischen Hauptleistung nach Nummer 10507 berechnungsfähig.“
- Ziffer 10644: „Gesonderte Zuschläge mit eigenständigem Leistungsinhalt bleiben neben der robotischen Hauptleistung nach Nummer 10644 berechnungsfähig, sofern deren Voraussetzungen erfüllt sind.“
- Ziffer 10706: „Gesonderte Zuschläge mit eigenständigem Leistungsinhalt, z.B. Sakrumresektion, radikal-systematische Lymphadenektomie oder erweiterte multiviszerale Resektion bleiben neben der robotischen Hauptleistung nach Nummer 10706 berechnungsfähig.“
- Ziffer 10789: „Gesonderte Zuschläge mit eigenständigem Leistungsinhalt, z.B. milzerhaltende Dissektion oder zusätzliche Lymphadenektomie bleiben bei erfüllten Voraussetzungen neben der robotischen Hauptleistung nach Nummer 10789 berechnungsfähig.“
- Ziffer 11850: „Neben dieser Leistung sind gelegentlich notwendige sofortige Glukosebestimmungen jeweils als Leistung nach Nummer 11065 berechnungsfähig.“
- Ziffer 11854: „Neben der Leistung nach Nummer 11854 sind die notwendigen fortlaufenden kurzfristigen Glukosebestimmungen jeweils als Leistung nach Nummer 11065 berechnungsfähig.“
- Ziffer 12192: „Neben der Leistung nach Nummer 12192 sind bis zu 24 Sequenzierungen nach den Nummern 12196, 12197 oder 12198 berechnungsfähig, soweit diese nach dem Stand der Wissenschaft unabdingbar sind, um die diagnostische Fragestellung erschöpfend zu beantworten.“
- Ziffer 12193: „Neben der Leistung nach Nummer 12193 sind bis zu 24 Sequenzierungen nach den Nummern 12196, 12197 oder 12198 berechnungsfähig, soweit diese nach dem allgemein anerkannten Stand von Wissenschaft und Technik unabdingbar sind, um die diagnostische Fragestellung erschöpfend zu beantworten.“
- Ziffer 12194: „Neben der Leistung nach Nummer 12194 sind bis zu 24 Sequenzierungen nach den Nummern 12196, 12197 oder 12198 berechnungsfähig, soweit diese nach dem allgemein anerkannten Stand von Wissenschaft und Technik unabdingbar sind, um die diagnostische Fragestellung erschöpfend zu beantworten.“
- Ziffer 12241: „Die Leistung nach Nummer 12241 ist neben den Leistungen des Abschnitts M III.05 (Blutgruppen, HLA-System) berechnungsfähig, soweit dieses Vorgehen zur definitiven Blutgruppenbestimmung dem allgemein anerkannten Stand der Wissenschaft und Technik entspricht.“
- Ziffer 12422: „Wird bei der gleichen Reinkultur die Leistung nach Nummer 12422 neben den Leistungen nach den Nummern 12416, 12417, 12418, 12419, 12421, 12423, 12424, 12425 oder 12426 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12424: „Wird bei der gleichen Reinkultur die Leistung nach Nummer 12424 neben den Leistungen nach den Nummern 12416, 12417, 12418, 12419, 12421, 12422, 12423, 12425 oder 12426 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12425: „Wird bei der gleichen Reinkultur die Leistung nach Nummer 12425 neben den Leistungen nach den Nummern 12416, 12417, 12418, 12419, 12421, 12422, 12423, 12424 oder 12426 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12426: „Wird bei der gleichen Reinkultur die Leistung nach Nummer 12426 neben den Leistungen nach den Nummern 12416, 12417, 12418, 12419, 12421, 12422, 12423, 12424 oder 12425 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12434: „Wird bei der gleichen Reinkultur neben der Leistung nach 12434 die Leistung nach Nummer 12435 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12435: „Wird bei der gleichen Reinkultur neben der Leistung nach Nummer 12435 die Leistung nach Nummer 12434 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12509: „Wird neben der Leistung nach Nummer 12509 für den gleichen Parasiten die Leistung nach Nummer 12510 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12510: „Wird neben der Leistung nach Nummer 12510 für den gleichen Parasiten die Leistung nach Nummer 12509 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12524: „Die Leistung nach Nummer 12524 ist neben den Leistungen nach den Nummern 12521 oder 12522 berechnungsfähig, soweit dieses Vorgehen zur definitiven Parasiten- Identifizierung dem allgemein anerkannten Stand der Wissenschaft und Technik entspricht.“
- Ziffer 12564: „Wird bei der gleichen Reinkultur die Leistung nach Nummer 12564 neben den Leistungen nach den Nummern 12561, 12562, 12563, 12565, 12566 oder 12567 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12565: „Wird bei der gleichen Reinkultur die Leistung nach Nummer 12565 neben den Leistungen nach den Nummern 12561, 12562, 12563, 12564, 12566 oder 12567 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12566: „Wird bei der gleichen Reinkultur die Leistung nach Nummer 12566 neben den Leistungen nach den Nummern 12561, 12562, 12563, 12564, 12565 oder 12567 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12567: „Wird bei der gleichen Reinkultur die Leistung nach Nummer 12567 neben den Leistungen nach den Nummern 12561, 12562, 12563, 12564, 12565 oder 12566 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12621: „Neben der Leistung nach Nummer 12621 ist für das gleiche Virus nur noch eine weitere Leistung des Abschnitts M III.13.04.03 berechnungsfähig.“
- Ziffer 12622: „Neben der Leistung nach Nummer 12622 ist für das gleiche Virus nur noch eine weitere Leistung des Abschnitts M III.13.04.03 berechnungsfähig.“
- Ziffer 12623: „Neben der Leistung nach Nummer 12623 ist für das gleiche Virus nur noch eine weitere Leistung des Abschnitts M III.13.04.03 berechnungsfähig.“
- Ziffer 12624: „Neben der Leistung nach Nummer 12624 ist für das gleiche Virus nur noch eine weitere Leistung des Abschnitts M III.13.04.03 berechnungsfähig.“
- Ziffer 12625: „Neben der Leistung nach Nummer 12625 ist für das gleiche Virus nur noch eine weitere Leistung des Abschnitts M III.13.04.03 berechnungsfähig.“
- Ziffer 12632: „Wird neben der Leistung nach Nummer 12632 für die gleiche Reinkultur Leistungen des Abschnitts M III.13.01.06 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12633: „Wird neben der Leistung nach Nummer 12633 für das gleiche Probenmaterial Leistungen des Abschnitts M III.13.01.03 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12634: „Wird neben der Leistung nach Nummer 12634 für die gleiche Reinkultur Leistungen des Abschnitts M III.13.01.06 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12636: „Wird neben der Leistung nach Nummer 12636 für die gleiche Reinkultur Leistungen des Abschnitts M III.13.03.04 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12637: „Wird neben der Leistung nach Nummer 12637 für die gleiche Reinkultur Leistungen des Abschnitts M III.13.01.6 durchgeführt und berechnet, bedarf dieses Vorgehen einer auf den jeweiligen Fall bezogenen medizinischen Begründung.“
- Ziffer 12760: „Wird das Kryoglobulin mittels Proteinbestimmung quantifiziert, so ist neben der Leistung nach Nummer 12760 zusätzlich die Leistung nach Nummer 11064 berechnungsfähig.“
- Ziffer 13022: „Die Leistung nach Nummer 13022 ist neben der Leistung nach Nummer 13015 berechnungsfähig.“
- Ziffer 13102: „Der Zuschlag nach Nummer 13102 ist neben der Leistung nach Nummer 13100 oder 13103 einmal berechnungsfähig.“
- Ziffer 13107: „Die Leistung nach Nummer 13107 ist neben der Leistung nach Nummer 13108, 13109 oder 13110 insgesamt nur einmal berechnungsfähig.“
- Ziffer 13550: „Die Leistung nach Nummer 13550 ist neben der Leistung nach Nummer 13551 nur einmal in einer Sitzung berechnungsfähig.“
- Ziffer 13946: „Neben der Leistung nach Nummer 13946 sind ggf. intensivmedizinische Leistungen berechnungsfähig.“

</details>

## 4b. Abgleich mit dem PDF (Allgemeine Bestimmungen)

Nicht durchgeführt: kein PDF in `input/`. Die PDF-Auswertung im Build-Skript (Suche der AB-IDs mit Seitenzahl, Kapiteltitel) ist vorbereitet, aber mangels Datei nicht erprobt.

## 5. Offene Punkte

1. **Wortlaut der AB-Regeln nicht am Entwurf geprüft:** Der Wortlaut je Steigerungsgrund stammt aus `input/ab_wortlaut.json` (vom Auftraggeber geliefert, unverändert übernommen) und wird im Dashboard beim Überfahren der Grund-Tags und im Detailbereich gezeigt. Es gibt einen Text je Grund, nicht je AB-ID: Ob er für alle 11 AB-IDs (02.03-4, 03.01-6, 05.03-1, L-8, 14.01-10, 02.06-3, L-11, 14.01-11, L-9, L-10, 14.01-12) wortgleich gilt, ist nicht geprüft; Seitenzahlen fehlen. Im Text zu G steht „Xa-lnhibitoren“ mit kleinem L statt großem I (vermutlich Kopierfehler, nicht korrigiert).
2. **Rundungsregel** (Matrix verweist auf Kap. A Nr. 23): im Gebührenverzeichnis nicht enthalten, daher nicht geprüft. Gerechnet wird kaufmännisch auf den Cent (Decimal, ROUND_HALF_UP).
3. **Stand des Entwurfs:** nur aus dem Dateinamen des Gebührenverzeichnisses abgeleitet (v6, 15.07.2026). Bitte bestätigen oder offiziellen Stand nennen.
4. **Vollständigkeit der Matrix:** Die Matrix enthält je Abschnitt weniger Ziffern als das Gebührenverzeichnis (Tabelle in Abschnitt 4). Ob alle steigerungsfähigen Hauptleistungen erfasst sind, ist eine fachliche Frage und wurde nicht geprüft oder korrigiert.
5. **Zusatztext im Detailbereich:** Zur vollständigen Leistungsbezeichnung wird der „Zusatz“ aus dem Gebührenverzeichnis angezeigt (gekennzeichnet). Falls nicht gewünscht, bitte melden.
6. **Ziffer 4409: Gebühr unklar.** Zuordnungsdatei nennt 38,45 €, das Gebührenverzeichnis den ungerundeten Wert 38.45589627481 (gerundet 38,46 €). Das Dashboard zeigt den Wert der Zuordnungsdatei. Bitte klären.
7. **„Nicht durch AB steigerfähig“ ist ein Umkehrschluss:** So gekennzeichnet sind alle Ziffern der Zuordnungsdatei, die nicht in der Steigerungsmatrix stehen. Die Matrix enthält laut eigener Beschreibung nur Hauptleistungen, für die mindestens ein Erhöhungsgrund greift (Zuschläge ausgenommen). Ob diese Auswahl vollständig ist, wurde nicht geprüft.
8. **Nebeneinanderberechnung – Erkennung aus dem Wortlaut:** Die Zuordnung „Nicht neben“/„Nur neben“ ist eine automatische Textauswertung, keine fachliche Prüfung. Regeln mit Bedingung („wenn …“, „an demselben Kalendertag“, „für dasselbe Material“) oder Textbezug („Leistungen des Kapitels B“) sind als „Nicht neben“ geführt und mit ⚑ markiert; der Satz wird immer wörtlich gezeigt.
9. **Nur 6 Ziffern mit „Nur neben“-Regel:** Nur diese enthalten in der Abrechnungsbestimmung „nur neben“. Zuschläge, deren Bindung allein in der Legende steht („Zuschlag zu der Leistung nach Nummer …“), sowie Formulierungen wie „nur in engem zeitlichen Zusammenhang mit …“ sind nicht als „Nur neben“ gewertet. Soll das erweitert werden?
10. **80 Sätze mit „neben“ ohne Zuordnung** (z. B. „ist neben … berechnungsfähig“, „nur mit medizinischer Begründung“, „bis zu zweimal neben …“): im Detailbereich unter „Übrige Abrechnungsbestimmungen“ sichtbar, Liste in Abschnitt 4c. Bitte prüfen, ob daraus weitere Kategorien werden sollen.
11. **Nebeneinanderberechnung – nicht erfasst:** Ausschlüsse aus den Allgemeinen Bestimmungen der Kapitel/Abschnitte liegen nicht vor. Bezüge auf ganze Kapitel oder Abschnitte werden nicht in einzelne Ziffern aufgelöst.
12. **Schalter „Nennungen bei anderen Ziffern einbeziehen“** (Standard: aus): zählt eine Ziffer auch dann als betroffen, wenn sie nur in der Regel einer anderen Ziffer genannt ist. Ob Ausschlüsse fachlich immer wechselseitig gelten, ist nicht entschieden.
13. **Multiplikationsannahme:** Die Excel multipliziert mehrere Gründe; der Entwurf regelt die Kumulation laut Excel-Hinweis nicht ausdrücklich. Das Dashboard übernimmt die Annahme und weist sie in der Hinweisleiste und im Szenario aus. Fachliche Bestätigung steht aus.
14. **Mehrfachauswahl der Grund-Chips:** umgesetzt als UND-Verknüpfung (Ziffer muss alle gewählten Gründe haben). Falls ODER gewünscht ist, bitte melden.
15. **Schalter „Theoretische Kombinationen einbeziehen“:** umgesetzt so, dass max. Faktor, max. Gebührensatz, Faktorfilter und CSV dann den theoretischen Höchstwert verwenden. Bitte bestätigen.
16. **Prüfmerkmale Bauchraum und CT/MRT** sind laut Excel per Stichwort vorbelegt („Indiz“). Das Dashboard übernimmt die Vorbelegung unverändert und zeigt sie im Detailbereich an; eine fachliche Prüfung der Vorbelegung ist nicht Teil dieses Builds.

## 6. Reproduktion

```bash
python3 build/build.py --ui
```
