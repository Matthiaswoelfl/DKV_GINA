# QS-Bericht – GOÄneu Steigerungsdashboard

- Quelle Zuordnungen: `input/GO__2028_AB_Steigerungsmatrix.xlsx`, Blatt „Steigerungsmatrix“
- Gebührenverzeichnis des Entwurfs (Excel): `input/gesetz/Gebuehrenverzeichnis_v6_20260715.xlsx`
- Zuordnung Ziffer → Kapitel/Abschnitt (JSON): `input/kapitel/GOAeneu_Ziffer_zu_Kapitel.json`
- Gesetzesentwurf mit Allgemeinen Bestimmungen (PDF): **lag beim Build nicht vor**
- Abnahmetests Daten: **17 von 17 bestanden**

## 1. Abnahmetests (Daten)

| Test | Ergebnis | Ist-Wert |
|---|---|---|
| Durch AB steigerfähige Ziffern (Matrix) = 1.999 | ✅ bestanden | 1999 |
| Dashboard enthält alle Ziffern der Zuordnungsdatei (5.580) ohne Duplikate | ✅ bestanden | 5580 Zeilen, 5580 eindeutig |
| Nicht durch AB steigerfähig = Gesamt − Matrix (3.581) | ✅ bestanden | 3581 |
| Alle Matrixziffern in der Zuordnungsdatei, Kapitel/Abschnitt identisch | ✅ bestanden | 0 fehlend, 0 abweichend |
| Ziffer 4500: Kapitel G, III. Psychotherapieverfahren …, 145,00 €, nicht durch AB steigerfähig | ✅ bestanden | Kapitel G · III. Psychotherapieverfahren, -methoden und -techniken · 145,00 € · kein Steigerungsgrund |
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
| Virtualisierung: weniger als 80 Zeilen im DOM | ✅ bestanden | 24 Elemente |
| Faktorfilter zeigt Verteilung 142 / 55 / 58 / 37 / 1.470 / 2 / 235 | ✅ bestanden | keine AB-Steigerung (3.581) ×1,5 (142) ×2,0 (55) ×2,25 (58) ×3,0 (37) ×4,0 (1.470) ×4,5 (2) ×6,0 (235) |
| Startansicht: alle Abschnitte eingeklappt | ✅ bestanden | 24 eingeklappt, 0 Zeilen |
| Klick auf Abschnitt klappt auf (B I, erste Ziffer 1) | ✅ bestanden | 1 |
| Suche „1200“ + Enter öffnet Ziffer 1200: 21,00 €, B ×1,5, max. 31,50 € | ✅ bestanden | Ziffer 1200 Schließen Esc Kapitel C – Nichtgebietsbezogene Sonderleistungen · VI. Sonographische Leistungen · Seite 92 Sonographische (Teil-)Untersuchung mit Be |
| URL-Hash gesetzt (#1200) | ✅ bestanden | GOAeneu_Steigerungsdashboard.html#1200 |
| Filter Chips G + S: 235 Ziffern | ✅ bestanden | 235 von 5.580 Ziffern |
| Schalter „theoretisch“: Faktorfilter nennt theoretische Höchstwerte (×6,0 → 1.470, ×12,0 → 235) | ✅ bestanden | keine AB-Steigerung (3.581) ×1,5 (142) ×2,0 (55) ×2,25 (58) ×3,0 (37) ×4,5 (2) ×6,0 (1.470) ×12,0 (235) |
| Chip „Nicht durch AB steigerfähig“: 3.581 Ziffern | ✅ bestanden | 3.581 von 5.580 Ziffern |
| Ziffer 4500 (PSY): Kapitel G, 145,00 €, „Nicht durch AB steigerfähig“, kein Szenario | ✅ bestanden | Ziffer 4500 Schließen Esc Kapitel G – Neurologische, psychiatrische, psychotherapeutische und psychosomatische Leistungen · III. Psychotherapieverfahren, -methoden und -techniken · Seite 256 Analytische Psychotherapie, E |
| Direktlink #5600: 43,46 €, praktisch ×4,0 = 173,84 €, theoretisch ×6,0 = 260,76 € | ✅ bestanden | Ziffer 5600 Schließen Esc Kapitel L – Chirurgie · I. Plastische Chirurgie, Oberflächenchirurgie, Replantationschirurgie · Seite 323 Exzision eines kleinen kutanen Prozesses (Tumor, entzündlicher Proze |
| Ziffer 5600: Tabelle der Möglichkeiten | ✅ bestanden | p:×1,5:65,19 € p:×2,0:86,92 € p:×3,0:130,38 € p:×4,0:173,84 € t:×6,0:260,76 € |
| Szenario 5600 G+F: ×4,0 = 173,84 € (praktisch) | ✅ bestanden | G×F · Faktor ×4,0 173,84 € |
| Szenario 5600 G+B+F: ×6,0 = 260,76 €, als nur theoretisch markiert | ✅ bestanden | G×B×F · Faktor ×6,0 260,76 € / ✗ Nur theoretisch möglich – diese Kombin |
| Direktlink #900: 27,49 €, nur G ×2,0, max. 54,98 € | ✅ bestanden | Ziffer 900 Schließen Esc Kapitel C – Nichtgebietsbezogene Sonderleistungen · III. Punktionen · Seite 72 Punktion eines der folgenden Gelenke: Grund-, Mittel- od |
| Tastatur: von Ziffer 900 aus Pfeil ab, Pfeil ab, Enter öffnet Ziffer 902 | ✅ bestanden | Ziffer 902 |
| CSV-Export (Filter V): Kopf + 60 Zeilen, deutsche Dezimalzahlen | ✅ bestanden | 61 Zeilen; 13242;"O";"I. Radiologie";"CT- …  ×1,5, V ×1,5";"2,25";453,26 |
| Laptop 1280×720 mit offenem Detailbereich: kein horizontaler Überlauf | ✅ bestanden | kein Überlauf |
| Offline: keine externen Anfragen | ✅ bestanden | keine |
| Keine JavaScript-Fehler | ✅ bestanden | keine |

Screenshots: `output/screenshots/01_startansicht.png`, `output/screenshots/02_gefilterte_ansicht.png`, `output/screenshots/05_nicht_steigerfaehig.png`, `output/screenshots/03_detailbereich.png`, `output/screenshots/04_laptop_1280.png`

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

## 4b. Abgleich mit dem PDF (Allgemeine Bestimmungen)

Nicht durchgeführt: kein PDF in `input/`. Die PDF-Auswertung im Build-Skript (Suche der AB-IDs mit Seitenzahl, Kapiteltitel) ist vorbereitet, aber mangels Datei nicht erprobt.

## 5. Offene Punkte

1. **Wortlaut der 11 AB-IDs fehlt** (02.03-4, 03.01-6, 05.03-1, L-8, 14.01-10, 02.06-3, L-11, 14.01-11, L-9, L-10, 14.01-12): Das gelieferte Gebührenverzeichnis enthält die Allgemeinen Bestimmungen nicht. Das Dashboard zeigt je Grund die AB-IDs sowie Voraussetzung, Nachweis, Ausnahme und Geltungsbereich aus der Matrix, aber keinen Gesetzeswortlaut und keine Seitenzahl. Benötigt wird der Entwurf mit den AB (PDF nach `input/` oder Excel-Export der AB).
2. **Rundungsregel** (Matrix verweist auf Kap. A Nr. 23): im Gebührenverzeichnis nicht enthalten, daher nicht geprüft. Gerechnet wird kaufmännisch auf den Cent (Decimal, ROUND_HALF_UP).
3. **Stand des Entwurfs:** nur aus dem Dateinamen des Gebührenverzeichnisses abgeleitet (v6, 15.07.2026). Bitte bestätigen oder offiziellen Stand nennen.
4. **Vollständigkeit der Matrix:** Die Matrix enthält je Abschnitt weniger Ziffern als das Gebührenverzeichnis (Tabelle in Abschnitt 4). Ob alle steigerungsfähigen Hauptleistungen erfasst sind, ist eine fachliche Frage und wurde nicht geprüft oder korrigiert.
5. **Zusatztext im Detailbereich:** Zur vollständigen Leistungsbezeichnung wird der „Zusatz“ aus dem Gebührenverzeichnis angezeigt (gekennzeichnet). Falls nicht gewünscht, bitte melden.
6. **Ziffer 4409: Gebühr unklar.** Zuordnungsdatei nennt 38,45 €, das Gebührenverzeichnis den ungerundeten Wert 38.45589627481 (gerundet 38,46 €). Das Dashboard zeigt den Wert der Zuordnungsdatei. Bitte klären.
7. **„Nicht durch AB steigerfähig“ ist ein Umkehrschluss:** So gekennzeichnet sind alle Ziffern der Zuordnungsdatei, die nicht in der Steigerungsmatrix stehen. Die Matrix enthält laut eigener Beschreibung nur Hauptleistungen, für die mindestens ein Erhöhungsgrund greift (Zuschläge ausgenommen). Ob diese Auswahl vollständig ist, wurde nicht geprüft.
8. **Darstellung der nicht steigerfähigen Ziffern:** Max. Faktor „–“, als max. Gebührensatz wird die einfache Gebühr gezeigt (grau). Im Faktorfilter gibt es dafür den Eintrag „keine AB-Steigerung“. Bitte bestätigen.
9. **Multiplikationsannahme:** Die Excel multipliziert mehrere Gründe; der Entwurf regelt die Kumulation laut Excel-Hinweis nicht ausdrücklich. Das Dashboard übernimmt die Annahme und weist sie in der Hinweisleiste und im Szenario aus. Fachliche Bestätigung steht aus.
10. **Mehrfachauswahl der Grund-Chips:** umgesetzt als UND-Verknüpfung (Ziffer muss alle gewählten Gründe haben). Falls ODER gewünscht ist, bitte melden.
11. **Schalter „Theoretische Kombinationen einbeziehen“:** umgesetzt so, dass max. Faktor, max. Gebührensatz, Faktorfilter und CSV dann den theoretischen Höchstwert verwenden. Bitte bestätigen.
12. **Prüfmerkmale Bauchraum und CT/MRT** sind laut Excel per Stichwort vorbelegt („Indiz“). Das Dashboard übernimmt die Vorbelegung unverändert und zeigt sie im Detailbereich an; eine fachliche Prüfung der Vorbelegung ist nicht Teil dieses Builds.

## 6. Reproduktion

```bash
python3 build/build.py --ui
```
