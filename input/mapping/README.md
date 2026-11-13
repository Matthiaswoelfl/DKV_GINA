# Mapping alte GOÄ (Kurz-GOÄ, Stand August 2013) → GOÄneu (Entwurf v6, Stand 15.07.2026)

## Dateien

| Datei | Inhalt |
|---|---|
| `mapping_alt_zu_neu.csv` / `.json` | Hauptdatei: je alte Ziffer die neuen Ziffern (`|`-getrennt), Verhältnis, Wahrscheinlichkeit, Status, Quelle |
| `mapping_neu_zu_alt.csv` | Rückrichtung: je neue Ziffer die zugeordneten alten Ziffern |
| `abgleich_psy_nutzervorgabe.csv` | Deine PSY-Tabelle gegen die automatische Zuordnung |

**Achtung Nummernkollision:** Alte und neue GOÄ nutzen teils dieselben Nummern für verschiedene Leistungen (z. B. alt 4500 = Labor/Streptokokken, neu 4500 = analytische Psychotherapie). Spalten heißen deshalb immer `alt_…` / `neu_…`.

## Felder (`mapping_alt_zu_neu.csv`)

`nutzer_vorgabe_neu` (nur PSY, aus deiner Tabelle); `neu_ziffern_final` (Vorgabe, sonst Vorschlag); `alt_ziffer`; `alt_abschnitt` (A–P nach Nummernbereich); `alt_leistung`; `alt_punkte`; `alt_euro_1fach`; `neu_ziffern`; `neu_kapitel`; `neu_abschnitt`; `neu_leistung_erste`; `neu_euro_1fach`; `euro_faktor_neu_zu_alt` (Betrag erste neue Ziffer / alter 1,0-fach-Betrag); `verhaeltnis` (1:1, 1:n, n:1, n:m); `wahrscheinlichkeit`; `status`; `quelle` (automatisch / manuell geprüft); `bemerkung`; `score_top1`; `weitere_kandidaten`; `alt_anmerkung`.

## Wahrscheinlichkeit – was sie bedeutet

Sie gibt an, wie wahrscheinlich die **erste (beste) neue Ziffer inhaltlich dasselbe** beschreibt wie die alte. Berechnung: Textähnlichkeit (Wort- und Zeichen-n-Gramme) zwischen alter Kurzbezeichnung und neuer Leistungslegende, gewichtet mit Fachgebiets-Prior und Gebührenplausibilität, dann logistisch kalibriert an 104 manuell bewerteten Stichproben (Brier-Score 0,18; Labor-Treffer sind zuverlässiger, Chirurgie schlechter; „Zuschlag“-Wechsel senkt die Wahrscheinlichkeit). Es ist eine Schätzung, kein Messwert.

| Status | Wahrscheinlichkeit | Bedeutung |
|---|---|---|
| SICHER | ≥ 0,80 | Zuordnung kann übernommen werden (nicht fehlerfrei; Chirurgie/Zuschläge mit generischen Titeln sind die Hauptfehlerquelle) |
| PLAUSIBEL | 0,50–0,79 | fachlich gegenprüfen |
| UNSICHER | 0,25–0,49 | nur Vorschlag |
| KEINE_ENTSPRECHUNG_ERKENNBAR | < 0,25 | vermutlich entfallen, neu zugeschnitten oder in anderer Ziffer aufgegangen |
| SAMMELPOSITION | – | z. B. „Ähnliche Untersuchungen“ im Labor, keine 1:1-Zuordnung möglich |

Manuell geprüft (`quelle = manuell geprüft`) sind die alten Abschnitte B (Grundleistungen) und G (Neurologie/Psychiatrie/Psychotherapie); dort ist die Wahrscheinlichkeit meine fachliche Einschätzung. Alles andere ist automatisch.

## Zahlen

- 2831 alte Ziffern (2745 automatisch, 86 manuell geprüft). SICHER 522, PLAUSIBEL 884, UNSICHER 829, KEINE_ENTSPRECHUNG_ERKENNBAR 535, SAMMELPOSITION 61.
- Neue Ziffern gesamt 5.580, davon 1796 mindestens einer alten Ziffer zugeordnet; die übrigen sind neu geschnitten oder neu (z. B. feinere Aufteilung im Labor und in der Chirurgie, digitale Leistungen).

| Alter Abschnitt | Ziffern | SICHER | PLAUSIBEL | UNSICHER | KEINE | SAMMEL |
|---|---|---|---|---|---|---|
| B Grundleistungen | 51 | 44 | 1 | 1 | 5 | 0 |
| C Nichtgebietsbezogene Sonderleistungen | 174 | 21 | 51 | 60 | 42 | 0 |
| D Anästhesie | 33 | 5 | 4 | 13 | 11 | 0 |
| E Physikalisch-medizinische Leistungen | 43 | 6 | 10 | 20 | 7 | 0 |
| F Innere Medizin/Kinder/Derma | 137 | 17 | 23 | 47 | 50 | 0 |
| G Neurologie/Psychiatrie/Psychotherapie | 44 | 25 | 12 | 4 | 3 | 0 |
| H Geburtshilfe/Gynäkologie | 103 | 13 | 21 | 43 | 26 | 0 |
| I Augenheilkunde | 132 | 12 | 24 | 52 | 44 | 0 |
| J HNO | 153 | 8 | 51 | 60 | 34 | 0 |
| K Urologie | 133 | 17 | 37 | 48 | 31 | 0 |
| L Chirurgie/Orthopädie | 676 | 32 | 120 | 309 | 215 | 0 |
| M Labor | 921 | 307 | 486 | 65 | 2 | 61 |
| N Histologie/Zytologie | 15 | 0 | 1 | 11 | 3 | 0 |
| O Strahlen/Nuklear/MRT | 207 | 15 | 43 | 93 | 56 | 0 |
| P Sektion | 9 | 0 | 0 | 3 | 6 | 0 |

## Abgleich PSY (deine Vorgabe)

| alt | Nutzer-Vorgabe neu | automatisch neu | Übereinstimmung | fehlt automatisch | zusätzlich automatisch | p |
|---|---|---|---|---|---|---|
| 863 | 4500 | 4500 | 1/1 | – | – | 0.82 |
| 864 | 4501|4502|4503|4504 | 4502|4501|4504|4503 | 4/4 | – | – | 0.82 |
| 861 | 4505 | 4505 | 1/1 | – | – | 0.85 |
| 862 | 4506|4507|4508|4509 | 4507|4506|4508|4509 | 4/4 | – | – | 0.87 |
| 870 | 4510|4515 | 4510 | 1/2 | 4515 | – | 0.73 |
| 871 | 4511|4512|4513|4514|4516|4517|4518|4519 | 4512|4511|4514|4513 | 4/8 | 4516|4517|4518|4519 | – | 0.8 |
| 812, 812a | 4500|4501|…|4519 (alle 20) | 812 = Psychiatrische Notfallbehandlung → 4422|4423; 812a nicht im Dokument | NICHT_PRUEFBAR | – | – | – |

Hinweise:

- Bei 870 und 871 ergänzt deine Vorgabe die Systemische Therapie (4515, 4516–4519). Das lässt sich aus dem Text der alten GOÄ nicht ableiten, weil sie diese Verfahren noch nicht kennt. In `neu_ziffern_final` gilt deshalb deine Vorgabe.
- **812/812a (Kurzzeittherapie):** In der vorliegenden Kurz-GOÄ ist 812 = „Psychiatrische Notfallbehandlung“ (→ neu 4422/4423), 812a existiert nicht. Die Kurzzeittherapie-Zuordnung auf 4500–4519 konnte ich daher nicht gegen das Dokument bestätigen; bitte prüfen, ob eine andere alte Nummer gemeint ist (im Dokument am nächsten: 808 „Tiefenpsychologische oder analytische Psychotherapie“, 849 „Psychotherapeutische Behandlung, mindestens 20 Minuten“).

## Grenzen

- Der alte Gebührenverzeichnis-Text ist in der Kurz-GOÄ stark verkürzt; kurze Titel („Beratung“, „Resektion“) sind schwer eindeutig zuzuordnen.
- Die alten Zuschläge A–K und die Allgemeinen Bestimmungen sind nicht Teil des Mappings, nur die nummerierten Gebührenziffern.
- Labor: Die alten Betragsspalten (1,0-fach) fehlen teilweise, dort bleibt `alt_euro_1fach` leer.
- Die Spalte `euro_faktor_neu_zu_alt` vergleicht neue Gebührensätze mit dem alten 1,0-fachen Satz; sie dient nur als Plausibilitätsindikator.
