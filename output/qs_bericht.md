# QS-Bericht – GOÄneu Steigerungsdashboard

- Quelle Zuordnungen: `input/GO__2028_AB_Steigerungsmatrix.xlsx`, Blatt „Steigerungsmatrix“
- Gebührenverzeichnis des Entwurfs (Excel): `input/gesetz/Gebuehrenverzeichnis_v6_20260715.xlsx`
- Zuordnung Ziffer → Kapitel/Abschnitt (JSON): `input/kapitel/GOAeneu_Ziffer_zu_Kapitel.json`
- Kombinationsregeln (Nebeneinanderberechnung): `input/neben/` (regeln.json, ziffer_index.json, weitere_ausschluesse.csv)
- Mapping alte GOÄ → GOÄneu: `input/mapping/` und `input/goae_alt/`
- Gesetzesentwurf mit Allgemeinen Bestimmungen (PDF): **lag beim Build nicht vor**
- Abnahmetests Daten: **38 von 38 bestanden**

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
| Nebeneinander – 2.539 Regeln, Typen wie in der README (1.106 / 1.343 / 52 / 29 / 2 / 4 / 3) | ✅ bestanden | 2539 Regeln; NICHT_NEBEN 1106 · NUR_NEBEN 1343 · NEBEN_ERLAUBT 52 · NEBEN_MIT_BEGRUENDUNG 29 · AUSLEGUNGSREGEL 4 · NEBEN_MIT_ABSCHLAG 2 · SONDERFALL 3 |
| Nebeneinander – Ziffer 1: nicht neben 2 | ✅ bestanden | [2] |
| Nebeneinander – Ziffer 310: nur neben 306, 307, 308, 309 | ✅ bestanden | [306, 307, 308, 309] |
| Nebeneinander – Ziffer 1200: nicht neben 1225, 1228 und laut Abschnitt-AB 4600, 4602, 4603, 4611, 4718, 4719, 4725, 4727, 4728, 4729 | ✅ bestanden | [1225, 1228, 4600, 4602, 4603, 4611, 4718, 4719, 4725, 4727, 4728, 4729] |
| Nebeneinander – Ziffer 4525: nur neben 4500, 4501, 4503, 4505, 4506, 4508, 4510, 4511, 4513, 4515, 4518, 4520, 4523 | ✅ bestanden | [4500, 4501, 4503, 4505, 4506, 4508, 4510, 4511, 4513, 4515, 4518, 4520, 4523] |
| Nebeneinander – Ziffer 1215: nur neben 1205/1208/1211/1212 und nicht neben 1214, 1333, 1334, 1335 | ✅ bestanden | nur neben [1205, 1208, 1211, 1212]; nicht neben [1214, 1333, 1334, 1335] |
| Nebeneinander – alle in Regeln genannten Ziffern existieren | ✅ bestanden | 0 unbekannt |
| Nebeneinander – Zuordnung je Ziffer stimmt mit ziffer_index.json überein | ✅ bestanden | 0 Abweichungen |
| Nebeneinander – jede Ziffer, deren Bezeichnung mit „Zuschlag“ beginnt, hat eine „Nur neben“-Regel | ✅ bestanden | 1325 Zuschlagsziffern, 0 ohne Regel |
| Intervalle – 25 Intervalle (8 bestehend, 17 neu), jedes mit Erkennungsmuster | ✅ bestanden | 25 Intervalle; bestehend 8 · neu 17 |
| Intervalle – Stichprobe aus der Vorgabe (21 Ziffer-Intervall-Paare, z. B. 1022 Mindestabstand, 4444 Kalendermonat, 13802 Krankheitsfall und Woche) | ✅ bestanden | alle gefunden |
| Intervalle – Beispielziffern der Vorgabe gefunden (7 ungerade Ziffern 2705–2717 je zweimal ohne passenden Wortlaut) | ✅ bestanden | 61 von 75 gefunden |
| Mapping – 2.831 alte Ziffern, Status wie in der README (522 / 884 / 829 / 535 / 61) | ✅ bestanden | 2831 Ziffern; SICHER 522 · PLAUSIBEL 884 · UNSICHER 829 · KEINE_ENTSPRECHUNG_ERKENNBAR 535 · SAMMELPOSITION 61 |
| Mapping – alt 863 → neu 4500, Wahrscheinlichkeit 0,82, SICHER | ✅ bestanden | [4500] · 0.82 · SICHER |
| Mapping – alt 861 → 4505; alt 862 → 4506–4509; alt 864 → 4501–4504 | ✅ bestanden | [4505] · [4506, 4507, 4508, 4509] · [4501, 4502, 4503, 4504] |
| Mapping – Nutzervorgabe geht vor: alt 870 → 4510, 4515; alt 871 → 4511–4514, 4516–4519 | ✅ bestanden | [4510, 4515] · [4511, 4512, 4513, 4514, 4516, 4517, 4518, 4519] |
| Mapping – Rückrichtung: neu 4500 ← alt 863 (und 808); alt 4500 ist eine andere Leistung (Nummernkollision) | ✅ bestanden | neu 4500 ← ['808', '863']; alt 4500 = Betahämolysierende Streptokokken Typ B |
| Mapping – alle zugeordneten neuen Ziffern existieren; jede alte Ziffer hat eine Begründung | ✅ bestanden | 0 unbekannt |
| Mapping – alte Ziffern mit Betrag in der alten GOÄ (PDF) wiedergefunden (mindestens 98 %) | ✅ bestanden | 2371 von 2371 (100.0%) |
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
| Suche geleert: wieder alle 5.580 Ziffern, alle Abschnitte eingeklappt | ✅ bestanden | 5.580 von 5.580 Ziffern, 0 Zeilen offen |
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
| Reiter „Nebeneinanderberechnung“: Chips Nicht neben 1.051 · Nur neben 1.337 · Keine Neben-Regel 3.525 | ✅ bestanden | ≠ Nicht neben 1.051 | + Nur neben 1.337 | – Keine Neben-Regel 3.525 |
| Ziffer 310: „Nur neben“ mit Wortlaut und Ziffern 306, 307, 308, 309 | ✅ bestanden | 306,307,308,309 · GOAeneu_Steigerungsdashboard.html#neben/310 |
| Klick auf genannte Ziffer 306 öffnet diese und zeigt „In Regeln anderer Ziffern genannt“ (310, 311) | ✅ bestanden | Ziffer 306 Schließen Esc Kapitel B – Grundleistungen, Allgemeinmedizin · IV. Berichte, Bri |
| Direktlink #neben/1200: nicht neben 1225, 1228 sowie laut Abschnitts-AB 4600 … 4729, Quelle mit AB-ID und Seite | ✅ bestanden | 1225,1228,4600,4602,4603,4611,4718,4719,4725,4727,4728,4729 |
| Ziffer 1215: nur neben 1205, 1208, 1211, 1212 und nicht neben 1214, 1333, 1334, 1335 | ✅ bestanden | nur neben 1205,1208,1211,1212 · nicht neben 1214,1333,1334,1335 |
| Ziffer 4525: nur neben 13 Ziffern (4500 … 4523), „mindestens eine von“ | ✅ bestanden | 4500,4501,4503,4505,4506,4508,4510,4511,4513,4515,4518,4520,4523 |
| Filter „Regelart“ (Allgemeine Bestimmungen) und Schalter „Nennungen einbeziehen“ ändern die Treffer | ✅ bestanden | 19 von 5.580 Ziffern · ≠ Nicht neben 1.553 | + Nur neben 2.593 | – Keine Neben-Regel 2.282 |
| Schaltfläche „Allgemeine Bestimmungen (39)“ listet die 39 AB-Regeln, u. a. A-8 Sitzungsbezug | ✅ bestanden | 39 Regeln |
| CSV-Export Nebeneinander (Suche „schreibgebühr“, Nur neben): Kopf + 1 Zeile mit 306, 307, 308, 309 | ✅ bestanden | 2 Zeilen; 310;"B";"IV. Berichte, Briefe";"Schreibgebühr, je angefangen |
| Zurück zum Reiter „AB-Steigerungsgründe“: AB-Filter wieder sichtbar, 5.580 Ziffern | ✅ bestanden | 5.580 von 5.580 Ziffern |
| Reiter „Intervalle“: Chips Bestehend / Neu / Kein Intervall, Auswahlfeld mit 25 Intervallen in 10 Cluster-Gruppen | ✅ bestanden | B Bestehend 687 | N Neu 109 | – Kein Intervall 4.849 · 10 Gruppen |
| Intervall „Rollierende drei Kalendermonate“: 119, 120, 305, 1800, 1801, 4405 – Infotext mit Hinweis „etwas anderes als das feste Quartal“ | ✅ bestanden | 119,120,305,1800,1801,4405 |
| Ziffer 1800: neu „Rollierende drei Kalendermonate“ und „Rollierende 24 Stunden“ mit Wortlaut, Direktlink #intervalle/1800 | ✅ bestanden | intervalle/1800 |
| Intervall ohne Wortlaut („Jahr (taggenau 365 Tage)“): 0 Ziffern, Hinweis im Infotext | ✅ bestanden | 0 von 5.580 Ziffern |
| Direktlink #intervalle/1017: kombiniertes Limit „Kalendertag und Behandlungsfall“, Häufigkeit „bis zu viermal; bis zu 15 Mal“ | ✅ bestanden | Ziffer 1017 Schließen Esc Kapitel C – Nichtgebietsbezogene Sonderleist |
| CSV-Export Intervalle (Kalendermonat): Kopf + 2 Zeilen (208, 4444) | ✅ bestanden | 3 Zeilen; 208, 4444 |
| Zurück zu „AB-Steigerungsgründe“ nach Intervalle: 5.580 Ziffern, Intervall-Filter ausgeblendet | ✅ bestanden | 5.580 von 5.580 Ziffern |
| Reiter „Ziffern-Mapping“: 2.831 alte Ziffern, Chips Sicher 522 · Plausibel 884 · Unsicher 829 · Keine Entsprechung 535 · Sammelposition 61 | ✅ bestanden | S Sicher 522 | P Plausibel 884 | U Unsicher 829 | K Keine Entsprechung 535 | X Sammelposition 61 · 2.831 von 2.831 alten Ziffern |
| Navigation zeigt die Kapitel der alten GOÄ (B bis P) mit Titel aus dem PDF | ✅ bestanden | 15 Kapitel; G Neurologie, Psychiatrie und Psychotherapie 44 | M Laboratoriumsuntersuchungen 921 |
| Suche „863“: alte 863 → neue 4500, Wahrscheinlichkeit 82 %, Status Sicher, Begründung, Direktlink #mapping/alt/863 | ✅ bestanden | Alte GOÄ · Ziffer 863 Schließen Esc Heutige GOÄ (Stand August 2013) · Kapitel G  … mapping/alt/863 |
| Suche „4500“ (Richtung alt → neu): findet die alte 863 über die neue 4500 und die alte 4500 (Labor); Hinweis auf Nummernkollision | ✅ bestanden | 808,863,4500 |
| Richtung neu → alt, Suche „4500“: neue 4500 ← alte 863 mit Wahrscheinlichkeit und Begründung, Direktlink #mapping/neu/4500 | ✅ bestanden | GOÄneu · Ziffer 4500 Schließen Esc Kapitel G – Neurologische, psychiat … mapping/neu/4500 |
| Klick auf „Alt 863“ wechselt die Richtung und öffnet die alte Ziffer | ✅ bestanden | Alte GOÄ · Ziffer 863 |
| Direktlink #mapping/alt/870: Nutzervorgabe 4510 und 4515, 4515 ohne automatische Wahrscheinlichkeit | ✅ bestanden | Alte GOÄ · Ziffer 870 Schließen Esc Heutige GOÄ (Stand August 2013) · Kapitel G  |
| Filter Sicher + Quelle „manuell geprüft“ und CSV-Export mit Wahrscheinlichkeit und Begründung | ✅ bestanden | 65 von 2.831 alten Ziffern · 66 CSV-Zeilen |
| Zurück zu „AB-Steigerungsgründe“ nach Mapping: wieder neue Ziffern (5.580), Navigation mit 17 Kapiteln | ✅ bestanden | 5.580 von 5.580 Ziffern |
| Laptop 1280×720 mit offenem Detailbereich: kein horizontaler Überlauf | ✅ bestanden | kein Überlauf |
| Offline: keine externen Anfragen | ✅ bestanden | keine |
| Keine JavaScript-Fehler | ✅ bestanden | keine |

Screenshots: `output/screenshots/01_startansicht.png`, `output/screenshots/02_gefilterte_ansicht.png`, `output/screenshots/06_tooltip_wortlaut.png`, `output/screenshots/05_nicht_steigerfaehig.png`, `output/screenshots/03_detailbereich.png`, `output/screenshots/07_neben_start.png`, `output/screenshots/08_neben_detail_1200.png`, `output/screenshots/09_neben_allgemeine_bestimmungen.png`, `output/screenshots/10_intervalle_start.png`, `output/screenshots/11_intervalle_detail.png`, `output/screenshots/12_mapping_start.png`, `output/screenshots/13_mapping_863.png`, `output/screenshots/14_mapping_neu_4500.png`, `output/screenshots/04_laptop_1280.png`

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

Der Reiter beruht **ausschließlich** auf dem gelieferten Paket `input/neben/` (`regeln.json`, `ziffer_index.json`, `weitere_ausschluesse.csv`, Beschreibung in `README.md`). Die frühere eigene Textauswertung der Spalte „Abrechnungsbestimmung“ ist entfernt. Das Build-Skript leitet keine Regeln ab, es ordnet sie nur den Ziffern zu: Eine Regel steht bei jeder ihrer Subjekt-Ziffern; ist das Subjekt nur als Text beschrieben, bei der Ziffer, in deren Text sie steht.

| Kennzahl | Wert |
|---|---|
| Regeln gesamt | 2539 |
| … Typ NICHT_NEBEN | 1106 |
| … Typ NUR_NEBEN | 1343 |
| … Typ NEBEN_ERLAUBT | 52 |
| … Typ NEBEN_MIT_BEGRUENDUNG | 29 |
| … Typ AUSLEGUNGSREGEL | 4 |
| … Typ NEBEN_MIT_ABSCHLAG | 2 |
| … Typ SONDERFALL | 3 |
| … Ebene Ziffer | 2500 |
| … Ebene Paragraphenteil | 1 |
| … Ebene Übergeordnet (Kapitel A) | 5 |
| … Ebene Kapitel | 10 |
| … Ebene Abschnitt | 23 |
| Ziffern mit „Nicht neben“-Regel | 1051 |
| Ziffern mit „Nur neben“-Regel | 1337 |
| Ziffern ohne beide Regeln | 3525 |
| Regeln mit Bedingung (Feld `bedingung`) | 396 |
| Regeln ohne einzelne Ziel-Ziffer (nur Abschnitt/Kapitel/Freitext) | 338 |
| Weitere Ausschluss-Sätze ohne „neben“ (nur im Detailbereich) | 168 |
| Genannte Ziffern, die es nicht gibt | 0 |
| Abweichungen zwischen eigener Zuordnung und `ziffer_index.json` | 0 |


## 4e. Mapping alte GOÄ → GOÄneu

Der Reiter beruht auf dem gelieferten Paket `input/mapping/` (`mapping_alt_zu_neu.json` und `.csv`, Beschreibung in `README.md`). Wahrscheinlichkeit, Status, Verhältnis und Bemerkung sind unverändert übernommen. Maßgeblich ist die Spalte `neu_ziffern_final` (Nutzervorgabe vor automatischem Vorschlag). Die Rückrichtung neu → alt wird daraus abgeleitet. Die Begründung im Dashboard ist die Bemerkung des Pakets, ergänzt um Quelle, Score und die Bedeutung des Status laut README; eine eigene fachliche Bewertung enthält sie nicht.

| Kennzahl | Wert |
|---|---|
| Alte Ziffern | 2831 |
| … Status SICHER | 522 |
| … Status PLAUSIBEL | 884 |
| … Status UNSICHER | 829 |
| … Status KEINE_ENTSPRECHUNG_ERKENNBAR | 535 |
| … Status SAMMELPOSITION | 61 |
| … davon mit Nutzervorgabe | 6 (861, 862, 863, 864, 870, 871) |
| … ohne zugeordnete neue Ziffer | 5 |
| Neue Ziffern mit mindestens einer alten Ziffer | 1810 von 5580 |
| Zugeordnete neue Ziffern, die es nicht gibt | 0 |
| Alte Ziffern ohne Betrag (1,0-fach) | 460 |
| Alte GOÄ (PDF `input/goae_alt/Aktuelle_GOAe.pdf`, Stand August 2013) | 44 Seiten; Kapitelüberschriften übernommen: 16 |
| Alte Ziffern mit Betrag, deren Nummer und 1,0-fach-Betrag im PDF-Text vorkommen | 2371 von 2371 |


## 4d. Intervalle

Die Systematik (bestehend/neu, Cluster, Beispielziffern) steht in `input/intervalle.json` und entspricht der Vorgabe. Die Zuordnung der Ziffern erfolgt über Textmuster im Gebührenverzeichnis: in jedem Satz der Abrechnungsbestimmung, bei eindeutigen Formulierungen („je Sitzung“, „je Kalendertag“ …) auch in Legende und Zusatz. Jeder Treffer wird im Dashboard mit Wortlaut und Quelle gezeigt.

Ziffern mit mindestens einem Intervall: **731** von 5580.

| Status | Cluster | Intervall | Ziffern |
|---|---|---|---|
| bestehend | 1: Sitzung und Tag | Sitzung | 563 |
| bestehend | 1: Sitzung und Tag | Behandlungstag / Kalendertag | 75 |
| bestehend | 2: Feste Kalenderzeiträume | Kalenderjahr | 20 |
| bestehend | 2: Feste Kalenderzeiträume | Kalender-Halbjahr | 18 |
| bestehend | 2: Feste Kalenderzeiträume | Quartal | 2 |
| bestehend | 3: Rollierende Zeiträume ab Leistungsdatum | Jahr (taggenau 365 Tage) | 0 |
| bestehend | 3: Rollierende Zeiträume ab Leistungsdatum | Monat (taggenau 30 Tage) | 0 |
| bestehend | 4: Fallbezogene Zeiträume | Behandlungsfall (selber Arzt, selbe Diagnose) | 57 |
| neu | 1: Sitzung und Tag | Mindestabstand am selben Tag | 2 |
| neu | 1: Sitzung und Tag | Rollierende 24 Stunden | 10 |
| neu | 2: Feste Kalenderzeiträume | Kalenderwoche | 9 |
| neu | 2: Feste Kalenderzeiträume | Kalendermonat | 2 |
| neu | 3: Rollierende Zeiträume ab Leistungsdatum | Rollierende 7 Tage | 1 |
| neu | 3: Rollierende Zeiträume ab Leistungsdatum | Rollierende drei Kalendermonate | 6 |
| neu | 3: Rollierende Zeiträume ab Leistungsdatum | Rollierende sechs Monate mit Mengenstaffel | 2 |
| neu | 4: Fallbezogene Zeiträume | Krankheitsfall | 7 |
| neu | 4: Fallbezogene Zeiträume | Behandlungsfall (geänderte Definition) | 57 |
| neu | 5: Kombinierte Limits | Kalendertag und Behandlungsfall | 6 |
| neu | 5: Kombinierte Limits | Krankheitsfall und Kalenderhalbjahr | 2 |
| neu | 5: Kombinierte Limits | Krankheitsfall und Woche | 1 |
| neu | 5: Kombinierte Limits | Zählgrenze im Kalenderhalbjahr | 2 |
| neu | 6: Bezug zu anderen Leistungen oder Ereignissen | Mindestabstand zu einer Vorgängerziffer | 9 |
| neu | 6: Bezug zu anderen Leistungen oder Ereignissen | Zeitfenster ab Ereignis | 1 |
| neu | 6: Bezug zu anderen Leistungen oder Ereignissen | Mindestanzahl Kontakte im Zeitraum | 1 |
| neu | 6: Bezug zu anderen Leistungen oder Ereignissen | Behandlungszyklus, Zyklus oder Versuch | 11 |

Beispielziffern der Vorgabe ohne passenden Wortlaut im Gebührenverzeichnis:

- Kalenderwoche: 2705, 2707, 2709, 2711, 2713, 2715, 2717
- Mindestabstand zu einer Vorgängerziffer: 2705, 2707, 2709, 2711, 2713, 2715, 2717

Sätze der Abrechnungsbestimmung mit Zeitangabe, die keinem Intervall zugeordnet wurden (5):

- Ziffer 206: „Im Zusammenhang mit dem Beistand bei einer Geburt darf die Verweilgebühr nur für ein nach Ablauf von zwei Stunden notwendiges weiteres Verweilen berechnet werden.“
- Ziffer 1007: „Die Ablesung des Testergebnisses, auch an darauffolgenden Tagen, ist nicht gesondert berechnungsfähig.“
- Ziffer 4308: „Eine EEG-gestützte Narkoseüberwachung ist nach dieser Leistung nicht berechnungsfähig, auch wenn die Dauer mehr als 18 Stunden beträgt.“
- Ziffer 4309: „Eine EEG-gestützte Narkoseüberwachung ist nach dieser Leistung nicht berechnungsfähig, auch wenn die Dauer mehr als 18 Stunden beträgt.“
- Ziffer 12457: „Kosten für Versuchstiere sind nicht gesondert berechnungsfähig.“

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
8. **Nebeneinander – zwei Tags:** Eigene Tags gibt es nur für „Nicht neben“ und „Nur neben“. Die Typen „neben erlaubt“, „neben mit Begründung“ und „neben mit Abschlag“ stehen im Detailbereich und sind über den Filter „Regelart“ erreichbar. Falls eigene Tags gewünscht sind, bitte melden.
9. **Nebeneinander – Gegenrichtung:** Laut README ist „umgekehrt abgeleitet“ eine Ableitung, kein Gesetzeswortlaut. Sie wird nur mit dem Schalter „Nennungen bei anderen Ziffern einbeziehen“ (Standard: aus) mitgezählt und steht im Detailbereich getrennt unter „In Regeln anderer Ziffern genannt“. Ob sie rechtlich gilt, ist fachlich zu bewerten.
10. **Nebeneinander – Regeln ohne einzelne Ziffern:** Regeln aus Allgemeinen Bestimmungen, deren Subjekt ein ganzes Kapitel, ein Abschnitt oder Freitext ist (z. B. Inklusionslisten, Zuschläge zu Abschnitten mit Gebührengrenze), werden nicht in einzelne Ziffern aufgelöst. Sie erscheinen im Detailbereich unter „Allgemeine Bestimmungen des Kapitels“ und in der Gesamtliste „Regeln aus Allgemeinen Bestimmungen“.
11. **Nebeneinander – Bedingungen** sind laut README im Wortlaut übernommen, nicht ausgewertet. Das Dashboard markiert solche Regeln mit ⚑ und zeigt die Bedingung an.
12. **Nebeneinander – Sitzungsbezug (Kapitel A Nr. 8):** Ausschlüsse beziehen sich auf dieselbe Sitzung; steht als Hinweis über der Liste, wird aber nicht je Regel ausgewertet.
13. **Mapping – Wahrscheinlichkeit ist eine Schätzung** (Textähnlichkeit, kalibriert an 104 Stichproben; laut README im Labor zuverlässiger, in der Chirurgie und bei Zuschlägen schwächer). Manuell geprüft sind nur die alten Abschnitte B und G. Auch „SICHER“ ist nicht fehlerfrei.
14. **Mapping – 812/812a (Kurzzeittherapie):** Laut README ist 812 in der Kurz-GOÄ die „Psychiatrische Notfallbehandlung“ (→ 4422, 4423), 812a existiert dort nicht. Die Vorgabe „812/812a → 4500 bis 4519“ ist deshalb nicht übernommen. Bitte klären, welche alte Nummer gemeint ist.
15. **Mapping – 870 und 871:** Die Systemische Therapie (4515 bzw. 4516 bis 4519) stammt aus der Nutzervorgabe und hat keine automatische Wahrscheinlichkeit; im Dashboard als „Nutzervorgabe“ gekennzeichnet.
16. **Mapping – Nummernkollision:** Alte und neue GOÄ verwenden teils dieselbe Nummer für verschiedene Leistungen (alt 4500 = Labor, neu 4500 = Analytische Psychotherapie). Die Suche zeigt deshalb beide Richtungen und kennzeichnet sie.
17. **Mapping – nicht enthalten:** die alten Zuschläge A bis K und die Allgemeinen Bestimmungen der alten GOÄ. Das PDF dient nur für Kapitelüberschriften und die Gegenprobe der Beträge.
18. **Intervalle – Erkennung aus dem Wortlaut:** Die Zuordnung Ziffer → Intervall ist eine Textauswertung des Gebührenverzeichnisses, keine fachliche Prüfung. Bei „Sitzung“ zählt jede Nennung in der Abrechnungsbestimmung, auch wenn sie Teil einer Nicht-neben-Regel ist („in gleicher Sitzung …“).
19. **Intervalle – Kalenderwoche und Mindestabstand zur Vorgängerziffer:** Die Vorgabe nennt „2702, 2704 bis 2718“ bzw. „2702 bis 2718“. Den Wortlaut („frühestens fünf Tage nach … einmal je Kalenderwoche“) haben nur 2702 und die geraden Ziffern 2704 bis 2718; die ungeraden 2705 bis 2717 sind die Vorgängerziffern („einmal zu Beginn der Behandlung“) und wurden nicht zugeordnet. Bitte bestätigen.
20. **Intervalle – Hyperfraktionierung (Mindestabstand 6 Stunden):** im Gebührenverzeichnis nicht gefunden; vermutlich in den Allgemeinen Bestimmungen, die nicht vorliegen. Unter „Mindestabstand am selben Tag“ stehen daher nur 1022 und 1023.
21. **Intervalle – Jahr (365 Tage) und Monat (30 Tage):** Im Gebührenverzeichnis gibt es dafür keinen Wortlaut; beide Intervalle haben 0 Ziffern. Ob sie in der neuen GOÄ entfallen, ist fachlich zu bewerten.
22. **Intervalle – Behandlungsfall:** Ziffern mit „Behandlungsfall“ stehen sowohl unter dem bestehenden Intervall als auch unter „Behandlungsfall (geänderte Definition)“, weil die bestehende Prüfung auf die neue Definition umzustellen ist. Falls sie nur unter einem der beiden erscheinen sollen, bitte melden.
23. **Intervalle – fallbezogene Definitionen (AB A Nr. 5 und Nr. 6)** und alle Intervall-Regeln aus Allgemeinen Bestimmungen sind nicht ausgewertet; die Beschreibungen stammen aus der Vorgabe.
24. **Multiplikationsannahme:** Die Excel multipliziert mehrere Gründe; der Entwurf regelt die Kumulation laut Excel-Hinweis nicht ausdrücklich. Das Dashboard übernimmt die Annahme und weist sie in der Hinweisleiste und im Szenario aus. Fachliche Bestätigung steht aus.
25. **Mehrfachauswahl der Grund-Chips:** umgesetzt als UND-Verknüpfung (Ziffer muss alle gewählten Gründe haben). Falls ODER gewünscht ist, bitte melden.
26. **Schalter „Theoretische Kombinationen einbeziehen“:** umgesetzt so, dass max. Faktor, max. Gebührensatz, Faktorfilter und CSV dann den theoretischen Höchstwert verwenden. Bitte bestätigen.
27. **Prüfmerkmale Bauchraum und CT/MRT** sind laut Excel per Stichwort vorbelegt („Indiz“). Das Dashboard übernimmt die Vorbelegung unverändert und zeigt sie im Detailbereich an; eine fachliche Prüfung der Vorbelegung ist nicht Teil dieses Builds.

## 6. Reproduktion

```bash
python3 build/build.py --ui
```
