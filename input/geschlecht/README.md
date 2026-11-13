# GOÄneu – Geschlechtsbezug je Ziffer (Entwurf v6, Stand 15.07.2026)

Grundlage: Ihre Liste (274 Ziffern) plus erneute Analyse des Gesetzentwurfs (alle 5.580 Ziffern, Legende und Abrechnungsbestimmung).

## Dateien
| Datei | Inhalt |
|---|---|
| `GOAeneu_Geschlechtsbezug_Ziffern.xlsx` | Ihre Arbeitsmappe, erweitert: Hauptliste (342 Ziffern), Blätter `Neu_gefunden`, `Grenzfaelle`, `Abgrenzung` |
| `geschlechtsbezug.csv/json` | Hauptliste maschinenlesbar (342 Ziffern) |
| `grenzfaelle.csv/json` | 83 Ziffern mit nicht obligatorischem Geschlechtsbezug (nur Hinweis) |
| `abgrenzung.csv` | 76 geprüfte, bewusst nicht aufgenommene Ziffern mit Grund |

## Felder (`geschlechtsbezug.json`)
`ziffer`, `kapitel`, `abschnitt_code`, `titel`, `gebuehr_eur`, `geschlecht` (W/M), `bezugsart`, `zuschlag` (ja/nein), `konfidenz` (hoch/mittel), `quelle` (Vorgabe/NEU), `begruendung`, `pruefmodus`, `seite`.

## Regel
Kap. A, Allgemeine Bestimmung Nr. 4: Bei geschlechtsspezifischem Leistungsinhalt zählt nicht der Personenstandseintrag, sondern der individuelle medizinische Bedarf. Deshalb nur **weiche Prüfung** (Aussteuerung, keine automatische Ablehnung).

## Aufnahmekriterium
Aufgenommen, wenn der Geschlechtsbezug obligatorischer Leistungsinhalt ist: Geschlecht in der Legende, ausschließlich einem Geschlecht zugeordnetes Organ oder Material, Schwangerschaft/Geburt/Pränatalmedizin, Indikation mit Geschlechtsangabe im Labor. Nicht aufgenommen bei „und/oder“, „z.B.“, „ggf.“ oder Alternativen (siehe `abgrenzung.csv`).

## Konfidenz
- `hoch`: Geschlecht steht in der Legende, oder das Organ/Material gehört nur einem Geschlecht.
- `mittel`: fachlich abgeleitet. Reproduktionsmedizin (Paar-Behandlung, Abrechnung ggf. über Partner/Partnerin), Douglasraum (919), Rektozele (9905/9906).

## Zuschläge
Vererbt, wenn alle Hauptleistungen dasselbe Geschlecht haben. Abschnittszuschläge (9996–10000, 10275–10277, 4776–4778, 5122–5124) haben kein eigenes Geschlecht: Das Geschlecht der tatsächlich abgerechneten Hauptleistung gilt.
