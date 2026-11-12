#!/usr/bin/env python3
"""Build-Skript: GOÄneu – Steigerungsdashboard.

Liest die Excel-Steigerungsmatrix (maßgebliche Quelle) und – falls vorhanden –
das Gebührenverzeichnis des Entwurfs als Excel (input/gesetz/*.xlsx, nur
Abgleich und Zusatztexte) bzw. den Entwurf als PDF (input/*.pdf, nur
Wortlaut/Fundstellen der AB-Regeln), rechnet alle
Gebührensätze mit Decimal, führt die Abnahmetests aus und erzeugt

    dist/GOAeneu_Steigerungsdashboard.html   (eigenständig, offline lauffähig)
    output/qs_bericht.md                     (Tests, Abweichungen, offene Punkte)

Aufruf:
    python3 build/build.py            # Daten, HTML, Bericht
    python3 build/build.py --ui       # zusätzlich UI-Tests + Screenshots (Playwright/Node)
"""
from __future__ import annotations

import argparse
import itertools
import json
import re
import subprocess
import sys
from collections import Counter, OrderedDict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "input"
TEMPLATE = ROOT / "build" / "template.html"
DIST = ROOT / "dist" / "GOAeneu_Steigerungsdashboard.html"
REPORT = ROOT / "output" / "qs_bericht.md"
UI_JSON = ROOT / "output" / "qs_ui.json"
SHEET = "Steigerungsmatrix"

HEADER_ROW = 12
KUERZEL = ["G", "B", "S", "F", "V"]          # Spalten H..L
COL_REASON0 = 8                               # H
COL_MOEGL0, COL_MOEGL1 = 14, 20               # N..T
FONT_PRAKT, FILL_PRAKT = "375623", "E2EFDA"
FONT_THEO, FILL_THEO = "C00000", "F2F2F2"
# Laut Excel (Zelle A8) nur theoretisch: S×F und B×F
THEO_PAARE = [{"S", "F"}, {"B", "F"}]

SOLL_KAPITEL = {"C": 100, "D": 2, "F": 31, "L": 1705, "O": 161}
SOLL_VERTEILUNG = {"1,5": 142, "2,0": 55, "2,25": 58, "3,0": 37, "4,0": 1470, "4,5": 2, "6,0": 235}
SOLL_AB_IDS = ["02.03-4", "03.01-6", "05.03-1", "L-8", "14.01-10", "02.06-3", "L-11",
               "14.01-11", "L-9", "L-10", "14.01-12"]
STICHPROBE = [900, 1200, 1713, 5600, 13399]   # wird auf >= 10 Ziffern aufgefüllt


# ---------------------------------------------------------------- Hilfen
def dec(v) -> Decimal:
    """Zellwert exakt als Decimal (kein Float-Rechnen)."""
    if isinstance(v, bool) or v is None:
        raise ValueError(f"kein Zahlenwert: {v!r}")
    return Decimal(str(v))


def fmt_faktor(d: Decimal) -> str:
    """2 -> '2,0' · 1.5 -> '1,5' · 2.25 -> '2,25'"""
    d = d.normalize()
    if d.as_tuple().exponent > -1:
        d = d.quantize(Decimal("0.1"))
    return format(d, "f").replace(".", ",")


def fmt_euro(cents: int) -> str:
    s = f"{cents // 100:,}".replace(",", ".")
    return f"{s},{cents % 100:02d} €"


def cents(gebuehr: Decimal, faktor: Decimal) -> int:
    """Gebühr × Faktor, kaufmännisch auf den Cent gerundet."""
    return int((gebuehr * faktor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) * 100)


def rgb(color) -> str | None:
    v = getattr(color, "rgb", None)
    return v[-6:].upper() if isinstance(v, str) else None


HERL_RE = re.compile(r"^M(\d+) ([\d,]+)× = (.*?)(?: \(nur theoretisch: (.*)\))?$")


def parse_herleitung(text: str):
    """'M1 1,5× = B | V · M2 …' -> [(faktor_str, [praktische Kombis], [theoretische Kombis])]"""
    out = []
    for i, teil in enumerate(text.split(" · "), start=1):
        m = HERL_RE.match(teil.strip())
        if not m or int(m.group(1)) != i:
            raise ValueError(f"Herleitung nicht lesbar: {teil!r}")
        prakt = [] if m.group(3).strip() in ("–", "-", "") else [k.strip() for k in m.group(3).split("|")]
        theo = [k.strip() for k in m.group(4).split("|")] if m.group(4) else []
        out.append((m.group(2), prakt, theo))
    return out


def kombi_key(kombi: str) -> str:
    teile = set(kombi.split("×"))
    return "".join(k for k in KUERZEL if k in teile)


# ---------------------------------------------------------------- Excel
def lese_excel(pfad: Path):
    abw: list[str] = []          # Auffälligkeiten innerhalb der Excel
    wv = openpyxl.load_workbook(pfad, data_only=True)[SHEET]
    wf = openpyxl.load_workbook(pfad)[SHEET]

    # Kopfblock: Zeilenbeschriftung in Spalte D suchen (nicht hart verdrahten)
    labels = {}
    for r in range(1, HEADER_ROW):
        v = wv.cell(r, 4).value
        if isinstance(v, str):
            labels[v.strip()] = r

    def kopf(label_start: str, col: int):
        for lab, r in labels.items():
            if lab.startswith(label_start):
                return wv.cell(r, col).value
        raise ValueError(f"Kopfzeile '{label_start}' nicht gefunden")

    gruende = []
    for i, k in enumerate(KUERZEL):
        col = COL_REASON0 + i
        titel = str(wv.cell(HEADER_ROW, col).value)
        name = re.sub(r"\s*×[\d,]+\s*$", "", titel)
        f = dec(kopf("Faktor", col))
        gruende.append({
            "k": k, "name": name, "faktor": fmt_faktor(f), "_f": f,
            "ids": [s.strip() for s in str(kopf("Rechtsgrundlage", col)).split("·")],
            "geltung": kopf("Geltungsbereich", col),
            "voraussetzung": kopf("Voraussetzung", col),
            "nachweis": kopf("Notwendige Begründung", col),
            "ausnahme": kopf("Ausnahme", col),
        })
    hinweise = [wv.cell(r, 1).value for r in range(1, HEADER_ROW)
                if isinstance(wv.cell(r, 1).value, str) and r not in (1, 4)]
    titel = wv.cell(1, 1).value

    abschnitte: "OrderedDict[tuple, int]" = OrderedDict()
    muster_idx: dict = {}
    muster: list = []
    rows = []
    gesehen = set()

    for r in range(HEADER_ROW + 1, wv.max_row + 1):
        ziffer = wv.cell(r, 1).value
        if ziffer is None:
            continue
        if ziffer in gesehen:
            abw.append(f"Zeile {r}: Ziffer {ziffer} doppelt")
        gesehen.add(ziffer)
        kap, absn, leistung = (wv.cell(r, c).value for c in (2, 3, 4))
        gebuehr = dec(wv.cell(r, 5).value)
        if gebuehr.as_tuple().exponent < -2:
            abw.append(f"Ziffer {ziffer}: Gebühr {gebuehr} hat mehr als 2 Nachkommastellen")
        bauch, ctmrt = wv.cell(r, 6).value, wv.cell(r, 7).value

        # Steigerungsgründe H..L
        fakt = OrderedDict()
        for i, k in enumerate(KUERZEL):
            v = wv.cell(r, COL_REASON0 + i).value
            if v in (None, ""):
                continue
            fakt[k] = dec(v)
            if fakt[k] != gruende[i]["_f"]:
                abw.append(f"Ziffer {ziffer}: Faktor {k} = {v} weicht von Definitionszeile ab")
        if not fakt:
            abw.append(f"Ziffer {ziffer}: kein Steigerungsgrund")
            continue
        kuerzel = "".join(fakt)
        if wv.cell(r, 13).value != len(fakt):
            abw.append(f"Ziffer {ziffer}: Spalte M ({wv.cell(r, 13).value}) ≠ Anzahl Gründe ({len(fakt)})")
        if wv.cell(r, 21).value != kuerzel:
            abw.append(f"Ziffer {ziffer}: Spalte U ({wv.cell(r, 21).value}) ≠ Gründe ({kuerzel})")
        if ("S" in fakt) != (bauch == "ja"):
            abw.append(f"Ziffer {ziffer}: Grund S passt nicht zum Prüfmerkmal Bauchraum ({bauch})")
        if ("V" in fakt) != (ctmrt == "ja"):
            abw.append(f"Ziffer {ziffer}: Grund V passt nicht zum Prüfmerkmal CT/MRT ({ctmrt})")

        # Möglichkeiten N..T: Wert + Formatierung
        zellen = []
        for c in range(COL_MOEGL0, COL_MOEGL1 + 1):
            v = wv.cell(r, c).value
            if v in (None, ""):
                continue
            z = wf.cell(r, c)
            strike = bool(z.font.strike)
            farben = (rgb(z.font.color), rgb(z.fill.fgColor))
            soll = (FONT_THEO, FILL_THEO) if strike else (FONT_PRAKT, FILL_PRAKT)
            if farben != soll:
                abw.append(f"Ziffer {ziffer}, {z.coordinate}: Formatierung {farben} unerwartet (strike={strike})")
            zellen.append((dec(v), strike))
        if [f for f, _ in zellen] != sorted(f for f, _ in zellen):
            abw.append(f"Ziffer {ziffer}: Möglichkeiten nicht aufsteigend")

        herl_text = wv.cell(r, 22).value or ""
        herl = parse_herleitung(herl_text)

        sig = (kuerzel, tuple(fakt.values()), tuple(zellen), herl_text)
        if sig not in muster_idx:
            # Gegenprobe: alle Teilmengen aus den Gründen neu rechnen
            erwartet: dict = {}
            for n in range(1, len(fakt) + 1):
                for kombi in itertools.combinations(fakt, n):
                    p = Decimal(1)
                    for k in kombi:
                        p *= fakt[k]
                    theo = any(paar <= set(kombi) for paar in THEO_PAARE)
                    erwartet.setdefault(p, {})["".join(kombi)] = theo
            moegl, sub = [], {}
            if len(herl) != len(zellen):
                abw.append(f"Muster {kuerzel} (z. B. Ziffer {ziffer}): {len(zellen)} Möglichkeiten, Herleitung nennt {len(herl)}")
            for (f, strike), (f_txt, prakt, theo) in zip(zellen, herl):
                if fmt_faktor(f) != f_txt:
                    abw.append(f"Muster {kuerzel} (z. B. Ziffer {ziffer}): Faktor {fmt_faktor(f)} ≠ Herleitung {f_txt}")
                if strike != (not prakt):
                    abw.append(f"Muster {kuerzel} (z. B. Ziffer {ziffer}): Formatierung von {fmt_faktor(f)} passt nicht zur Herleitung")
                ist = {kombi_key(k): False for k in prakt}
                ist.update({kombi_key(k): True for k in theo})
                if ist != erwartet.get(f):
                    abw.append(f"Muster {kuerzel} (z. B. Ziffer {ziffer}): Kombinationen für {fmt_faktor(f)} "
                               f"laut Herleitung {ist} ≠ nachgerechnet {erwartet.get(f)}")
                for key, t in ist.items():
                    sub[key] = [len(moegl), 1 if t else 0]
                moegl.append({"f": fmt_faktor(f), "_f": f, "prakt": prakt, "theo": theo, "status": "t" if strike else "p"})
            if set(erwartet) != {m["_f"] for m in moegl}:
                abw.append(f"Muster {kuerzel} (z. B. Ziffer {ziffer}): Faktoren der Möglichkeiten ≠ nachgerechnete Faktoren")
            prakt_idx = [i for i, m in enumerate(moegl) if m["status"] == "p"]
            muster_idx[sig] = len(muster)
            muster.append({
                "kuerzel": kuerzel,
                "gruende": {k: fmt_faktor(v) for k, v in fakt.items()},
                "moegl": moegl, "sub": sub,
                "maxP": max(prakt_idx), "maxT": len(moegl) - 1,
                "herleitung": herl_text, "_n": 0,
            })
        mi = muster_idx[sig]
        muster[mi]["_n"] += 1
        abschnitte[(kap, absn)] = abschnitte.get((kap, absn), 0) + 1
        rows.append({
            "z": ziffer, "kap": kap, "abs": absn, "t": leistung, "_g": gebuehr,
            "bauch": bauch, "ct": ctmrt, "m": mi,
            "c": [cents(gebuehr, m["_f"]) for m in muster[mi]["moegl"]],
        })
    return {"titel": titel, "hinweise": hinweise, "gruende": gruende, "abschnitte": abschnitte,
            "muster": muster, "rows": rows, "abw": abw}


# ---------------------------------------------------------------- Gebührenverzeichnis (Excel, optional)
def norm_text(s) -> str:
    s = (s or "").replace("_x000D_", " ").replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def zusatz_text(s) -> str:
    return re.sub(r"[ \t]*\n[ \t]*", "\n", (s or "").replace("_x000D_", "").replace("\xa0", " ")).strip()


def lese_kapitel(daten, gesetz):
    """Zuordnung aller GO-Ziffern zu Kapitel/Abschnitt (input/kapitel/*.json). Liefert die
    Grundgesamtheit; Ziffern, die nicht in der Steigerungsmatrix stehen, gelten als
    'nicht durch AB steigerfähig'."""
    dateien = sorted((INPUT / "kapitel").glob("*.json"))
    info = {"datei": None}
    if not dateien:
        return info
    roh = json.loads(dateien[0].read_text(encoding="utf-8"))
    K = {int(z): v for z, v in roh.items()}
    matrix = {r["z"]: r for r in daten["rows"]}
    alle = gesetz.get("alle", {})

    def abs_name(v):
        return f"{v['abschnitt_nr']}. {v['abschnitt_name']}" if v["abschnitt_nr"] else (v["abschnitt_name"] or "(ohne Abschnitt)")

    info.update(datei=dateien[0].name, n=len(K), K=K, abs_name=abs_name,
                fehlt_in_json=sorted(set(matrix) - set(K)),
                nur_json=sorted(set(K) - set(alle)) if alle else [], nur_gv=sorted(set(alle) - set(K)),
                abw_abschnitt=[], abw_gebuehr_matrix=[], abw_gebuehr_gv=[], abw_code=Counter(), ohne_text=[])
    for z, v in K.items():
        geb = Decimal(v["gebuehr_eur"].replace(".", "").replace(",", "."))
        v["_g"] = geb
        m = matrix.get(z)
        if m:
            if (m["kap"], m["abs"]) != (v["kapitel"], abs_name(v)):
                info["abw_abschnitt"].append((z, f"{m['kap']} · {m['abs']}", f"{v['kapitel']} · {abs_name(v)}"))
            if m["_g"] != geb:
                info["abw_gebuehr_matrix"].append((z, m["_g"], geb))
        g = alle.get(z)
        if g:
            if g["g"] != geb:
                info["abw_gebuehr_gv"].append((z, geb, g["g"]))
            if not g["code"].startswith(v["abschnitt_code"]) or not v["abschnitt_code"]:
                info["abw_code"][(v["kapitel"], abs_name(v), v["abschnitt_code"] or "(leer)", g["code"])] += 1
        elif not m:
            info["ohne_text"].append(z)
    return info


# ---------------------------------------------------------------- Nebeneinanderberechnung
NEBEN_DIR = INPUT / "neben"
TYP_KURZ = {"NICHT_NEBEN": "N", "NUR_NEBEN": "U", "NEBEN_ERLAUBT": "E", "NEBEN_MIT_BEGRUENDUNG": "B",
            "NEBEN_MIT_ABSCHLAG": "A", "AUSLEGUNGSREGEL": "X", "SONDERFALL": "S"}
SOLL_REGELTYPEN = {"NICHT_NEBEN": 1106, "NUR_NEBEN": 1343, "NEBEN_ERLAUBT": 52, "NEBEN_MIT_BEGRUENDUNG": 29,
                   "NEBEN_MIT_ABSCHLAG": 2, "AUSLEGUNGSREGEL": 4, "SONDERFALL": 3}


def lese_regeln(ziffern: set) -> dict:
    """Kombinationsregeln (input/neben/regeln.json, ziffer_index.json, weitere_ausschluesse.csv).
    Einzige Quelle der Ansicht „Nebeneinanderberechnung“; hier wird nichts aus Texten neu abgeleitet."""
    info = {"datei": None}
    f = NEBEN_DIR / "regeln.json"
    if not f.exists():
        return info
    roh = json.loads(f.read_text(encoding="utf-8"))
    index = json.loads((NEBEN_DIR / "ziffer_index.json").read_text(encoding="utf-8")) if (NEBEN_DIR / "ziffer_index.json").exists() else {}
    regeln, je, unbekannt = [], {}, []
    for i, r in enumerate(roh):
        sz, zz = r["subjekt_ziffern"], r["ziel_ziffern_exp"]
        unbekannt += [(r["regel_id"], x) for x in sz + zz + r["ziel_ziffern"] if x not in ziffern]
        subj_txt = " · ".join(x for x in [", ".join("Abschnitt " + a for a in r["subjekt_abschnitte"]),
                                           ", ".join("Kapitel " + k for k in r["subjekt_kapitel"]), r["subjekt_freitext"]] if x)
        ziel_txt = " · ".join(x for x in [", ".join("Abschnitt " + a for a in r["ziel_abschnitte"]),
                                           ", ".join("Kapitel " + k for k in r["ziel_kapitel"]), r["ziel_freitext"]] if x)
        regeln.append({"id": r["regel_id"], "t": TYP_KURZ[r["typ"]], "e": r["ebene"], "ab": r["ab_id"], "p": r["seite"],
                       "q": r["quelle_ziffer"], "k": r["kapitel"], "sz": sz, "st": subj_txt, "zz": zz, "zt": ziel_txt,
                       "bd": r["bedingung"], "hk": r["herkunft"], "gb": r["geltungsbereich"], "satz": r["satz"]})
        # Regel hängt an jeder Subjekt-Ziffer; steht das Subjekt nur als Text da, an der Quell-Ziffer
        for z in (sz if sz else ([r["quelle_ziffer"]] if r["quelle_ziffer"] else [])):
            if z in ziffern:
                je.setdefault(z, []).append(i)
    weitere = {}
    w = NEBEN_DIR / "weitere_ausschluesse.csv"
    if w.exists():
        import csv
        for row in csv.DictReader(w.open(encoding="utf-8-sig"), delimiter=";"):
            if row["quelle_ziffer"].isdigit():
                weitere.setdefault(int(row["quelle_ziffer"]), []).append([row["kategorie"], row["satz"]])

    # Gegenprobe mit ziffer_index.json
    abw_index = []
    rev = {}
    for r in regeln:
        if r["t"] == "N":
            for x in r["zz"]:
                for sub in r["sz"]:
                    if sub != x:
                        rev.setdefault(x, set()).add(sub)
    for z, v in index.items():
        z = int(z)
        own = {x for i in je.get(z, []) if regeln[i]["t"] == "N" and z in regeln[i]["sz"] for x in regeln[i]["zz"]} - {z}
        soll = set(v["nicht_neben_explizit_unbedingt"]) | set(v["nicht_neben_explizit_bedingt"])
        if own != soll:
            abw_index.append((z, "nicht neben (eigene Regeln)", sorted(own ^ soll)[:8]))
        um = rev.get(z, set())           # Index führt die Gegenrichtung auch dann, wenn sie zusätzlich ausdrücklich geregelt ist
        if um != set(v["nicht_neben_umgekehrt_abgeleitet"]):
            abw_index.append((z, "nicht neben (umgekehrt abgeleitet)", sorted(um ^ set(v["nicht_neben_umgekehrt_abgeleitet"]))[:8]))
        nur = {x for i in je.get(z, []) if regeln[i]["t"] == "U" for x in regeln[i]["zz"]}
        soll_nur = {x for n in v["nur_neben"] for x in n["ziffern"]}
        for n in v["nur_neben"]:         # Bereiche („a-b“) löst der Index nicht auf
            for b in n["bereiche"]:
                a, e = (b[0], b[-1]) if isinstance(b, (list, tuple)) else (int(x) for x in str(b).split("-"))
                soll_nur |= {x for x in ziffern if a <= x <= e}
        if nur != soll_nur:
            abw_index.append((z, "nur neben", sorted(nur ^ soll_nur)[:8]))
    info.update(datei=f.name, regeln=regeln, je=je, weitere=weitere, unbekannt=unbekannt, abw_index=abw_index,
                typen=Counter(r["typ"] for r in roh), ebenen=Counter(r["ebene"] for r in roh), index=bool(index),
                n_weitere=sum(len(v) for v in weitere.values()))
    return info


def lese_gesetz(daten):
    """Gebührenverzeichnis des Entwurfs. Dient nur dem Abgleich (Gebühr, Bezeichnung,
    Abschnittscode) und liefert den Zusatztext je Ziffer. Zuordnungen kommen nie von hier."""
    dateien = sorted((INPUT / "gesetz").glob("*.xlsx"))
    info = {"datei": None}
    if not dateien:
        return info
    ws = openpyxl.load_workbook(dateien[0], data_only=True).active
    kopf = [norm_text(str(c.value)) for c in ws[1]]

    def spalte(*teile):
        for i, k in enumerate(kopf):
            if all(t.lower() in k.lower() for t in teile):
                return i
        raise ValueError(f"Spalte {teile} im Gebührenverzeichnis nicht gefunden: {kopf}")

    c_nr = max(i for i, k in enumerate(kopf) if k.lower().startswith("nummer"))   # jüngste Nummernspalte
    c_leg, c_zus, c_abs, c_bew = spalte("legende"), spalte("zusatz"), spalte("abschnitt"), spalte("bewertung")
    G, doppelt, je_code = {}, [], Counter()
    for r in ws.iter_rows(min_row=2, values_only=True):
        if r[c_nr] is None:
            continue
        if r[c_nr] in G:
            doppelt.append(r[c_nr])
        G[r[c_nr]] = r
        je_code[str(r[c_abs])] += 1

    m = re.search(r"_v(\d+)_(\d{4})(\d{2})(\d{2})", dateien[0].stem)
    info.update(datei=dateien[0].name, n=len(G), doppelt=doppelt, nummernspalte=kopf[c_nr],
                stand=(f"Gebührenverzeichnis v{m.group(1)}, Dateistand {m.group(4)}.{m.group(3)}.{m.group(2)}" if m else None),
                fehlt=[], gebuehr=[], text_gekuerzt=[], text_mit_zusatz=[], text_abw=[], zusatz={}, codes=OrderedDict())
    for r in daten["rows"]:
        g = G.get(r["z"])
        if g is None:
            info["fehlt"].append(r["z"])
            continue
        if dec(g[c_bew]) != r["_g"]:
            info["gebuehr"].append((r["z"], r["_g"], dec(g[c_bew])))
        a = norm_text(r["t"]).rstrip(",").strip()
        leg = norm_text(g[c_leg]).rstrip(",").strip()
        voll = norm_text(f"{g[c_leg] or ''} {g[c_zus] or ''}").rstrip(",").strip()
        if a != leg:
            if leg.startswith(a):
                info["text_gekuerzt"].append(r["z"])
            elif voll.startswith(a):
                info["text_mit_zusatz"].append(r["z"])
            else:
                info["text_abw"].append((r["z"], a, leg))
        if g[c_zus]:
            info["zusatz"][r["z"]] = zusatz_text(g[c_zus])
        info["codes"].setdefault((r["kap"], r["abs"]), Counter())[str(g[c_abs])] += 1
    info["je_code"] = je_code
    info["alle"] = {z: {"t": norm_text(g[c_leg]).rstrip(",").strip(), "zus": zusatz_text(g[c_zus]),
                        "g": dec(g[c_bew]), "code": str(g[c_abs])} for z, g in G.items()}
    # AB-IDs: Präfix (z. B. 02.03 aus 02.03-4) als Abschnittscode vorhanden?
    info["ab_praefix"] = {}
    for gr in daten["gruende"]:
        for ab in gr["ids"]:
            pre = ab.rsplit("-", 1)[0]
            info["ab_praefix"][ab] = (pre, je_code.get(pre, 0)) if re.match(r"\d", pre) else (pre, None)
    return info


# ---------------------------------------------------------------- PDF (optional)
def lese_pdf(daten):
    """Nur Wortlaut/Fundstellen. Keine Zuordnungen aus dem PDF ableiten."""
    pdfs = sorted(INPUT.glob("*.pdf"))
    info = {"datei": None, "fundstellen": {}, "kapiteltitel": {}, "stichprobe": [], "rundung": None, "stand": None}
    if not pdfs:
        return info
    pdf = pdfs[0]
    info["datei"] = pdf.name
    text = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], check=True,
                          capture_output=True, text=True).stdout
    seiten = text.split("\f")

    def norm(s):
        return re.sub(r"\s+", " ", s).strip()

    # AB-IDs: nur bei genau einem Treffer wird Wortlaut übernommen
    for g in daten["gruende"]:
        for ab in g["ids"]:
            pat = re.compile(r"(?<![\w.\-])" + re.escape(ab) + r"(?![\w\-]|\.\d)")
            treffer = [(nr, m.start()) for nr, s in enumerate(seiten, start=1) for m in pat.finditer(s)]
            eintrag = {"status": "nicht gefunden", "seiten": sorted({nr for nr, _ in treffer})}
            if len(treffer) == 1:
                nr, pos = treffer[0]
                eintrag.update(status="eindeutig", seite=nr, text=norm(seiten[nr - 1][pos:pos + 900]))
            elif treffer:
                eintrag["status"] = "mehrdeutig"
            info["fundstellen"][ab] = eintrag

    # Kapiteltitel: nur wenn genau ein Kandidat
    for kap in {k for k, _ in daten["abschnitte"]}:
        kand = {norm(m.group(1)) for s in seiten
                for m in re.finditer(rf"(?m)^\s*Kapitel\s+{kap}\s*[–:\-]?\s+([A-ZÄÖÜ][^\n]{{3,90}})$", s)}
        if len(kand) == 1:
            info["kapiteltitel"][kap] = kand.pop()

    # Stichprobe Gebühr/Bezeichnung
    ganz = norm(text)
    rows = {r["z"]: r for r in daten["rows"]}
    probe = list(STICHPROBE)
    alle = [r["z"] for r in daten["rows"]]
    for i in range(1, 8):
        probe.append(alle[i * len(alle) // 8])
    for z in dict.fromkeys(probe):
        r = rows.get(z)
        if not r:
            continue
        geb = format(r["_g"].quantize(Decimal("0.01")), "f").replace(".", ",")
        kurz = norm(r["t"])[:40]
        pos = [m.start() for m in re.finditer(re.escape(kurz), ganz)]
        geb_ok = any(geb in ganz[p:p + len(r["t"]) + 250] for p in pos)
        ziff_ok = any(str(z) in ganz[max(0, p - 40):p] for p in pos)
        info["stichprobe"].append({"z": z, "gebuehr": geb, "text_gefunden": bool(pos),
                                   "ziffer_davor": ziff_ok, "gebuehr_danach": geb_ok})
    m = re.search(r"[^.]{0,200}kaufmännisch[^.]{0,200}\.", ganz)
    info["rundung"] = m.group(0).strip() if m else None
    m = re.search(r"(Stand|Bearbeitungsstand)\s*:?\s*(\d{1,2}\.\s*\d{1,2}\.\s*\d{4}[^\n]{0,20})", text)
    info["stand"] = norm(m.group(0)) if m else None
    return info


# ---------------------------------------------------------------- Tests
def tests(daten, js=None, kap=None, gesetz=None, regeln=None):
    rows = {r["z"]: r for r in daten["rows"]}
    mus = daten["muster"]
    res = []

    def t(name, ok, ist):
        res.append((name, bool(ok), ist))

    def prof(z):
        r = rows[z]
        m = mus[r["m"]]
        return r, m, " · ".join(f"{k} ×{v}" for k, v in m["gruende"].items())

    t("Durch AB steigerfähige Ziffern (Matrix) = 1.999", len(daten["rows"]) == 1999, str(len(daten["rows"])))
    if kap and kap["datei"]:
        zr = {r[0]: r for r in js["rows"]}
        ohne = sum(1 for r in js["rows"] if r[6] < 0)
        t("Dashboard enthält alle Ziffern der Zuordnungsdatei (5.580) ohne Duplikate",
          len(js["rows"]) == len(zr) == kap["n"] == 5580, f"{len(js['rows'])} Zeilen, {len(zr)} eindeutig")
        t("Nicht durch AB steigerfähig = Gesamt − Matrix (3.581)", ohne == kap["n"] - len(daten["rows"]) == 3581, str(ohne))
        t("Alle Matrixziffern in der Zuordnungsdatei, Kapitel/Abschnitt identisch",
          not kap["fehlt_in_json"] and not kap["abw_abschnitt"],
          f"{len(kap['fehlt_in_json'])} fehlend, {len(kap['abw_abschnitt'])} abweichend")
        r = zr.get(4500)
        a = js["abschnitte"][r[1]] if r else None
        t("Ziffer 4500: Kapitel G, III. Psychotherapieverfahren …, 145,00 €, nicht durch AB steigerfähig",
          r and r[6] < 0 and r[3] == 14500 and a["kap"] == "G" and a["name"].startswith("III. Psychotherapieverfahren"),
          f"Kapitel {a['kap']} · {a['name']} · {fmt_euro(r[3])} · {'kein Steigerungsgrund' if r[6] < 0 else 'steigerfähig'}" if r else "fehlt")
        anz = Counter(len(js["muster"][r[6]]["gruende"]) if r[6] >= 0 else 0 for r in js["rows"])
        t("Anzahl möglicher AB-Gründe je Ziffer: 0 → 3.581 · 1 → 197 · 2 → 95 · 3 → 1.472 · 4 → 235",
          dict(anz) == {0: 3581, 1: 197, 2: 95, 3: 1472, 4: 235}, " · ".join(f"{k} → {anz[k]}" for k in sorted(anz)))
        t("Wortlaut der AB-Regel für alle 5 Gründe hinterlegt", all(g["wortlaut"] for g in js["gruende"]),
          " · ".join(f"{g['k']}: {len(g['wortlaut'])} Zeichen" for g in js["gruende"]))
        if regeln and regeln["datei"]:
            RG, je = regeln["regeln"], regeln["je"]

            def ziele(z, typ):
                return sorted({x for i in je.get(z, []) if RG[i]["t"] == typ and z in RG[i]["sz"] for x in RG[i]["zz"]})

            t("Nebeneinander – 2.539 Regeln, Typen wie in der README (1.106 / 1.343 / 52 / 29 / 2 / 4 / 3)",
              len(RG) == 2539 and dict(regeln["typen"]) == SOLL_REGELTYPEN,
              f"{len(RG)} Regeln; " + " · ".join(f"{k} {v}" for k, v in regeln["typen"].items()))
            t("Nebeneinander – Ziffer 1: nicht neben 2", ziele(1, "N") == [2], str(ziele(1, "N")))
            t("Nebeneinander – Ziffer 310: nur neben 306, 307, 308, 309", ziele(310, "U") == [306, 307, 308, 309], str(ziele(310, "U")))
            t("Nebeneinander – Ziffer 1200: nicht neben 1225, 1228 und laut Abschnitt-AB 4600, 4602, 4603, 4611, 4718, 4719, 4725, 4727, 4728, 4729",
              ziele(1200, "N") == [1225, 1228, 4600, 4602, 4603, 4611, 4718, 4719, 4725, 4727, 4728, 4729], str(ziele(1200, "N")))
            t("Nebeneinander – Ziffer 4525: nur neben 4500, 4501, 4503, 4505, 4506, 4508, 4510, 4511, 4513, 4515, 4518, 4520, 4523",
              ziele(4525, "U") == [4500, 4501, 4503, 4505, 4506, 4508, 4510, 4511, 4513, 4515, 4518, 4520, 4523], str(ziele(4525, "U")))
            t("Nebeneinander – Ziffer 1215: nur neben 1205/1208/1211/1212 und nicht neben 1214, 1333, 1334, 1335",
              ziele(1215, "U") == [1205, 1208, 1211, 1212] and ziele(1215, "N") == [1214, 1333, 1334, 1335],
              f"nur neben {ziele(1215, 'U')}; nicht neben {ziele(1215, 'N')}")
            t("Nebeneinander – alle in Regeln genannten Ziffern existieren", not regeln["unbekannt"], f"{len(regeln['unbekannt'])} unbekannt")
            t("Nebeneinander – Zuordnung je Ziffer stimmt mit ziffer_index.json überein", regeln["index"] and not regeln["abw_index"],
              f"{len(regeln['abw_index'])} Abweichungen")
            zus = [r[0] for r in js["rows"] if r[2].startswith("Zuschlag")]
            ohne = [z for z in zus if not any(RG[i]["t"] == "U" for i in je.get(z, []))]
            t("Nebeneinander – jede Ziffer, deren Bezeichnung mit „Zuschlag“ beginnt, hat eine „Nur neben“-Regel",
              not ohne, f"{len(zus)} Zuschlagsziffern, {len(ohne)} ohne Regel" + (f" (z. B. {ohne[:5]})" if ohne else ""))
        t("Jede nicht steigerfähige Ziffer hat eine Leistungsbezeichnung", all(r[2] for r in js["rows"]),
          f"{sum(1 for r in js['rows'] if not r[2])} ohne Text")
    t("Keine doppelten Ziffern", len(rows) == len(daten["rows"]), f"{len(rows)} eindeutig")
    je_kap = Counter(r["kap"] for r in daten["rows"])
    t("Steigerfähige Ziffern je Kapitel C=100 · D=2 · F=31 · L=1.705 · O=161", dict(je_kap) == SOLL_KAPITEL,
      " · ".join(f"{k}={je_kap[k]}" for k in SOLL_KAPITEL))
    t("Reihenfolge der Kapitel C, D, F, L, O", list(dict.fromkeys(k for k, _ in daten["abschnitte"])) == list(SOLL_KAPITEL),
      ", ".join(dict.fromkeys(k for k, _ in daten["abschnitte"])))
    t("23 Abschnitte mit steigerfähigen Ziffern", len(daten["abschnitte"]) == 23, str(len(daten["abschnitte"])))

    r, m, g = prof(1200)
    t("Ziffer 1200: 21,00 €, nur B ×1,5 → max. 31,50 €",
      r["_g"] == Decimal("21") and g == "B ×1,5" and r["c"][m["maxP"]] == 3150,
      f"{fmt_euro(int(r['_g'] * 100))}, {g} → {fmt_euro(r['c'][m['maxP']])}")
    r, m, g = prof(900)
    t("Ziffer 900: 27,49 €, nur G ×2,0 → max. 54,98 €",
      r["_g"] == Decimal("27.49") and g == "G ×2,0" and r["c"][m["maxP"]] == 5498,
      f"{fmt_euro(int(r['_g'] * 100))}, {g} → {fmt_euro(r['c'][m['maxP']])}")
    r, m, g = prof(5600)
    ist = [(x["f"], x["status"]) for x in m["moegl"]]
    soll = [("1,5", "p"), ("2,0", "p"), ("3,0", "p"), ("4,0", "p"), ("6,0", "t")]
    t("Ziffer 5600: 43,46 €; 1,5/2,0/3,0/4,0 praktisch, 6,0 nur theoretisch; 4,0 = 173,84 €; 6,0 = 260,76 €",
      r["_g"] == Decimal("43.46") and ist == soll and r["c"][m["maxP"]] == 17384 and r["c"][m["maxT"]] == 26076,
      f"{fmt_euro(int(r['_g'] * 100))}; " + " / ".join(f"{f}{'' if s == 'p' else ' (theor.)'}" for f, s in ist)
      + f"; praktisch {fmt_euro(r['c'][m['maxP']])}; theoretisch {fmt_euro(r['c'][m['maxT']])}")
    vert = Counter(mus[r["m"]]["moegl"][mus[r["m"]]["maxP"]]["f"] for r in daten["rows"])
    t("Verteilung max. praktischer Faktor (142/55/58/37/1.470/2/235)", dict(vert) == SOLL_VERTEILUNG,
      " · ".join(f"{k} → {vert.get(k, 0)}" for k in SOLL_VERTEILUNG))
    ids = [i for g in daten["gruende"] for i in g["ids"]]
    t("AB-IDs der Definitionszeile vollständig (11)", ids == SOLL_AB_IDS, " · ".join(ids))
    t("Faktoren der Definitionszeile G 2,0 · B 1,5 · S 2,0 · F 2,0 · V 1,5",
      [g["faktor"] for g in daten["gruende"]] == ["2,0", "1,5", "2,0", "2,0", "1,5"],
      " · ".join(f"{g['k']} {g['faktor']}" for g in daten["gruende"]))
    t("Excel in sich konsistent (Formeln M/U, Formatierung, Herleitung, Nachrechnung)", not daten["abw"],
      "keine Auffälligkeiten" if not daten["abw"] else f"{len(daten['abw'])} Auffälligkeiten")
    return res


# ---------------------------------------------------------------- Ausgabe
def lese_wortlaut() -> dict:
    """Wortlaut der AB-Regeln je Grund (input/ab_wortlaut.json), solange kein Entwurf mit AB vorliegt."""
    p = INPUT / "ab_wortlaut.json"
    return json.loads(p.read_text(encoding="utf-8"))["gruende"] if p.exists() else {}


def baue_json(daten, pdf, gesetz, kap, regeln):
    matrix = {r["z"]: r for r in daten["rows"]}
    wortlaut = lese_wortlaut()
    zus = gesetz.get("zusatz", {})
    alle = gesetz.get("alle", {})
    abs_liste, abs_idx, titel, rows = [], {}, {}, []

    def idx(k, name):
        if (k, name) not in abs_idx:
            abs_idx[(k, name)] = len(abs_liste)
            abs_liste.append({"kap": k, "name": name, "n": 0, "ab": 0})
        return abs_idx[(k, name)]

    if kap["datei"]:
        for z, v in kap["K"].items():           # Reihenfolge der Zuordnungsdatei
            titel[v["kapitel"]] = v["kapitel_name"]
            i = idx(v["kapitel"], kap["abs_name"](v))
            abs_liste[i]["n"] += 1
            r = matrix.get(z)
            if r:
                abs_liste[i]["ab"] += 1
                rows.append([z, i, r["t"], int(r["_g"] * 100), r["bauch"], r["ct"], r["m"], r["c"], zus.get(z, ""), v["seite"]])
            else:
                g = alle.get(z, {})
                rows.append([z, i, g.get("t", ""), int(v["_g"] * 100), "–", "–", -1, [], g.get("zus", ""), v["seite"]])
        for z in kap["fehlt_in_json"]:           # Matrixziffern ohne Zuordnung nicht verlieren
            r = matrix[z]
            i = idx(r["kap"], r["abs"])
            abs_liste[i]["n"] += 1
            abs_liste[i]["ab"] += 1
            rows.append([z, i, r["t"], int(r["_g"] * 100), r["bauch"], r["ct"], r["m"], r["c"], zus.get(z, ""), None])
    else:
        for r in daten["rows"]:
            i = idx(r["kap"], r["abs"])
            abs_liste[i]["n"] += 1
            abs_liste[i]["ab"] += 1
            rows.append([r["z"], i, r["t"], int(r["_g"] * 100), r["bauch"], r["ct"], r["m"], r["c"], zus.get(r["z"], ""), None])
    for row in rows:
        row += [regeln.get("je", {}).get(row[0], []), regeln.get("weitere", {}).get(row[0], [])]
    kapitel = [{"k": k, "titel": titel.get(k) or pdf["kapiteltitel"].get(k),
                "n": sum(a["n"] for a in abs_liste if a["kap"] == k)}
               for k in dict.fromkeys(a["kap"] for a in abs_liste)]
    gruende = []
    for g in daten["gruende"]:
        d = {k: v for k, v in g.items() if not k.startswith("_")}
        d["fundstellen"] = [dict(id=i, **pdf["fundstellen"].get(i, {"status": "pdf fehlt"})) for i in g["ids"]]
        d["wortlaut"] = wortlaut.get(g["k"], "")
        gruende.append(d)
    muster = [{k: v for k, v in m.items() if not k.startswith("_")} | {
        "moegl": [{k: v for k, v in x.items() if not k.startswith("_")} for x in m["moegl"]]}
        for m in daten["muster"]]
    return {
        "titel": daten["titel"], "hinweise": daten["hinweise"],
        "pdf": {"datei": pdf["datei"], "stand": pdf["stand"]},
        "gesetz": {"datei": gesetz["datei"], "stand": gesetz.get("stand")},
        "gruende": gruende, "kapitel": kapitel, "abschnitte": abs_liste, "muster": muster, "rows": rows,
        "regeln": regeln.get("regeln", []),
    }


def schreibe_bericht(daten, pdf, gesetz, kap, regeln, res, ui, excel_name, daten_alle=()):
    L = []
    ok = sum(1 for _, o, _ in res if o)
    L += ["# QS-Bericht – GOÄneu Steigerungsdashboard", "",
          f"- Quelle Zuordnungen: `input/{excel_name}`, Blatt „{SHEET}“",
          f"- Gebührenverzeichnis des Entwurfs (Excel): {'`input/gesetz/' + gesetz['datei'] + '`' if gesetz['datei'] else '**lag beim Build nicht vor**'}",
          f"- Zuordnung Ziffer → Kapitel/Abschnitt (JSON): {'`input/kapitel/' + kap['datei'] + '`' if kap['datei'] else '**lag beim Build nicht vor**'}",
          f"- Kombinationsregeln (Nebeneinanderberechnung): {'`input/neben/` (regeln.json, ziffer_index.json, weitere_ausschluesse.csv)' if regeln['datei'] else '**lagen beim Build nicht vor**'}",
          f"- Gesetzesentwurf mit Allgemeinen Bestimmungen (PDF): {'`input/' + pdf['datei'] + '`' if pdf['datei'] else '**lag beim Build nicht vor**'}",
          f"- Abnahmetests Daten: **{ok} von {len(res)} bestanden**", "",
          "## 1. Abnahmetests (Daten)", "", "| Test | Ergebnis | Ist-Wert |", "|---|---|---|"]
    for name, o, ist in res:
        L.append(f"| {name} | {'✅ bestanden' if o else '❌ FEHLER'} | {ist} |")

    L += ["", "## 2. Abnahmetests (Oberfläche, Playwright)", ""]
    if ui:
        L += ["| Test | Ergebnis | Ist-Wert |", "|---|---|---|"]
        for c in ui["checks"]:
            L.append(f"| {c['name']} | {'✅ bestanden' if c['ok'] else '❌ FEHLER'} | {c['ist']} |")
        L += ["", "Screenshots: " + ", ".join(f"`output/screenshots/{s}`" for s in ui["screenshots"])]
    else:
        L.append("Nicht ausgeführt (Aufruf mit `--ui`).")

    L += ["", "## 3. Verifikation des Excel-Aufbaus", "",
          f"- Kopfblock Zeilen 1–11, Tabellenkopf Zeile {HEADER_ROW}, {len(daten['rows'])} Datenzeilen "
          f"(Ziffer {daten['rows'][0]['z']} bis {daten['rows'][-1]['z']}).",
          f"- {len(daten['muster'])} Kombinationsmuster: "
          + " · ".join(f"{m['kuerzel']} ({m['_n']})" for m in daten["muster"]) + ".",
          "- Kennzeichnung praktisch/theoretisch wurde aus der Zellformatierung gelesen (`font.strike`, "
          "Schrift-/Füllfarbe) und je Muster gegen die Spalte „Herleitung“ sowie gegen eine eigene "
          "Nachrechnung aller Teilmengen geprüft (theoretisch = Kombination enthält S×F oder B×F, Zelle A8).",
          "- Spalten M und U (Formeln) wurden gegen die Regelspalten H–L nachgerechnet; S gegen Prüfmerkmal "
          "Bauchraum, V gegen Prüfmerkmal CT/MRT.", ""]
    if daten["abw"]:
        L.append(f"**Auffälligkeiten innerhalb der Excel ({len(daten['abw'])}):**")
        L += [f"- {a}" for a in daten["abw"][:200]]
    else:
        L.append("Auffälligkeiten innerhalb der Excel: **keine**.")

    offen = []
    L += ["", "## 4. Abgleich Steigerungsmatrix ↔ Gebührenverzeichnis (Excel)", ""]
    if not gesetz["datei"]:
        L.append("Nicht durchführbar: kein Gebührenverzeichnis in `input/gesetz/`.")
        offen.append("Gebührenverzeichnis fehlt – Abgleich von Gebühr und Bezeichnung nicht durchgeführt.")
    else:
        n = len(daten["rows"])
        ident = n - len(gesetz["fehlt"]) - len(gesetz["text_gekuerzt"]) - len(gesetz["text_mit_zusatz"]) - len(gesetz["text_abw"])
        L += [f"Statt einer Stichprobe wurden **alle {n} Ziffern** gegen das Gebührenverzeichnis geprüft "
              f"({gesetz['n']} Nummern, Spalte „{gesetz['nummernspalte']}“, {gesetz['stand'] or 'Stand unbekannt'}; "
              "Stand aus dem Dateinamen abgeleitet).", "",
              "| Prüfung | Ergebnis |", "|---|---|",
              f"| Ziffer im Gebührenverzeichnis vorhanden | {n - len(gesetz['fehlt'])} von {n}" + (f" – **fehlend: {gesetz['fehlt']}**" if gesetz["fehlt"] else "") + " |",
              f"| Gebühr identisch (Matrix Spalte E = Bewertung) | {n - len(gesetz['fehlt']) - len(gesetz['gebuehr'])} von {n} |",
              f"| Bezeichnung identisch mit „Legenden“ (ohne Leerraum/Schlusskomma) | {ident} |",
              f"| Bezeichnung in der Matrix gekürzt (Anfang der Legende) | {len(gesetz['text_gekuerzt'])} |",
              f"| Bezeichnung der Matrix = Legende + (Anfang des) Zusatz | {len(gesetz['text_mit_zusatz'])} |",
              f"| Bezeichnung inhaltlich abweichend | {len(gesetz['text_abw'])} |",
              f"| Doppelte Nummern im Gebührenverzeichnis | {len(gesetz['doppelt'])} |", ""]
        for z, a, b in gesetz["gebuehr"]:
            L.append(f"- **Abweichung Gebühr** Ziffer {z}: Matrix {a} € ≠ Gebührenverzeichnis {b} €")
            offen.append(f"Ziffer {z}: Gebühr weicht ab (Matrix {a} €, Gebührenverzeichnis {b} €) – Dashboard rechnet mit dem Matrixwert.")
        for z, a, b in gesetz["text_abw"]:
            L.append(f"- **Abweichung Bezeichnung** Ziffer {z}: Matrix „{a}“ ≠ Gebührenverzeichnis „{b}“")
            offen.append(f"Ziffer {z}: Bezeichnung weicht inhaltlich ab – Dashboard zeigt den Matrixtext.")
        if gesetz["text_gekuerzt"] or gesetz["text_mit_zusatz"]:
            L += ["Die gekürzten bzw. um den Zusatz ergänzten Bezeichnungen sind redaktionelle Unterschiede der "
                  "Kurzbezeichnung, keine inhaltlichen Abweichungen. Betroffene Ziffern: "
                  + ", ".join(map(str, sorted(gesetz["text_gekuerzt"] + gesetz["text_mit_zusatz"]))) + ".", ""]
        L += ["### Abschnitte der Matrix ↔ Abschnittscodes des Gebührenverzeichnisses", "",
              "| Kapitel · Abschnitt (Matrix) | Code(s) | Ziffern in der Matrix | Nummern im Gebührenverzeichnis |", "|---|---|---|---|"]
        for (k, a), cnt in gesetz["codes"].items():
            codes = sorted(cnt)
            code_txt = codes[0] if len(codes) == 1 else f"{codes[0]} – {codes[-1]} ({len(codes)} Codes)"
            L.append(f"| {k} · {a} | {code_txt} | {sum(cnt.values())} | {sum(gesetz['je_code'][c] for c in codes)} |")
        L += ["", "Die Matrix enthält je Abschnitt weniger Ziffern als das Gebührenverzeichnis (laut Matrix sind u. a. "
              "Zuschläge ausgenommen; C III, D I und O I gelten nur für Teilbereiche). Ob die Auswahl vollständig ist, "
              "wurde nicht bewertet – siehe offene Punkte.", "",
              "### AB-IDs", "",
              "Das Gebührenverzeichnis enthält nur Nummern, Legenden, Zusätze, leistungsbezogene Abrechnungsbestimmungen, "
              "Abschnittscode und Bewertung. **Die Allgemeinen Bestimmungen (Wortlaut der AB-Regeln) sind darin nicht "
              "enthalten.** Geprüft werden konnte nur, ob der Abschnittscode vor dem Bindestrich existiert:", "",
              "| AB-ID | Abschnittscode | im Gebührenverzeichnis | Wortlaut |", "|---|---|---|---|"]
        for ab, (pre, cnt) in gesetz["ab_praefix"].items():
            vorh = "kein Abschnittscode (Kapitel-Bestimmung)" if cnt is None else (f"ja ({cnt} Nummern)" if cnt else "**nein**")
            L.append(f"| {ab} | {pre} | {vorh} | nicht enthalten |")
        offen += [
            "**Wortlaut der AB-Regeln nicht am Entwurf geprüft:** Der Wortlaut je Steigerungsgrund stammt aus "
            "`input/ab_wortlaut.json` (vom Auftraggeber geliefert, unverändert übernommen) und wird im Dashboard beim "
            "Überfahren der Grund-Tags und im Detailbereich gezeigt. Es gibt einen Text je Grund, nicht je AB-ID: Ob er "
            "für alle 11 AB-IDs (" + ", ".join(SOLL_AB_IDS) + ") wortgleich gilt, ist nicht geprüft; Seitenzahlen fehlen. "
            "Im Text zu G steht „Xa-lnhibitoren“ mit kleinem L statt großem I (vermutlich Kopierfehler, nicht korrigiert).",
            "**Rundungsregel** (Matrix verweist auf Kap. A Nr. 23): im Gebührenverzeichnis nicht enthalten, daher nicht "
            "geprüft. Gerechnet wird kaufmännisch auf den Cent (Decimal, ROUND_HALF_UP).",
            *([] if kap["datei"] else ["**Kapiteltitel** (C, D, F, L, O): im Gebührenverzeichnis nicht enthalten; die Navigation zeigt nur die Buchstaben."]),
            "**Stand des Entwurfs:** nur aus dem Dateinamen des Gebührenverzeichnisses abgeleitet (v6, 15.07.2026). "
            "Bitte bestätigen oder offiziellen Stand nennen.",
            "**Vollständigkeit der Matrix:** Die Matrix enthält je Abschnitt weniger Ziffern als das Gebührenverzeichnis "
            "(Tabelle in Abschnitt 4). Ob alle steigerungsfähigen Hauptleistungen erfasst sind, ist eine fachliche Frage "
            "und wurde nicht geprüft oder korrigiert.",
            "**Zusatztext im Detailbereich:** Zur vollständigen Leistungsbezeichnung wird der „Zusatz“ aus dem "
            "Gebührenverzeichnis angezeigt (gekennzeichnet). Falls nicht gewünscht, bitte melden.",
        ]

    L += ["", "## 4a. Zuordnungsdatei Ziffer → Kapitel/Abschnitt (alle GO-Ziffern)", ""]
    if not kap["datei"]:
        L.append("Nicht vorhanden – das Dashboard zeigt nur die Ziffern der Steigerungsmatrix.")
    else:
        n_ab = len(daten["rows"])
        L += [f"Die Zuordnungsdatei enthält **{kap['n']} Ziffern**. Davon stehen {n_ab} in der Steigerungsmatrix; die übrigen "
              f"**{kap['n'] - n_ab} Ziffern** werden im Dashboard als „Nicht durch AB steigerfähig“ geführt "
              "(Bezeichnung und Zusatz aus dem Gebührenverzeichnis, Kapitel, Abschnitt, Seite und Gebühr aus der Zuordnungsdatei).", "",
              "| Prüfung | Ergebnis |", "|---|---|",
              "| Nummern identisch mit dem Gebührenverzeichnis | " + ("ja" if not kap["nur_json"] and not kap["nur_gv"] else
                f"nein – nur JSON: {kap['nur_json'][:20]}, nur Gebührenverzeichnis: {kap['nur_gv'][:20]}") + " |",
              f"| Matrixziffern in der Zuordnungsdatei vorhanden | {n_ab - len(kap['fehlt_in_json'])} von {n_ab} |",
              f"| Kapitel/Abschnitt der Matrix = Zuordnungsdatei | {n_ab - len(kap['abw_abschnitt'])} von {n_ab} |",
              f"| Gebühr Matrix = Zuordnungsdatei | {n_ab - len(kap['abw_gebuehr_matrix'])} von {n_ab} |",
              f"| Gebühr Zuordnungsdatei = Gebührenverzeichnis | {kap['n'] - len(kap['abw_gebuehr_gv'])} von {kap['n']} |", ""]
        for z, a, b in kap["abw_abschnitt"][:50]:
            L.append(f"- **Abweichung Abschnitt** Ziffer {z}: Matrix „{a}“ ≠ Zuordnungsdatei „{b}“")
            offen.append(f"Ziffer {z}: Kapitel/Abschnitt weicht zwischen Matrix und Zuordnungsdatei ab – Dashboard folgt der Zuordnungsdatei.")
        for z, a, b in kap["abw_gebuehr_matrix"][:50]:
            L.append(f"- **Abweichung Gebühr** Ziffer {z}: Matrix {a} € ≠ Zuordnungsdatei {b} €")
            offen.append(f"Ziffer {z}: Gebühr weicht zwischen Matrix ({a} €) und Zuordnungsdatei ({b} €) ab – Dashboard rechnet mit dem Matrixwert.")
        for z, a, b in kap["abw_gebuehr_gv"][:50]:
            L.append(f"- **Abweichung Gebühr** Ziffer {z}: Zuordnungsdatei {str(a).replace('.', ',')} € ≠ Gebührenverzeichnis {b} "
                     f"(kaufmännisch gerundet {str(b.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)).replace('.', ',')} €)")
            offen.append(f"**Ziffer {z}: Gebühr unklar.** Zuordnungsdatei nennt {str(a).replace('.', ',')} €, das Gebührenverzeichnis "
                         f"den ungerundeten Wert {b} (gerundet {str(b.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)).replace('.', ',')} €). "
                         "Das Dashboard zeigt den Wert der Zuordnungsdatei. Bitte klären.")
        if kap["abw_code"]:
            L += ["", "Abschnittscodes, die sich zwischen Zuordnungsdatei und Gebührenverzeichnis unterscheiden "
                  "(nur zur Information, das Dashboard verwendet die Codes nicht):", "",
                  "| Kapitel · Abschnitt | Code Zuordnungsdatei | Code Gebührenverzeichnis | Ziffern |", "|---|---|---|---|"]
            for (k, a, c1, c2), n in kap["abw_code"].items():
                L.append(f"| {k} · {a} | {c1} | {c2} | {n} |")
        offen += [
            "**„Nicht durch AB steigerfähig“ ist ein Umkehrschluss:** So gekennzeichnet sind alle Ziffern der Zuordnungsdatei, "
            "die nicht in der Steigerungsmatrix stehen. Die Matrix enthält laut eigener Beschreibung nur Hauptleistungen, für die "
            "mindestens ein Erhöhungsgrund greift (Zuschläge ausgenommen). Ob diese Auswahl vollständig ist, wurde nicht geprüft.",
        ]

    L += ["", "## 4c. Nebeneinanderberechnung („Nicht neben“ / „Nur neben“)", ""]
    if not regeln["datei"]:
        L.append("Nicht vorhanden: `input/neben/regeln.json` fehlt, der Reiter bleibt leer.")
    else:
        RG, je = regeln["regeln"], regeln["je"]
        zn = sum(1 for v in je.values() if any(RG[i]["t"] == "N" for i in v))
        zu = sum(1 for v in je.values() if any(RG[i]["t"] == "U" for i in v))
        L += ["Der Reiter beruht **ausschließlich** auf dem gelieferten Paket `input/neben/` (`regeln.json`, `ziffer_index.json`, "
              "`weitere_ausschluesse.csv`, Beschreibung in `README.md`). Die frühere eigene Textauswertung der Spalte "
              "„Abrechnungsbestimmung“ ist entfernt. Das Build-Skript leitet keine Regeln ab, es ordnet sie nur den Ziffern zu: "
              "Eine Regel steht bei jeder ihrer Subjekt-Ziffern; ist das Subjekt nur als Text beschrieben, bei der Ziffer, in "
              "deren Text sie steht.", "",
              "| Kennzahl | Wert |", "|---|---|",
              f"| Regeln gesamt | {len(RG)} |"]
        L += [f"| … Typ {k} | {v} |" for k, v in regeln["typen"].items()]
        L += [f"| … Ebene {k} | {v} |" for k, v in regeln["ebenen"].items()]
        L += [f"| Ziffern mit „Nicht neben“-Regel | {zn} |", f"| Ziffern mit „Nur neben“-Regel | {zu} |",
              f"| Ziffern ohne beide Regeln | {len(daten_alle) - len({z for z, v in je.items() if any(RG[i]['t'] in 'NU' for i in v)})} |",
              f"| Regeln mit Bedingung (Feld `bedingung`) | {sum(1 for r in RG if r['bd'])} |",
              f"| Regeln ohne einzelne Ziel-Ziffer (nur Abschnitt/Kapitel/Freitext) | {sum(1 for r in RG if r['t'] in 'NU' and not r['zz'])} |",
              f"| Weitere Ausschluss-Sätze ohne „neben“ (nur im Detailbereich) | {regeln['n_weitere']} |",
              f"| Genannte Ziffern, die es nicht gibt | {len(regeln['unbekannt'])} |",
              f"| Abweichungen zwischen eigener Zuordnung und `ziffer_index.json` | {len(regeln['abw_index'])} |", ""]
        for z, was, diff in regeln["abw_index"][:40]:
            L.append(f"- Ziffer {z}: {was} – Unterschied {diff}")
            offen.append(f"Nebeneinander – Ziffer {z}: Zuordnung „{was}“ weicht von `ziffer_index.json` ab.")
        offen += [
            "**Nebeneinander – zwei Tags:** Eigene Tags gibt es nur für „Nicht neben“ und „Nur neben“. Die Typen „neben erlaubt“, "
            "„neben mit Begründung“ und „neben mit Abschlag“ stehen im Detailbereich und sind über den Filter „Regelart“ "
            "erreichbar. Falls eigene Tags gewünscht sind, bitte melden.",
            "**Nebeneinander – Gegenrichtung:** Laut README ist „umgekehrt abgeleitet“ eine Ableitung, kein Gesetzeswortlaut. Sie "
            "wird nur mit dem Schalter „Nennungen bei anderen Ziffern einbeziehen“ (Standard: aus) mitgezählt und steht im "
            "Detailbereich getrennt unter „In Regeln anderer Ziffern genannt“. Ob sie rechtlich gilt, ist fachlich zu bewerten.",
            "**Nebeneinander – Regeln ohne einzelne Ziffern:** Regeln aus Allgemeinen Bestimmungen, deren Subjekt ein ganzes "
            "Kapitel, ein Abschnitt oder Freitext ist (z. B. Inklusionslisten, Zuschläge zu Abschnitten mit Gebührengrenze), "
            "werden nicht in einzelne Ziffern aufgelöst. Sie erscheinen im Detailbereich unter „Allgemeine Bestimmungen des "
            "Kapitels“ und in der Gesamtliste „Regeln aus Allgemeinen Bestimmungen“.",
            "**Nebeneinander – Bedingungen** sind laut README im Wortlaut übernommen, nicht ausgewertet. Das Dashboard markiert "
            "solche Regeln mit ⚑ und zeigt die Bedingung an.",
            "**Nebeneinander – Sitzungsbezug (Kapitel A Nr. 8):** Ausschlüsse beziehen sich auf dieselbe Sitzung; steht als Hinweis "
            "über der Liste, wird aber nicht je Regel ausgewertet.",
        ]

    L += ["", "## 4b. Abgleich mit dem PDF (Allgemeine Bestimmungen)", ""]
    if not pdf["datei"]:
        L.append("Nicht durchgeführt: kein PDF in `input/`. Die PDF-Auswertung im Build-Skript (Suche der AB-IDs mit "
                 "Seitenzahl, Kapiteltitel) ist vorbereitet, aber mangels Datei nicht erprobt.")
    else:
        L += ["### AB-IDs", "", "| AB-ID | Status | Seite(n) |", "|---|---|---|"]
        for ab, f in pdf["fundstellen"].items():
            L.append(f"| {ab} | {f['status']} | {', '.join(map(str, f['seiten'])) or '–'} |")
            if f["status"] != "eindeutig":
                offen.append(f"AB-ID {ab}: im PDF {f['status']} – Wortlaut nicht übernommen, bitte Fundstelle benennen.")
        L += ["", "### Stichprobe Gebühr/Bezeichnung", "",
              "| Ziffer | Gebühr (Excel) | Bezeichnung gefunden | Ziffer davor | Gebühr danach |", "|---|---|---|---|---|"]
        for s in pdf["stichprobe"]:
            j = lambda b: "ja" if b else "**nein**"
            L.append(f"| {s['z']} | {s['gebuehr']} € | {j(s['text_gefunden'])} | {j(s['ziffer_davor'])} | {j(s['gebuehr_danach'])} |")
            if not (s["text_gefunden"] and s["gebuehr_danach"]):
                offen.append(f"Stichprobe Ziffer {s['z']}: Bezeichnung oder Gebühr im PDF nicht automatisch bestätigt – bitte manuell prüfen.")
        L += ["", f"Kapiteltitel übernommen: {pdf['kapiteltitel'] or 'keine (nicht eindeutig)'}",
              f"Rundungsregel (Textstelle): {pdf['rundung'] or 'nicht gefunden'}",
              f"Stand des Entwurfs: {pdf['stand'] or 'nicht gefunden'}"]
        for kap in SOLL_KAPITEL:
            if kap not in pdf["kapiteltitel"]:
                offen.append(f"Kapiteltitel {kap}: im PDF nicht eindeutig – Navigation zeigt nur den Buchstaben.")
        if not pdf["rundung"]:
            offen.append("Rundungsregel (Kap. A Nr. 23) im PDF nicht automatisch gefunden – bitte manuell prüfen.")
        if not pdf["stand"]:
            offen.append("Stand des Entwurfs im PDF nicht automatisch gefunden.")

    offen += [
        "**Multiplikationsannahme:** Die Excel multipliziert mehrere Gründe; der Entwurf regelt die Kumulation "
        "laut Excel-Hinweis nicht ausdrücklich. Das Dashboard übernimmt die Annahme und weist sie in der "
        "Hinweisleiste und im Szenario aus. Fachliche Bestätigung steht aus.",
        "**Mehrfachauswahl der Grund-Chips:** umgesetzt als UND-Verknüpfung (Ziffer muss alle gewählten Gründe "
        "haben). Falls ODER gewünscht ist, bitte melden.",
        "**Schalter „Theoretische Kombinationen einbeziehen“:** umgesetzt so, dass max. Faktor, max. Gebührensatz, "
        "Faktorfilter und CSV dann den theoretischen Höchstwert verwenden. Bitte bestätigen.",
        "**Prüfmerkmale Bauchraum und CT/MRT** sind laut Excel per Stichwort vorbelegt („Indiz“). Das Dashboard "
        "übernimmt die Vorbelegung unverändert und zeigt sie im Detailbereich an; eine fachliche Prüfung der "
        "Vorbelegung ist nicht Teil dieses Builds.",
    ]
    L += ["", "## 5. Offene Punkte", ""] + [f"{i}. {o}" for i, o in enumerate(offen, 1)]
    L += ["", "## 6. Reproduktion", "", "```bash", "python3 build/build.py --ui", "```", ""]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(L), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ui", action="store_true", help="UI-Tests und Screenshots mit Playwright (Node) ausführen")
    args = ap.parse_args()

    excels = sorted(INPUT.glob("*.xlsx"))
    if not excels:
        sys.exit("Keine Excel-Datei in input/ gefunden.")
    daten = lese_excel(excels[0])
    pdf = lese_pdf(daten)
    gesetz = lese_gesetz(daten)
    kap = lese_kapitel(daten, gesetz)
    regeln = lese_regeln({int(z) for z in kap["K"]} if kap["datei"] else {r["z"] for r in daten["rows"]})
    js_obj = baue_json(daten, pdf, gesetz, kap, regeln)
    res = tests(daten, js_obj, kap, gesetz, regeln)

    js = json.dumps(js_obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8").replace("/*__DATA__*/", js)
    DIST.parent.mkdir(parents=True, exist_ok=True)
    DIST.write_text(html, encoding="utf-8")

    ui = None
    if args.ui:
        p = subprocess.run(["node", str(ROOT / "build" / "qs_ui.js"), str(DIST), str(ROOT / "output")],
                           capture_output=True, text=True)
        if p.returncode not in (0, 1) or not UI_JSON.exists():
            print(p.stdout, p.stderr, file=sys.stderr)
            sys.exit("UI-Tests konnten nicht ausgeführt werden.")
        ui = json.loads(UI_JSON.read_text(encoding="utf-8"))
        UI_JSON.unlink()

    schreibe_bericht(daten, pdf, gesetz, kap, regeln, res, ui, excels[0].name, [r[0] for r in js_obj["rows"]])
    for name, ok, ist in res:
        print(("OK   " if ok else "FAIL ") + name + "  →  " + ist)
    for c in (ui or {}).get("checks", []):
        print(("OK   " if c["ok"] else "FAIL ") + "[UI] " + c["name"] + "  →  " + str(c["ist"]))
    print(f"\n{DIST.relative_to(ROOT)}  ({DIST.stat().st_size / 1024:.0f} KB)\n{REPORT.relative_to(ROOT)}")
    if not all(o for _, o, _ in res) or any(not c["ok"] for c in (ui or {}).get("checks", [])):
        sys.exit(1)


if __name__ == "__main__":
    main()
