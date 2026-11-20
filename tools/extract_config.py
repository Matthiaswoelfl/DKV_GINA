#!/usr/bin/env python3
"""Extrahiert den Basisplan anonymisiert (nur Rollen) aus der Excel-Quelldatei.

Aufruf:  python3 -I tools/extract_config.py <quelle.xlsx> config/basisplan.json
Gelesen werden nur Rolle (Spalte F), Auslastung (H:AG) und die Tagessatztabelle.
Namen (Spalte D) werden nie gelesen oder ausgegeben. Zeilen ohne jede Auslastung
(Platzhalter) werden verworfen.
"""
import json, sys, openpyxl

src, dst = sys.argv[1], sys.argv[2]
ws = openpyxl.load_workbook(src, data_only=True).worksheets[0]
WEEKS = 26
rates = {}
for r in range(39, 46):                      # Tagessatztabelle: Rolle | Satz
    role, rate = ws.cell(r, 4).value, ws.cell(r, 6).value
    if role and rate:
        rates[str(role).strip()] = rate
roles = []
for r in range(4, 12):                       # Kapazitätszeilen
    role = ws.cell(r, 6).value
    fte = [ws.cell(r, c).value or 0 for c in range(8, 8 + WEEKS)]   # leer -> 0
    if role and any(fte):
        roles.append({"type": str(role).strip(), "fte": fte})
cfg = {
    "projekt": "Projekt GOÄ-Novelle",
    "start": "2027-01-04",
    "weeks": WEEKS,
    "parameters": {"daysPerFte": 5, "onsiteQuote": 0.4, "travelPerDay": 200, "vat": 0.19},
    "rates": rates,
    "roles": roles,
}
with open(dst, "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=1)
print("Rollen:", [r["type"] for r in roles], "| Wochen:", WEEKS)
