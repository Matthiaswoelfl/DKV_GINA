#!/usr/bin/env python3
"""Anonymisierungsprüfung: sucht Namen aus der Quelldatei im Repo-Output (ohne sie auszugeben).

Aufruf:  python3 -I tools/anon_check.py <quelle.xlsx> [verzeichnis]
Die Suchbegriffe werden zur Laufzeit aus der Quelldatei gelesen (Namensspalte, Titel, Kopf der
Tagessatztabelle) und nirgends gespeichert oder ausgegeben - nur Trefferanzahl je Datei.
Exit-Code 1 bei Treffern.
"""
import os, re, sys, openpyxl

src = sys.argv[1]
root = sys.argv[2] if len(sys.argv) > 2 else "."
ALLOW = {"projektlauf", "begleitung", "goä-novelle", "tagessätze", "gesamtkapazität", "anzahl", "beratertage",
         "budget", "kapazität", "gesamtberatungsbudget", "netto", "ohne", "nebenkosten", "reisekosten",
         "onsite", "business", "strategy", "partner", "consultant", "senior", "associate", "projekt"}
wb = openpyxl.load_workbook(src)           # Formeln, nicht Werte: erfasst auch Textzellen
ws0 = wb.worksheets[0]
ALLOW |= {"goä", "q1-q2"}
cells = [ws0.cell(r, 4).value for r in range(4, 12)]            # Namensspalte der Kapazitätszeilen
cells += [ws0["C2"].value, ws0["D37"].value, ws0.title]         # Titel (Kunde) und Tabellenkopf (eigene Firma)
terms = set()
for v in cells:
    if isinstance(v, str) and not v.startswith("="):
        for t in re.split(r"[^\wÄÖÜäöüß-]+", v):
            if len(t) >= 3 and t.lower() not in ALLOW and not t.isdigit():
                terms.add(t.lower())
hits = 0; scanned = 0
for d, dirs, files in os.walk(root):
    dirs[:] = [x for x in dirs if x not in (".git", "node_modules")]
    for f in files:
        p = os.path.join(d, f)
        if f.lower().endswith((".png", ".pdf", ".xlsx")) or f == "anon_check.py": continue
        try: txt = open(p, encoding="utf-8").read().lower()
        except Exception: continue
        scanned += 1
        n = sum(txt.count(t) for t in terms)
        if n: hits += n; print("TREFFER in", p, "->", n, "Vorkommen")
print("Geprüfte Dateien:", scanned, "| Suchbegriffe:", len(terms), "| Treffer:", hits)
sys.exit(1 if hits else 0)
