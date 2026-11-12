# GOÄneu (Entwurf v6, Stand 15.07.2026) – Kombinationsregeln „nicht neben“ / „nur neben“

Maschinenlesbare Auswertung des gesamten Entwurfs (Paragraphenteil, Allgemeine Bestimmungen auf Kapitel-/Abschnittsebene, alle 5.580 Ziffern des Gebührenverzeichnisses). Quelle: `GOAe_v6.pdf` (1.049 Seiten). **Seitenzahlen** in allen Dateien = gedruckte Seite (Fußzeile „Seite N“); PDF-Seite = N + 1.

## Dateien

| Datei | Inhalt | Verwendung |
|---|---|---|
| `regeln.csv` / `regeln.json` | **Alle 2539 Regeln** (eine Zeile je Regel, Originalsatz inklusive) | Hauptdatei; Semikolon-getrennt, UTF-8 mit BOM; Listen mit `|` getrennt |
| `paare_nicht_neben.csv` | Alle „nicht neben“-Beziehungen **Ziffer ↔ Ziffer** (2565 Paare, Bereiche aufgelöst) | direkter Lookup / Join |
| `nur_neben.csv` | Alle „nur neben“-Regeln (Zuschläge etc.) je Ziffer | Zuschlag → zulässige Hauptleistungen |
| `ziffer_index.json` | Je Ziffer gebündelt: nicht-neben (explizit, bedingt, umgekehrt abgeleitet), nur-neben, neben-erlaubt, Begründungspflicht | schneller Lookup im Dashboard |
| `weitere_ausschluesse.csv` | 168 Ausschluss-Sätze **ohne** das Wort „neben“ (Bestandteil der Leistung, Narkose-Zuschläge, Indikationsausschlüsse) | ergänzend, nicht Teil der Hauptregeln |

## Regeltypen (`typ`)

| typ | Bedeutung | Anzahl |
|---|---|---|
| `NICHT_NEBEN` | Subjekt ist neben Ziel **nicht berechnungsfähig**. Immer normalisiert als „Subjekt darf nicht neben Ziel“ (auch bei Satzform „Neben X sind Y nicht berechnungsfähig“ → Subjekt = Y, Ziel = X). Ziel-Logik `JEDE`: gilt für jede genannte Ziel-Ziffer einzeln. | 1106 |
| `NUR_NEBEN` | Subjekt (meist Zuschlag) ist **nur zusammen mit** den Zielen berechnungsfähig. Ziel-Logik `MINDESTENS_EINE_VON`: mindestens eine der genannten Ziffern / eine Leistung des genannten Abschnitts muss ebenfalls abgerechnet sein. Aus „Zuschlag zu der Leistung nach Nummer …“ abgeleitet (Zuschlag = nur neben Hauptleistung). | 1343 |
| `NEBEN_ERLAUBT` | ausdrückliche Ausnahme: neben … berechnungsfähig | 52 |
| `NEBEN_MIT_BEGRUENDUNG` | Nebeneinander nur mit medizinischer Begründung in der Rechnung | 29 |
| `NEBEN_MIT_ABSCHLAG` | Nebeneinander nur mit reduziertem Gebührensatz (z. B. halber Satz) | 2 |
| `AUSLEGUNGSREGEL` | Meta-Regeln aus Kapitel A (Sitzungsbezug der Ausschlüsse, Bestandteil-Regel) | 4 |
| `SONDERFALL` | nicht sinnvoll strukturierbar, nur Volltext (`satz`) | 3 |

Auf Ziffern-Ebene: 1086 NICHT_NEBEN, 1342 NUR_NEBEN, 45 NEBEN_ERLAUBT, 27 NEBEN_MIT_BEGRUENDUNG. Auf AB-Ebene (Paragraphenteil, Kapitel, Abschnitt): 39 Regeln.

## Felder in `regeln.csv`

`regel_id`, `typ`, `ebene` (Ziffer | Abschnitt | Kapitel | Übergeordnet (Kapitel A) | Paragraphenteil), `ab_id` (nur AB-Ebene, z. B. `02.06-3` = Abschnitt-Code + laufende Nummer, `L-12` = Kapitel L; wie in der Steigerungsmatrix), `quelle_ziffer` (Ziffer, in deren Text die Regel steht), `seite`, `kapitel`, **Subjekt**: `subjekt_ziffern`, `subjekt_abschnitte`, `subjekt_kapitel`, `subjekt_freitext`; **Ziel**: `ziel_ziffern`, `ziel_bereiche` (`a-b`, z. B. 15-19; in `regeln.json` zusätzlich `ziel_ziffern_exp` = alle existierenden Ziffern aufgelöst), `ziel_abschnitte` (z. B. `C VI`, `M III.13.2.2`), `ziel_kapitel`, `ziel_freitext`; `ziel_logik`, `bedingt` (ja/nein), `bedingung` (Wortlaut der Einschränkung, z. B. „soweit es sich um das gleiche Probenmaterial handelt“, „für dieselbe Hauptleistung“), `herkunft` (welches Satzmuster), `geltungsbereich`, `satz` (Originalwortlaut).

Ist kein Subjekt in Ziffern genannt, steht die Beschreibung in `subjekt_freitext` (z. B. „Beratungs- oder Gesprächsleistungen des Kapitels B“ neben Ziffer 113). Ziele ohne Ziffern stehen in `ziel_abschnitte`, `ziel_kapitel` oder `ziel_freitext` (124 NICHT_NEBEN-Regeln haben als Ziel nur Freitext, davon 99 die Standardformel „nicht neben einem Zuschlag mit besonderem Leistungsinhalt, der eine Altersangabe enthält“).

## Beispiele

- Ziffer 1200: `NICHT_NEBEN` neben 1225, 1228 (Satz in der Ziffer); zusätzlich laut Abschnitt-AB H nicht neben 4600, 4602, 4603, 4611, 4718, 4719, 4725, 4727, 4728, 4729.
- Ziffer 4525: `NUR_NEBEN` mit 4500, 4501, 4503, 4505, 4506, 4508, 4510, 4511, 4513, 4515, 4518, 4520 oder 4523 (`MINDESTENS_EINE_VON`).
- Ziffer 1215: `NUR_NEBEN` mit 1205/1208/1211/1212 und gleichzeitig `NICHT_NEBEN` mit 1214, 1333, 1334, 1335.

## Wichtige Hinweise zur Auslegung

1. **Richtung:** Die Sätze sind meist einseitig formuliert („A ist neben B nicht berechnungsfähig“). Von 2565 Paaren ist bei 1238 auch die Gegenrichtung ausdrücklich geregelt (`gegenregel_vorhanden=ja`). In `ziffer_index.json` steht die Gegenrichtung als `nicht_neben_umgekehrt_abgeleitet` – das ist eine **Ableitung**, nicht Gesetzeswortlaut. Ob sie rechtlich gilt, ist fachlich zu bewerten.
2. **Sitzungsbezug (Kapitel A, Nr. 8):** Nebeneinander-Ausschlüsse beziehen sich auf dieselbe Sitzung. Ein Zuschlag, der neben einer bestimmten Hauptleistung ausgeschlossen ist, kann dennoch in derselben Sitzung angesetzt werden, wenn er sich auf eine andere, ihm zugeordnete Hauptleistung bezieht und die Hauptleistungen nebeneinander berechnungsfähig sind. (`AUSLEGUNGSREGEL`, ab_id `A-8`.)
3. **Zuschläge (Kapitel A, Nr. 3):** „Zuschläge können nur zusammen mit einer zuschlagsfähigen Leistung berechnet werden“ – allgemeine `NUR_NEBEN`-Regel auf Übergeordnet-Ebene.
4. **Zuschläge zu Abschnitten** (z. B. „Zuschlag zu den Leistungen des Abschnitts C VI, die mit einem nicht unterschreitbaren Gebührensatz bis zu 36,00 EUR bewertet sind …“): Ziel steht in `ziel_abschnitte`, die Gebührensatz-Grenze in `bedingung`. Die Auflösung in einzelne Ziffern (Abschnitt → Ziffern mit passender Gebühr) ist bewusst **nicht** vorgenommen; dafür `GOAeneu_Ziffer_zu_Kapitel.csv` (Abschnittszuordnung + Gebühr) verwenden.
5. **Inklusionslisten** („Die Leistungen des Kapitels L beinhalten … folgende daneben nicht gesondert berechnungsfähige Leistungen: …“) sind als `NICHT_NEBEN` mit Liste in `ziel_freitext` abgelegt (`herkunft` beginnt mit „AB: Inklusionsliste“).
6. **Bedingungen** sind im Wortlaut übernommen, nicht ausgewertet. Paare mit `bedingt=ja` gelten nur unter dieser Bedingung.

## Methode und Qualitätssicherung

- Text je Ziffer aus der Layout-Extraktion des PDFs (Titel, Zusatz, Abrechnungsbestimmung, seitenübergreifend zusammengeführt), Sätze regelbasiert getrennt; Muster: „A ist neben B nicht berechnungsfähig“, „Neben A sind B nicht berechnungsfähig“, „… daneben nicht …“, „nicht nebeneinander“, „Zuschlag zu der Leistung nach Nummer …“, „nur neben / ausschließlich mit“, „Nebeneinanderberechnung … Begründung“, positive Ausnahmen.
- **Vollständigkeit:** Jeder Satz mit „neben“, „daneben“, „nebeneinander“ oder „ausschließlich mit“ ist einem Regeltyp zugeordnet (0 unklassifizierte Sätze auf Ziffern-Ebene). Jede der 1.325 Ziffern, deren Titel mit „Zuschlag“ beginnt, hat eine `NUR_NEBEN`-Regel.
- **Referenzprüfung:** Alle referenzierten Ziffern (Subjekt, Ziel, Bereiche) existieren im Gebührenverzeichnis (0 unbekannte Nummern).
- Die AB-Ebene (39 Regeln) wurde zusätzlich händisch geprüft und korrigiert.
- **Grenzen:** Regeln, die nur über Fließtext ohne die genannten Schlüsselwörter formuliert sind (z. B. „… nicht gesondert berechnungsfähig“ ohne „neben“), stehen in `weitere_ausschluesse.csv`. Ungeprüft bleibt, ob das PDF selbst Widersprüche enthält (z. B. nur einseitig geregelte Ausschlüsse).

## Schnellstart (Python)

```python
import json
idx = json.load(open("ziffer_index.json", encoding="utf-8"))
idx["1200"]["nicht_neben_explizit_unbedingt"]      # [1225, 1228, 4600, ...]
idx["4525"]["nur_neben"][0]["ziffern"]             # [4500, 4501, ...]
import pandas as pd
pairs = pd.read_csv("paare_nicht_neben.csv", sep=";", encoding="utf-8-sig")
```
