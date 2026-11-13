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


# ---------------------------------------------------------------- Mapping alte GOÄ -> GOÄneu
MAP_DIR = INPUT / "mapping"
SOLL_MAP_STATUS = {"SICHER": 522, "PLAUSIBEL": 816, "UNSICHER": 765, "KEINE_ENTSPRECHUNG_ERKENNBAR": 667, "SAMMELPOSITION": 61}
MAP_STATUS_TEXT = {
    "SICHER": "Wahrscheinlichkeit ab 80 %: Zuordnung kann übernommen werden (nicht fehlerfrei).",
    "PLAUSIBEL": "Wahrscheinlichkeit 50 bis 79 %: fachlich gegenprüfen.",
    "UNSICHER": "Wahrscheinlichkeit 25 bis 49 %: nur ein Vorschlag.",
    "KEINE_ENTSPRECHUNG_ERKENNBAR": "Wahrscheinlichkeit unter 25 %: vermutlich entfallen, neu zugeschnitten oder in einer anderen Ziffer aufgegangen.",
    "SAMMELPOSITION": "Sammelposition (z. B. „Ähnliche Untersuchungen“): keine 1:1-Zuordnung möglich.",
}


def lese_mapping(neu_gebuehr: dict) -> dict:
    """Mapping-Paket (input/mapping) lesen. Wahrscheinlichkeit, Status und Bemerkung werden unverändert übernommen;
    maßgeblich ist `neu_ziffern_final` (Nutzervorgabe vor automatischem Vorschlag)."""
    info = {"datei": None}
    fj, fc = MAP_DIR / "mapping_alt_zu_neu.json", MAP_DIR / "mapping_alt_zu_neu.csv"
    if not fj.exists() or not fc.exists():
        return info
    import csv
    roh = json.loads(fj.read_text(encoding="utf-8"))
    zeilen = {r["alt_ziffer"]: r for r in csv.DictReader(fc.open(encoding="utf-8-sig"), delimiter=";")}
    alt, unbekannt, ohne_csv = [], [], []
    for a in roh:
        z = a["alt_ziffer"]
        c = zeilen.get(z)
        if c is None:
            ohne_csv.append(z)
            c = {"neu_ziffern_final": "|".join(x["neu"] for x in a["neu"] if x["neu"]), "nutzer_vorgabe_neu": "", "alt_anmerkung": ""}
        p_je = {x["neu"]: x["p"] for x in a["neu"] if x["neu"]}
        final = [x for x in c["neu_ziffern_final"].split("|") if x]
        vorgabe = bool(c["nutzer_vorgabe_neu"])
        alt_eur = dec(a["alt_euro_1fach"]) if a["alt_euro_1fach"] is not None else None
        neu = []
        for x in final:
            n = int(x)
            if n not in neu_gebuehr:
                unbekannt.append((z, n))
                continue
            faktor = None
            if alt_eur:
                faktor = format((Decimal(neu_gebuehr[n]) / 100 / alt_eur).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f").replace(".", ",")
            neu.append([n, p_je.get(x), faktor])
        status, p = a["status"], a["wahrscheinlichkeit"]
        # Begründung: Bemerkung des Pakets, sonst aus dessen Feldern zusammengesetzt (keine eigene Bewertung)
        teile = []
        if vorgabe:
            auto = [x["neu"] for x in a["neu"] if x["neu"]]
            zusatz = [x for x in final if x not in auto]
            teile.append("Zuordnung laut Nutzervorgabe (PSY-Tabelle)" + (f"; automatisch nicht erkannt: {', '.join(zusatz)}" if zusatz else "; deckt sich mit dem automatischen Vorschlag") + ".")
        if a["bemerkung"]:
            teile.append(a["bemerkung"].rstrip(".") + ".")
        if a["quelle"] == "manuell geprüft":
            teile.append("Manuell geprüft; die Wahrscheinlichkeit ist eine fachliche Einschätzung.")
        else:
            teile.append(f"Automatisch über Textähnlichkeit zwischen alter Kurzbezeichnung und neuer Legende zugeordnet (Score {str(a['score_top1']).replace('.', ',')}), gewichtet mit Fachgebiet und Gebührenplausibilität.")
        teile.append(MAP_STATUS_TEXT.get(status, ""))
        alt.append([z, a["alt_abschnitt"], a["alt_leistung"], a["alt_punkte"],
                    None if alt_eur is None else int((alt_eur * 100).to_integral_value(rounding=ROUND_HALF_UP)),
                    status, p, a["verhaeltnis"], "Nutzervorgabe" if vorgabe else a["quelle"], " ".join(t for t in teile if t),
                    neu, [[int(k["neu"]), k["score"]] for k in a["weitere_kandidaten"] if k["neu"] and int(k["neu"]) in neu_gebuehr and k["neu"] not in final],
                    c["alt_anmerkung"]])
    # Kapitelüberschriften und Stichprobe aus der alten GOÄ (PDF)
    titel, pdf_info = {}, {"datei": None}
    pdfs = sorted((INPUT / "goae_alt").glob("*.pdf"))
    if pdfs:
        text = subprocess.run(["pdftotext", "-layout", str(pdfs[0]), "-"], check=True, capture_output=True, text=True).stdout
        zl = text.splitlines()
        for i, line in enumerate(zl):
            m = re.match(r"^\s+([A-P])\.\s+(\S.*?)\s*(\.{4,}\s*\d+)?\s*$", line)
            if m and m.group(1) not in titel:
                t = m.group(2).strip()
                if not m.group(3) and i + 1 < len(zl):
                    t += " " + re.sub(r"\.{4,}\s*\d+\s*$", "", zl[i + 1]).strip()
                titel[m.group(1)] = t
        flach = re.sub(r"\s+", " ", text)
        mit_eur = [a for a in alt if a[4] is not None]
        ok = sum(1 for a in mit_eur if re.search(r"(?<![\d,])" + re.escape(fmt_euro(a[4])[:-2]) + r"(?![\d])", flach)
                 and re.search(r"(?<![\d.])" + re.escape(a[0].split(".")[0]) + r"(?![\d])", flach))
        m = re.search(r"Stand:\s*([A-ZÄÖÜa-zäöü]+ \d{4})", text)
        pdf_info = {"datei": pdfs[0].name, "stand": m.group(1) if m else None, "geprueft": len(mit_eur), "gefunden": ok, "seiten": text.count("\f")}
    neu_zugeordnet = {n for a in alt for n, _, _ in a[10]}
    # Gegenprobe mit der Rückrichtungsdatei des Pakets (zählt Sammelpositionen und reine Nutzervorgaben nicht mit)
    fr = MAP_DIR / "mapping_neu_zu_alt.csv"
    rev = {int(r["neu_ziffer"]) for r in csv.DictReader(fr.open(encoding="utf-8-sig"), delimiter=";") if r["alt_ziffern"]} if fr.exists() else set()
    ohne_sammel = {n for a in alt if a[5] != "SAMMELPOSITION" for n, pp, _ in a[10] if pp is not None}
    info.update(rev=len(rev), nur_sammel=len({n for a in alt if a[5] == "SAMMELPOSITION" for n, _, _ in a[10]} - ohne_sammel - {n for a in alt for n, pp, _ in a[10] if pp is None}),
                nur_vorgabe=len({n for a in alt for n, pp, _ in a[10] if pp is None} - ohne_sammel), rev_abw=len(rev ^ ohne_sammel))
    info.update(datei=fj.name, alt=alt, titel=titel, pdf=pdf_info, unbekannt=unbekannt, ohne_csv=ohne_csv,
                status=Counter(a[5] for a in alt), n_neu=len(neu_zugeordnet), vorgaben=[a[0] for a in alt if a[8] == "Nutzervorgabe"])
    return info


# ---------------------------------------------------------------- Geschlechtsbezug
GESCHLECHT_DIR = INPUT / "geschlecht"
SOLL_GESCHLECHT = {"W": 230, "M": 112, "Vorgabe": 274, "NEU": 68, "Zuschlag": 52, "Grenzfälle": 83, "Abgrenzung": 76}
SOLL_BEZUGSART = {"Geschlechtsspezifisches Organ": 174, "Explizite Geschlechtsangabe in der Legende": 49,
                  "Schwangerschaft / Geburt / Pränatalmedizin": 83, "Reproduktionsmedizin (Kinderwunsch)": 22,
                  "Labor – geschlechtsbezogene Indikation / Material": 14}


def lese_geschlecht(neu_gebuehr: dict, kap_k: dict) -> dict:
    """Geschlechtsbezug je Ziffer (input/geschlecht): Hauptliste, Grenzfälle, Abgrenzung. Nichts wird neu bewertet."""
    info = {"datei": None}
    fj = GESCHLECHT_DIR / "geschlechtsbezug.json"
    if not fj.exists():
        return info
    import csv
    haupt = json.loads(fj.read_text(encoding="utf-8"))
    grenz = json.loads((GESCHLECHT_DIR / "grenzfaelle.json").read_text(encoding="utf-8"))
    abgr = list(csv.DictReader((GESCHLECHT_DIR / "abgrenzung.csv").open(encoding="utf-8-sig"), delimiter=";"))
    je, abw_geb, abw_kap, unbekannt = {}, [], [], []

    def pruefe(z, geb, kapitel):
        if z not in neu_gebuehr:
            unbekannt.append(z)
            return
        if geb is not None and int((dec(geb) * 100).to_integral_value(rounding=ROUND_HALF_UP)) != neu_gebuehr[z]:
            abw_geb.append((z, geb, neu_gebuehr[z]))
        if kap_k and kapitel and kap_k.get(z) != kapitel:
            abw_kap.append((z, kapitel, kap_k.get(z)))

    for a in haupt:
        z = a["ziffer"]
        pruefe(z, a["gebuehr_eur"], a["kapitel"])
        je[z] = ["H", a["geschlecht"], a["bezugsart"], 1 if a["zuschlag"] == "ja" else 0, a["konfidenz"], a["quelle"],
                 a["begruendung"], "", a["seite"]]
    doppelt = [a["ziffer"] for a in grenz if a["ziffer"] in je]
    for a in grenz:
        z = a["ziffer"]
        pruefe(z, None, a["kapitel"])
        je.setdefault(z, ["G", a["geschlecht_vorschlag"], a["bezugsart"], 1 if a["zuschlag"] == "ja" else 0, "", "",
                          a["begruendung"], a["empfehlung"], a["seite"]])
    for a in abgr:
        z = int(a["ziffer"])
        pruefe(z, None, None)
        if z in je:
            doppelt.append(z)
            continue
        je[z] = ["A", "", a["auffaelliger_begriff"], 0, "", "", a["grund_nicht_aufgenommen"], "", None]
    # Gegenprobe mit der Arbeitsmappe des Pakets (Hauptliste Zeile für Zeile)
    xl_abw = []
    xf = GESCHLECHT_DIR / "GOAeneu_Geschlechtsbezug_Ziffern.xlsx"
    if xf.exists():
        ws = openpyxl.load_workbook(xf, data_only=True)["Ziffern_Geschlechtsbezug"]
        xl = {r[0]: r for r in ws.iter_rows(min_row=2, values_only=True) if isinstance(r[0], int)}
        if set(xl) != {a["ziffer"] for a in haupt}:
            xl_abw.append(("Ziffernmenge", len(set(xl) ^ {a["ziffer"] for a in haupt})))
        for a in haupt:
            r = xl.get(a["ziffer"])
            if r and (r[5] != a["geschlecht"] or r[6] != a["bezugsart"] or r[9] != a["quelle"] or r[10] != a["konfidenz"]):
                xl_abw.append((a["ziffer"], "Geschlecht/Bezugsart/Quelle/Konfidenz"))
    info.update(datei=fj.name, je=je, haupt=haupt, grenz=grenz, abgr=abgr, abw_geb=abw_geb, abw_kap=abw_kap, unbekannt=unbekannt,
                doppelt=doppelt, xl_abw=xl_abw, xl=xf.exists())
    return info


# ---------------------------------------------------------------- Altersbezug
ALTER_DIR = INPUT / "alter"
SOLL_ALTER = {"haupt": 268, "ablehnung": 164, "ausnahme": 104, "implizit": 46, "kindbezug": 120, "regeln": 10, "baender": 11, "abgrenzung": 7, "challenge": 15}
SOLL_ALTER_ART = {"Kinderzuschlag (kapitel-/abschnittsbezogen)": 99, "Hauptleistung mit Altersbezug": 88, "Zuschlag mit Altersbezug": 66,
                  "Zuschlag mit Altersbezug (vererbt)": 15}


def _z(v):
    return int(v) if isinstance(v, (int, float)) or str(v).strip().isdigit() else None


def _txt(v):
    return "" if v is None else str(v).strip()


def lese_alter(neu_gebuehr: dict, kap_k: dict) -> dict:
    """Altersbezug (input/alter/*.xlsx): Hauptliste, implizite Bezüge, altersabhängige Regeln, Kindbezug der Hauptleistung,
    Bandfamilien, Abgrenzung, Challenge. Bewertet wird nichts neu; die Blätter werden nur den Ziffern zugeordnet."""
    info = {"datei": None}
    dateien = sorted(ALTER_DIR.glob("*.xlsx"))
    if not dateien:
        return info
    wb = openpyxl.load_workbook(dateien[0], data_only=True)

    def blatt(name, ab=2):
        return [r for r in wb[name].iter_rows(min_row=ab, values_only=True) if r[0] not in (None, "")]

    je, unbekannt, abw_geb, abw_kap, abw_cond = {}, [], [], [], []

    def pruefe(z, geb=None, kap=None):
        if z not in neu_gebuehr:
            unbekannt.append(z)
            return
        if geb is not None and int((dec(geb) * 100).to_integral_value(rounding=ROUND_HALF_UP)) != neu_gebuehr[z]:
            abw_geb.append((z, geb, neu_gebuehr[z]))
        if kap and kap_k and kap_k.get(z) != kap.split(" ")[0]:
            abw_kap.append((z, kap, kap_k.get(z)))

    haupt = blatt("Ziffern_Altersbezug")
    for r in haupt:
        z = int(r[0])
        pruefe(z, r[4], r[1])
        mn, mx = r[7], r[8]
        erwartet = f"{mn} ≤ Alter ≤ {mx}" if isinstance(mn, int) and isinstance(mx, int) else f"Alter ≥ {mn}" if isinstance(mn, int) else f"Alter ≤ {mx}"
        if erwartet != r[9]:
            abw_cond.append((z, r[9], erwartet))
        je.setdefault(z, {})["h"] = [_txt(r[5]), _txt(r[6]), mn if isinstance(mn, int) else None, mx if isinstance(mx, int) else None, _txt(r[9]),
                                     _txt(r[10]), _txt(r[11]), _txt(r[12]), _txt(r[13]), r[14], _txt(r[15]), _txt(r[16]), _txt(r[17])]
    implizit = blatt("Implizit_Alter")
    for r in implizit:
        z = int(r[0])
        pruefe(z, r[4], r[1])
        je.setdefault(z, {})["i"] = [_txt(r[6]), _txt(r[7]), _txt(r[8]), _txt(r[9]), _txt(r[10]), _txt(r[11]), r[12]]
    kind = blatt("Kindbezug_Hauptleistung")
    for r in kind:
        z = int(r[0])
        pruefe(z, r[4], r[1])
        je.setdefault(z, {})["k"] = [_txt(r[5]), _txt(r[6]), _txt(r[7]), _txt(r[8])]
    regeln = blatt("Altersabhaengige_Regeln")
    for r in regeln:
        z = int(r[0])
        pruefe(z, None, r[1])
        je.setdefault(z, {})["r"] = [_txt(r[3]), _txt(r[4]), _txt(r[5]), _txt(r[6])]
    baender = []
    for r in blatt("Bandfamilien"):
        bs = [[int(m.group(1)), m.group(2).strip()] for m in re.finditer(r"(\d+):\s*(Alter[^,]*?)(?=,\s*\d+:|$)", _txt(r[1]))]
        baender.append({"name": _txt(r[0]), "baender": bs, "ergebnis": _txt(r[2])})
        for z, _ in bs:
            pruefe(z)
            je.setdefault(z, {}).setdefault("b", []).append(len(baender) - 1)
    abgrenzung = []
    for r in blatt("Abgrenzung"):
        zs = [int(x) for x in re.findall(r"\b\d{3,5}\b", _txt(r[1]))] if not _txt(r[1]).startswith("z. B.") else []
        abgrenzung.append({"thema": _txt(r[0]), "ziffern": _txt(r[1]), "behandlung": _txt(r[2])})
        for z in zs:
            if z in neu_gebuehr:
                je.setdefault(z, {}).setdefault("a", []).append(len(abgrenzung) - 1)
    challenge = [[_txt(c) for c in r[:6]] for r in blatt("Challenge")]
    ue = {_txt(r[1]): _txt(r[2]) for r in wb["Übersicht"].iter_rows(min_row=1, max_row=9, values_only=True) if r[1] and r[2]}
    ue_tab = {r[1]: r[2] for r in wb["Übersicht"].iter_rows(min_row=19, max_row=34, values_only=True) if r[1] and isinstance(r[2], (int, str)) and str(r[2]).isdigit()}
    info.update(datei=dateien[0].name, je=je, haupt=haupt, implizit=implizit, kind=kind, regeln=regeln, baender=baender,
                abgrenzung=abgrenzung, challenge=challenge, uebersicht=ue, ue_tab=ue_tab, unbekannt=unbekannt, abw_geb=abw_geb,
                abw_kap=abw_kap, abw_cond=abw_cond)
    return info


# ---------------------------------------------------------------- Intervalle
_TAG = r"Kalendertag|\bpro Tag\b|\bje Tag\b|\ban einem Tag\b|\btäglich\b|Behandlungstag|\bam selben Tag\b|\ban demselben Tag\b"
_KHJ = r"Kalenderhalbjahr|\bHalbjahr"
# Muster je Intervall; "lz" = auch in Legende/Zusatz suchen (sonst nur Abrechnungsbestimmung)
INTERVALL_RE = {
    "sitzung": (r"\bSitzung(?:en)?\b", r"\b(?:je|pro) Sitzung\b|\bin (?:einer|derselben|der gleichen|gleicher) Sitzung\b|\bSitzungen im\b"),
    "tag": (_TAG, r"\b(?:je|pro) (?:Kalendertag|Tag|Behandlungstag)\b|\btäglich\b"),
    "kalenderjahr": (r"Kalenderjahr", r"Kalenderjahr"),
    "kalenderhalbjahr": (_KHJ, _KHJ),
    "quartal": (r"\bQuartal|Kalendervierteljahr|\bVierteljahr", r"\bQuartal|Kalendervierteljahr|\bVierteljahr"),
    "jahr365": (r"innerhalb (?:eines|von einem) Jahr|innerhalb von (?:12|zwölf) Monaten|\bbinnen eines Jahres|\b(?:je|pro) Jahr\b|365 Tage", None),
    "monat30": (r"innerhalb (?:eines|von einem) Monat|innerhalb von (?:30|dreißig) Tagen|\b(?:je|pro) Monat\b|30 Tage", None),
    "behandlungsfall_alt": (r"Behandlungsfall", r"Behandlungsfall"),
    "mindestabstand_tag": (r"Abstand von mindestens|Mindestabstand", r"Abstand von mindestens|Mindestabstand"),
    "rollierend_24h": (r"(?:innerhalb von|je vollendete|je|binnen|in) 24 Stunden", None),
    "kalenderwoche": (r"Kalenderwoche", r"Kalenderwoche"),
    "kalendermonat": (r"Kalendermonats?\b", r"Kalendermonats?\b"),
    "rollierend_7tage": (r"innerhalb von (?:sieben|7) Tagen", None),
    "rollierend_3kalendermonate": (r"(?:in|innerhalb von) (?:drei|3) Kalendermonaten", None),
    "rollierend_6monate_staffel": (r"Zeitraume?s? von (?:6|sechs) Monaten", None),
    "krankheitsfall": (r"Krankheitsfall", r"Krankheitsfall"),
    "behandlungsfall_neu": (r"Behandlungsfall", r"Behandlungsfall"),
    "abstand_vorgaenger": (r"frühestens\b.*\bnach\b", None),
    "zeitfenster_ereignis": (r"nach Erstdialyse|innerhalb der ersten\b.*\bnach\b", None),
    "mindestkontakte": (r"Kontakte? innerhalb|mindestens \w+ (?:Arzt-Patienten-)?Kontakte", None),
    "zyklus_versuch": (r"\bZyklus\b|Behandlungszyklus|\bVersuch(?:e?s)?\b", r"\bje Zyklus\b|\bje Versuch\b|Behandlungszyklus"),
}
# Kombinierte Limits: beide Teilmuster im selben Satz
INTERVALL_KOMBI = {
    "kombi_tag_behandlungsfall": (_TAG, r"Behandlungsfall"),
    "kombi_krankheitsfall_halbjahr": (r"Krankheitsfall", _KHJ),
    "kombi_krankheitsfall_woche": (r"Krankheitsfall", r"\b(?:pro|je) Woche\b"),
    "zaehlgrenze_halbjahr": (_KHJ, r"für bis zu \d+ Sitzungen"),
}
ZEITWORT_RE = re.compile(r"Kalender(?:jahr|halbjahr|monat|woche|tag)|\bSitzung|Behandlungsfall|Krankheitsfall|\bStunden\b|\bMonat|\bWochen?\b|\bTagen?\b|\bJahr(?:es|en)?\b|Quartal|Zyklus|Versuch|frühestens|Abstand")
HAEUFIG_RE = re.compile(r"(?:nur |höchstens |maximal |insgesamt )?(?:bis zu )?(?:(?:ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|fünfzehn|sechzehn|zwanzig)mal|\d+[- ]?(?:mal|Mal)\b|maximal \w+ Leistungen)")
ABK = r"(?:bzw|z\.B|ggf|u\.a|inkl|etc|Nr|ca|d\.h|o\.g|sog|evtl|max|min|mind|einschl|usw|o\.ä|u\.ä|vgl|Abs)"


def saetze(text: str) -> list[str]:
    """Text in Sätze zerlegen (Zeilenumbrüche der Quelle sind Satzgrenzen)."""
    out = []
    for zeile in re.split(r"(?:_x000D_)?\s*\n\s*|_x000D_", (text or "").replace("\xa0", " ")):
        zeile = re.sub(r"\s+", " ", zeile).strip()
        if not zeile:
            continue
        zeile = re.sub(r"(fähig\.)(?=[A-ZÄÖÜ])", r"\1 ", zeile)
        puffer = ""
        for t in re.split(r"(?<=[a-zäöüß\)]\.)\s+(?=[A-ZÄÖÜ])", zeile):
            puffer = (puffer + " " + t).strip()
            if re.search(r"(?:^|[\s(])" + ABK + r"\.$", puffer):
                continue
            out.append(puffer)
            puffer = ""
        if puffer:
            out.append(puffer)
    return out


def lese_intervalle(roh_texte: dict) -> dict:
    """Ordnet Ziffern über den Wortlaut des Gebührenverzeichnisses den Intervallen aus input/intervalle.json zu.
    roh_texte: Ziffer -> (Legende, Zusatz, Abrechnungsbestimmung)."""
    f = INPUT / "intervalle.json"
    info = {"datei": None}
    if not f.exists() or not roh_texte:
        return info
    defs = json.loads(f.read_text(encoding="utf-8"))["intervalle"]
    idx = {d["id"]: i for i, d in enumerate(defs)}
    fehlend = [k for k in list(INTERVALL_RE) + list(INTERVALL_KOMBI) if k not in idx] + [d["id"] for d in defs if d["id"] not in INTERVALL_RE and d["id"] not in INTERVALL_KOMBI]
    je, rest = {}, []
    for z in sorted(roh_texte):
        leg, zus, abr = roh_texte[z]
        fragmente = [("A", s) for s in saetze(abr)] + [("L", norm_text(leg))] + [("Z", s) for s in saetze(zus)]
        treffer = []
        for quelle, satz in fragmente:
            if not satz:
                continue
            ids = []
            for k, (re_a, re_lz) in INTERVALL_RE.items():
                pat = re_a if quelle == "A" else re_lz
                if pat and k in idx and re.search(pat, satz):
                    ids.append(idx[k])
            for k, (p1, p2) in INTERVALL_KOMBI.items():
                if k in idx and re.search(p1, satz) and re.search(p2, satz):
                    ids.append(idx[k])
            if ids:
                treffer.append([sorted(ids), quelle, satz, "; ".join(dict.fromkeys(m.group(0) for m in HAEUFIG_RE.finditer(satz)))])
            elif quelle == "A" and ZEITWORT_RE.search(satz):
                rest.append((z, satz))
        if treffer:
            je[z] = treffer
    zahl = Counter(i for v in je.values() for i in {i for t in v for i in t[0]})
    bsp_fehlt = [(d["name"], z) for i, d in enumerate(defs) for z in d["beispiele"]
                 if not any(i in t[0] for t in je.get(z, []))]
    info.update(datei=f.name, defs=defs, je=je, rest=rest, zahl=zahl, bsp_fehlt=bsp_fehlt, ohne_muster=fehlend)
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
    c_abr = spalte("abrechnungsbestimmung")
    info["roh"] = {z: (g[c_leg], g[c_zus], g[c_abr]) for z, g in G.items()}
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
def tests(daten, js=None, kap=None, gesetz=None, regeln=None, intervalle=None, mapping=None, geschlecht=None, alter=None):
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
        if intervalle and intervalle["datei"]:
            defs, ije = intervalle["defs"], intervalle["je"]

            def hat(z, iid):
                i = next(k for k, d in enumerate(defs) if d["id"] == iid)
                return any(i in tr[0] for tr in ije.get(z, []))

            t("Intervalle – 25 Intervalle (8 bestehend, 17 neu), jedes mit Erkennungsmuster",
              len(defs) == 25 and Counter(d["status"] for d in defs) == {"bestehend": 8, "neu": 17} and not intervalle["ohne_muster"],
              f"{len(defs)} Intervalle; " + " · ".join(f"{k} {v}" for k, v in Counter(d['status'] for d in defs).items()))
            proben = [(1022, "mindestabstand_tag"), (1100, "rollierend_24h"), (1800, "rollierend_24h"), (2702, "kalenderwoche"),
                      (2702, "abstand_vorgaenger"), (4444, "kalendermonat"), (208, "kalendermonat"), (1123, "rollierend_7tage"),
                      (119, "rollierend_3kalendermonate"), (305, "rollierend_3kalendermonate"), (13618, "rollierend_6monate_staffel"),
                      (4404, "krankheitsfall"), (1017, "kombi_tag_behandlungsfall"), (13800, "kombi_krankheitsfall_halbjahr"),
                      (13802, "kombi_krankheitsfall_woche"), (4525, "zaehlgrenze_halbjahr"), (3415, "zeitfenster_ereignis"),
                      (3801, "mindestkontakte"), (13118, "zyklus_versuch"), (1200, "sitzung"), (2, "tag")]
            miss = [f"{z}/{i}" for z, i in proben if not hat(z, i)]
            t("Intervalle – Stichprobe aus der Vorgabe (21 Ziffer-Intervall-Paare, z. B. 1022 Mindestabstand, 4444 Kalendermonat, 13802 Krankheitsfall und Woche)",
              not miss, "alle gefunden" if not miss else "fehlend: " + ", ".join(miss))
            bsp = sum(len(d["beispiele"]) for d in defs)
            t("Intervalle – Beispielziffern der Vorgabe gefunden (7 ungerade Ziffern 2705–2717 je zweimal ohne passenden Wortlaut)",
              len(intervalle["bsp_fehlt"]) == 14 and all(2705 <= z <= 2717 and z % 2 for _, z in intervalle["bsp_fehlt"]),
              f"{bsp - len(intervalle['bsp_fehlt'])} von {bsp} gefunden")
        if mapping and mapping["datei"]:
            MA = {a[0]: a for a in mapping["alt"]}

            def neu(z):
                return [n for n, _, _ in MA[z][10]]

            t("Mapping – 2.831 alte Ziffern, Status wie in der README (522 / 816 / 765 / 667 / 61)",
              len(MA) == len(mapping["alt"]) == 2831 and dict(mapping["status"]) == SOLL_MAP_STATUS,
              f"{len(MA)} Ziffern; " + " · ".join(f"{k} {mapping['status'][k]}" for k in SOLL_MAP_STATUS))
            t("Mapping – alt 863 → neu 4500, Wahrscheinlichkeit 0,82, SICHER", neu("863") == [4500] and MA["863"][6] == 0.82 and MA["863"][5] == "SICHER",
              f"{neu('863')} · {MA['863'][6]} · {MA['863'][5]}")
            t("Mapping – alt 861 → 4505; alt 862 → 4506–4509; alt 864 → 4501–4504",
              neu("861") == [4505] and neu("862") == [4506, 4507, 4508, 4509] and neu("864") == [4501, 4502, 4503, 4504], f"{neu('861')} · {neu('862')} · {neu('864')}")
            t("Mapping – Nutzervorgabe geht vor: alt 870 → 4510, 4515; alt 871 → 4511–4514, 4516–4519",
              neu("870") == [4510, 4515] and neu("871") == [4511, 4512, 4513, 4514, 4516, 4517, 4518, 4519] and MA["870"][8] == "Nutzervorgabe", f"{neu('870')} · {neu('871')}")
            t("Mapping – Rückrichtung: neu 4500 ← alt 863 (und 808); alt 4500 ist eine andere Leistung (Nummernkollision)",
              "863" in [a[0] for a in mapping["alt"] if 4500 in neu(a[0])] and "4500" in MA and neu("4500") != [4500],
              f"neu 4500 ← {[a[0] for a in mapping['alt'] if 4500 in neu(a[0])]}; alt 4500 = {MA['4500'][2][:40]}")
            ohne_neu = [z for z in ("3662", "3857") if not neu(z) and MA[z][6] <= 0.1 and MA[z][5] == "KEINE_ENTSPRECHUNG_ERKENNBAR"]
            t("Mapping – 1.746 neue Ziffern mit alter Zuordnung wie im Paket (im Dashboard 1.760: zusätzlich 5 nur aus Nutzervorgabe, 9 nur über Sammelpositionen)",
              mapping["rev"] == 1746 and mapping["rev_abw"] == 0 and mapping["n_neu"] == 1760 and (mapping["nur_vorgabe"], mapping["nur_sammel"]) == (5, 9),
              f"Paket {mapping['rev']}; Dashboard {mapping['n_neu']} = {mapping['rev']} + {mapping['nur_vorgabe']} Vorgabe + {mapping['nur_sammel']} Sammelposition")
            t("Mapping – 3662 und 3857 ohne neue Ziffer, Wahrscheinlichkeit höchstens 0,1, „keine Entsprechung erkennbar“", len(ohne_neu) == 2,
              "; ".join(f"{z}: {neu(z)} · {MA[z][6]}" for z in ("3662", "3857")))
            t("Mapping – alle zugeordneten neuen Ziffern existieren; jede alte Ziffer hat eine Begründung",
              not mapping["unbekannt"] and all(a[9] for a in mapping["alt"]), f"{len(mapping['unbekannt'])} unbekannt")
            if mapping["pdf"]["datei"]:
                q = mapping["pdf"]["gefunden"] / max(1, mapping["pdf"]["geprueft"])
                t("Mapping – alte Ziffern mit Betrag in der alten GOÄ (PDF) wiedergefunden (mindestens 98 %)", q >= 0.98,
                  f"{mapping['pdf']['gefunden']} von {mapping['pdf']['geprueft']} ({q:.1%})")
        if geschlecht and geschlecht["datei"]:
            H = {a["ziffer"]: a for a in geschlecht["haupt"]}
            ist = {"W": sum(1 for a in H.values() if a["geschlecht"] == "W"), "M": sum(1 for a in H.values() if a["geschlecht"] == "M"),
                   "Vorgabe": sum(1 for a in H.values() if a["quelle"] == "Vorgabe"), "NEU": sum(1 for a in H.values() if a["quelle"] == "NEU"),
                   "Zuschlag": sum(1 for a in H.values() if a["zuschlag"] == "ja"), "Grenzfälle": len(geschlecht["grenz"]), "Abgrenzung": len(geschlecht["abgr"])}
            t("Geschlecht – 342 Ziffern (W 230, M 112; Vorgabe 274, neu gefunden 68; Zuschläge 52), 83 Grenzfälle, 76 Abgrenzungen",
              ist == SOLL_GESCHLECHT and len(H) == 342, " · ".join(f"{k} {v}" for k, v in ist.items()))
            ba = Counter(a["bezugsart"] for a in H.values())
            t("Geschlecht – Bezugsarten wie in der Übersicht des Pakets (174 / 49 / 83 / 22 / 14)", dict(ba) == SOLL_BEZUGSART, " · ".join(f"{v}" for v in ba.values()))
            t("Geschlecht – Hauptliste, Grenzfälle und Abgrenzung überschneiden sich nicht; jede Ziffer genau einmal",
              not geschlecht["doppelt"] and len(geschlecht["je"]) == 342 + 83 + 76, f"{len(geschlecht['je'])} Ziffern, {len(geschlecht['doppelt'])} Überschneidungen")
            t("Geschlecht – alle Ziffern existieren, Gebühren und Kapitel stimmen mit dem Gebührenverzeichnis überein",
              not geschlecht["unbekannt"] and not geschlecht["abw_geb"] and not geschlecht["abw_kap"],
              f"{len(geschlecht['unbekannt'])} unbekannt, {len(geschlecht['abw_geb'])} Gebührenabweichungen, {len(geschlecht['abw_kap'])} Kapitelabweichungen")
            t("Geschlecht – JSON und Arbeitsmappe des Pakets stimmen Zeile für Zeile überein", geschlecht["xl"] and not geschlecht["xl_abw"],
              f"{len(geschlecht['xl_abw'])} Abweichungen")
            jr = {int(z): v for z, v in js["geschlecht"].items()}
            t("Geschlecht – Beispiele: 111 W (Schwangerschaft), 114 W neu gefunden, 115 M, 926 Grenzfall (Brust), 17 bewusst nicht aufgenommen",
              jr[111][:2] == ["H", "W"] and jr[114][:2] == ["H", "W"] and jr[114][5] == "NEU" and jr[115][:2] == ["H", "M"] and jr[926][0] == "G" and jr[17][0] == "A",
              " · ".join(f"{z}: {jr[z][0]}{jr[z][1]}" for z in (111, 114, 115, 926, 17)))
        if alter and alter["datei"]:
            h = alter["haupt"]
            ist = {"haupt": len(h), "ablehnung": sum(1 for r in h if r[10] == "Ablehnung"), "ausnahme": sum(1 for r in h if r[10] == "Ausnahmeprüfung"),
                   "implizit": len(alter["implizit"]), "kindbezug": len(alter["kind"]), "regeln": len(alter["regeln"]), "baender": len(alter["baender"]),
                   "abgrenzung": len(alter["abgrenzung"]), "challenge": len(alter["challenge"])}
            t("Alter – 268 Ziffern (164 Ablehnung, 104 Ausnahmeprüfung), 46 implizit, 120 Kindbezug, 10 Regeln, 11 Bandfamilien, 7 Abgrenzungen, 15 Challenge-Punkte",
              ist == SOLL_ALTER, " · ".join(f"{k} {v}" for k, v in ist.items()))
            art = Counter(r[5] for r in h)
            t("Alter – Arten wie in der Übersicht (99 Kinderzuschlag, 88 Hauptleistung, 66 Zuschlag, 15 Zuschlag vererbt) und Quelle 253 Vorgabe / 15 neu",
              dict(art) == SOLL_ALTER_ART and Counter(r[15] for r in h) == {"Vorgabe": 253, "NEU": 15}, " · ".join(f"{v}" for v in art.values()))
            ue_ist = Counter(r[9] for r in h)
            diff = {k: (v, ue_ist.get(k)) for k, v in alter["ue_tab"].items() if k in ue_ist or k.startswith("Alter") or "≤" in k if ue_ist.get(k) != int(v)}
            t("Alter – Verteilung nach Altersgrenze entspricht der Tabelle der Übersicht (z. B. Alter ≤ 7: 167)", not diff and ue_ist["Alter ≤ 7"] == 167,
              "alle 16 Prüfbedingungen stimmen" if not diff else str(diff))
            t("Alter – Prüfbedingung stimmt mit Mindest- und Höchstalter überein (bis zum vollendeten N. Lj. → Alter ≤ N−1)", not alter["abw_cond"], f"{len(alter['abw_cond'])} Abweichungen")
            t("Alter – alle Ziffern existieren; Gebühr und Kapitel stimmen mit dem Gebührenverzeichnis überein",
              not alter["unbekannt"] and not alter["abw_geb"] and not alter["abw_kap"],
              f"{len(alter['unbekannt'])} unbekannt, {len(alter['abw_geb'])} Gebührenabweichungen, {len(alter['abw_kap'])} Kapitelabweichungen")
            ja = {int(z): v for z, v in js["alter"]["je"].items()}
            t("Alter – Beispiele: 36 Kinderzuschlag Alter ≤ 7 (Ausnahmeprüfung), 1500 Alter ≤ 2 (Ablehnung), 1325 vererbt (neu), 4409 Alter ≤ 20 mit Regel, 912 nur Regel",
              ja[36]["h"][4] == "Alter ≤ 7" and ja[36]["h"][5] == "Ausnahmeprüfung" and ja[1500]["h"][4] == "Alter ≤ 2" and ja[1500]["h"][5] == "Ablehnung"
              and ja[1325]["h"][10] == "NEU" and ja[4409]["h"][4] == "Alter ≤ 20" and "r" in ja[4409] and "h" not in ja[912] and "r" in ja[912],
              f"36: {ja[36]['h'][4]} · 1500: {ja[1500]['h'][4]} · 1325: {ja[1325]['h'][10]} · 4409: {ja[4409]['h'][4]} · 912: Regel")
            t("Alter – Bandfamilien lückenlos: 11 Familien, jede mit mindestens 2 Altersbändern, alle Ziffern mit Altersbezug in der Hauptliste",
              all(len(b["baender"]) >= 2 for b in alter["baender"]) and all("h" in ja[z] for b in alter["baender"] for z, _ in b["baender"]),
              " · ".join(f"{len(b['baender'])}" for b in alter["baender"]))
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


def baue_json(daten, pdf, gesetz, kap, regeln, intervalle, mapping, geschlecht, alter):
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
        row += [regeln.get("je", {}).get(row[0], []), regeln.get("weitere", {}).get(row[0], []), intervalle.get("je", {}).get(row[0], [])]
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
        "intervalle": [{k: v for k, v in d.items() if k != "beispiele"} | {"bsp": d["beispiele"]} for d in intervalle.get("defs", [])],
        "geschlecht": {str(z): v for z, v in geschlecht.get("je", {}).items()},
        "alter": {"je": {str(z): v for z, v in alter.get("je", {}).items()}, "baender": alter.get("baender", []), "abgrenzung": alter.get("abgrenzung", []),
                  "challenge": alter.get("challenge", []), "info": alter.get("uebersicht", {})},
        "mapping": {"alt": mapping.get("alt", []), "titel": mapping.get("titel", {}), "stand": mapping.get("pdf", {}).get("stand")},
    }


def schreibe_bericht(daten, pdf, gesetz, kap, regeln, intervalle, mapping, geschlecht, alter, res, ui, excel_name, daten_alle=()):
    L = []
    ok = sum(1 for _, o, _ in res if o)
    L += ["# QS-Bericht – GOÄneu Steigerungsdashboard", "",
          f"- Quelle Zuordnungen: `input/{excel_name}`, Blatt „{SHEET}“",
          f"- Gebührenverzeichnis des Entwurfs (Excel): {'`input/gesetz/' + gesetz['datei'] + '`' if gesetz['datei'] else '**lag beim Build nicht vor**'}",
          f"- Zuordnung Ziffer → Kapitel/Abschnitt (JSON): {'`input/kapitel/' + kap['datei'] + '`' if kap['datei'] else '**lag beim Build nicht vor**'}",
          f"- Kombinationsregeln (Nebeneinanderberechnung): {'`input/neben/` (regeln.json, ziffer_index.json, weitere_ausschluesse.csv)' if regeln['datei'] else '**lagen beim Build nicht vor**'}",
          f"- Mapping alte GOÄ → GOÄneu: {'`input/mapping/` und `input/goae_alt/`' if mapping['datei'] else '**lag beim Build nicht vor**'}",
          f"- Geschlechtsbezug: {'`input/geschlecht/`' if geschlecht['datei'] else '**lag beim Build nicht vor**'}",
          f"- Altersbezug: {'`input/alter/`' if alter['datei'] else '**lag beim Build nicht vor**'}",
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

    L += ["", "## 4g. Altersbezug und Altersprüfung", ""]
    if not alter["datei"]:
        L.append("Nicht vorhanden: `input/alter/` fehlt.")
    else:
        h = alter["haupt"]
        L += [f"Der Reiter beruht ausschließlich auf der gelieferten Arbeitsmappe `input/alter/{alter['datei']}` (Blätter Ziffern_Altersbezug, "
              "Implizit_Alter, Kindbezug_Hauptleistung, Altersabhaengige_Regeln, Bandfamilien, Abgrenzung, Challenge, Übersicht). Prüfbedingung, "
              "Reaktion, Ausnahmen und Begründungen sind unverändert übernommen; das Dashboard bewertet nichts neu und ordnet die Blätter nur den Ziffern zu.", "",
              "| Kennzahl | Wert |", "|---|---|",
              f"| Ziffern mit Altersprüfung (Hauptliste) | {len(h)} |",
              f"| … Reaktion Ablehnung (harte Altersgrenze) / Ausnahmeprüfung | {sum(1 for r in h if r[10] == 'Ablehnung')} / {sum(1 for r in h if r[10] == 'Ausnahmeprüfung')} |",
              f"| … aus der Vorgabe / neu aufgenommen (vererbte Zuschläge) | {sum(1 for r in h if r[15] == 'Vorgabe')} / {sum(1 for r in h if r[15] == 'NEU')} |",
              f"| Implizite Altersbezüge (nur Hinweis) | {len(alter['implizit'])} |",
              f"| Altersabhängige Regeln (Menge, Häufigkeit, Indikation) | {len(alter['regeln'])} |",
              f"| Hauptleistungen mit Kindbezug (Kinderzuschlag ausgeschlossen) | {len(alter['kind'])} |",
              f"| Bandfamilien (lückenlose Altersbänder) | {len(alter['baender'])} |",
              f"| Geprüft, kein Altersbezug (Abgrenzung) | {len(alter['abgrenzung'])} Themen |",
              f"| Abweichungen Gebühr / Kapitel gegen das Gebührenverzeichnis | {len(alter['abw_geb'])} / {len(alter['abw_kap'])} |", ""]
        offen += [
            "**Alter – offene Fragen aus der Analyse (Blatt Challenge, 15 Punkte):** Das Dashboard zeigt sie unverändert über die Schaltfläche "
            "„Offene Fragen“. Fachlich zu klären sind u. a. die Ausnahmelisten A und K (Diagnosen, noch TBD), die Grenzen für implizite Altersbezüge "
            "(Neugeborenes, Kind, Jugendlicher), der Widerspruch bei 4409 (Legende bis 21. Lj., Bestimmung nennt Erwachsene), die Auslegung "
            "„bis einschließlich 8. Lebensjahr“ bei 3019 und ob ein Narkose-/Sedierungskennzeichen auf der Rechnung vorliegt.",
            "**Alter – Prüfgröße:** Alter in vollendeten Lebensjahren am Behandlungstag aus dem Geburtsdatum der Stammdaten. Neugeborene (0 Tage) lassen sich "
            "davon nur mit taggenauem Geburtsdatum trennen. Das Dashboard rechnet nicht, es zeigt die Prüfbedingung („Alter ≤ 7“).",
        ]

    L += ["", "## 4f. Geschlechtsbezug", ""]
    if not geschlecht["datei"]:
        L.append("Nicht vorhanden: `input/geschlecht/` fehlt.")
    else:
        H = geschlecht["haupt"]
        L += ["Der Reiter beruht ausschließlich auf dem gelieferten Paket `input/geschlecht/` (`geschlechtsbezug.json`, `grenzfaelle.json`, "
              "`abgrenzung.csv`, Arbeitsmappe, Beschreibung in `README.md`). Bewertung, Konfidenz und Begründung sind unverändert übernommen; "
              "das Dashboard bewertet nichts neu. Titel und Gebühr zeigt das Dashboard aus dem Gebührenverzeichnis (das Paket kürzt Titel).", "",
              "| Kennzahl | Wert |", "|---|---|",
              f"| Ziffern mit Geschlechtsbezug (Hauptliste) | {len(H)} (W {sum(1 for a in H if a['geschlecht'] == 'W')}, M {sum(1 for a in H if a['geschlecht'] == 'M')}) |",
              f"| … davon aus der Vorgabe / neu gefunden | {sum(1 for a in H if a['quelle'] == 'Vorgabe')} / {sum(1 for a in H if a['quelle'] == 'NEU')} |",
              f"| … davon Zuschläge | {sum(1 for a in H if a['zuschlag'] == 'ja')} |",
              f"| … Konfidenz „mittel“ (fachlich abgeleitet) | {sum(1 for a in H if a['konfidenz'] == 'mittel')} |",
              f"| Grenzfälle (nur Hinweis, nicht in der Hauptliste) | {len(geschlecht['grenz'])} |",
              f"| Bewusst nicht aufgenommen (Abgrenzung) | {len(geschlecht['abgr'])} |",
              f"| Abweichungen Gebühr / Kapitel gegen das Gebührenverzeichnis | {len(geschlecht['abw_geb'])} / {len(geschlecht['abw_kap'])} |",
              f"| Abweichungen JSON gegen Arbeitsmappe | {len(geschlecht['xl_abw'])} |", ""]
        offen += [
            "**Geschlecht – weiche Prüfung:** Nach Kap. A, AB Nr. 4 zählt der individuelle medizinische Bedarf, nicht der Personenstandseintrag. "
            "Das Dashboard zeigt deshalb nur Hinweise und Aussteuerungsempfehlungen, nie eine Ablehnung.",
            "**Geschlecht – Konfidenz „mittel“:** 25 Ziffern sind laut Paket fachlich abgeleitet (Reproduktionsmedizin mit Paarbezug, "
            "Douglasraum 919, Rektozele 9905/9906). Bitte fachlich bestätigen.",
            "**Geschlecht – Grenzfälle:** 83 Ziffern (Brust 60, Beckenboden/Inkontinenz 7, Reproduktion 7, Transition 5, Organ 4) stehen nur als "
            "Hinweis. Eine eigene Aussteuerung ist dafür nicht vorgesehen; bei Transition nur Hinweis. Bitte bestätigen.",
            "**Geschlecht – Abschnittszuschläge** (9996–10000, 10275–10277, 4776–4778, 5122–5124) stehen laut Paket nicht in der Liste: "
            "Es gilt das Geschlecht der tatsächlich abgerechneten Hauptleistung. Das Dashboard weist darauf bei den Ziffern nicht eigens hin.",
        ]

    L += ["", "## 4e. Mapping alte GOÄ → GOÄneu", ""]
    if not mapping["datei"]:
        L.append("Nicht vorhanden: `input/mapping/` fehlt.")
    else:
        MA = mapping["alt"]
        L += ["Der Reiter beruht auf dem gelieferten Paket `input/mapping/` (`mapping_alt_zu_neu.json` und `.csv`, Beschreibung in "
              "`README.md`). Wahrscheinlichkeit, Status, Verhältnis und Bemerkung sind unverändert übernommen. Maßgeblich ist die "
              "Spalte `neu_ziffern_final` (Nutzervorgabe vor automatischem Vorschlag). Die Rückrichtung neu → alt wird daraus "
              "abgeleitet. Die Begründung im Dashboard ist die Bemerkung des Pakets, ergänzt um Quelle, Score und die Bedeutung des "
              "Status laut README; eine eigene fachliche Bewertung enthält sie nicht.", "",
              "| Kennzahl | Wert |", "|---|---|",
              f"| Alte Ziffern | {len(MA)} |"]
        L += [f"| … Status {k} | {mapping['status'][k]} |" for k in SOLL_MAP_STATUS]
        L += [f"| … davon mit Nutzervorgabe | {len(mapping['vorgaben'])} ({', '.join(mapping['vorgaben'])}) |",
              f"| … ohne zugeordnete neue Ziffer | {sum(1 for a in MA if not a[10])} |",
              f"| Neue Ziffern mit mindestens einer alten Ziffer | {mapping['n_neu']} von {len(daten_alle)} (Paket: {mapping['rev']}; "
              f"zusätzlich {mapping['nur_vorgabe']} nur aus Nutzervorgabe und {mapping['nur_sammel']} nur über Sammelpositionen) |",
              f"| Zugeordnete neue Ziffern, die es nicht gibt | {len(mapping['unbekannt'])} |",
              f"| Alte Ziffern ohne Betrag (1,0-fach) | {sum(1 for a in MA if a[4] is None)} |"]
        if mapping["pdf"]["datei"]:
            L += [f"| Alte GOÄ (PDF `input/goae_alt/{mapping['pdf']['datei']}`, Stand {mapping['pdf']['stand'] or 'unbekannt'}) | "
                  f"{mapping['pdf']['seiten']} Seiten; Kapitelüberschriften übernommen: {len(mapping['titel'])} |",
                  f"| Alte Ziffern mit Betrag, deren Nummer und 1,0-fach-Betrag im PDF-Text vorkommen | "
                  f"{mapping['pdf']['gefunden']} von {mapping['pdf']['geprueft']} |"]
        L.append("")
        offen += [
            "**Mapping – Wahrscheinlichkeit ist eine Schätzung** (Textähnlichkeit, kalibriert an 104 Stichproben; laut README im "
            "Labor zuverlässiger, in der Chirurgie und bei Zuschlägen schwächer). Manuell geprüft sind nur die alten Abschnitte B "
            "und G. Auch „SICHER“ ist nicht fehlerfrei.",
            "**Mapping – Prozentbereiche in den Tags** sind die Statusgrenzen laut README (≥ 80 %, 50–79 %, 25–49 %, < 25 %). Bei "
            "manuell geprüften und gedeckelten Ziffern liegt die Wahrscheinlichkeit vereinzelt genau auf oder knapp über einer "
            "Grenze (z. B. „Keine Entsprechung“ bis 30 %); der Status stammt unverändert aus dem Paket.",
            "**Mapping – 1.760 statt 1.746 neue Ziffern mit Pendant:** Das Dashboard zeigt in der Richtung neu → alt auch die 5 "
            "Ziffern, die nur über die Nutzervorgabe zugeordnet sind (4515 bis 4519), und 9 Laborziffern, auf die nur alte "
            "Sammelpositionen zeigen (als „Sammelposition“ gekennzeichnet). Das Paket zählt beide Gruppen in der Rückrichtung nicht "
            "mit. Falls die Sammelpositionen dort nicht erscheinen sollen, bitte melden.",
            "**Mapping – 812/812a (Kurzzeittherapie):** Laut README ist 812 in der Kurz-GOÄ die „Psychiatrische Notfallbehandlung“ "
            "(→ 4422, 4423), 812a existiert dort nicht. Die Vorgabe „812/812a → 4500 bis 4519“ ist deshalb nicht übernommen. "
            "Bitte klären, welche alte Nummer gemeint ist.",
            "**Mapping – 870 und 871:** Die Systemische Therapie (4515 bzw. 4516 bis 4519) stammt aus der Nutzervorgabe und hat "
            "keine automatische Wahrscheinlichkeit; im Dashboard als „Nutzervorgabe“ gekennzeichnet.",
            "**Mapping – Nummernkollision:** Alte und neue GOÄ verwenden teils dieselbe Nummer für verschiedene Leistungen "
            "(alt 4500 = Labor, neu 4500 = Analytische Psychotherapie). Die Suche zeigt deshalb beide Richtungen und kennzeichnet sie.",
            "**Mapping – nicht enthalten:** die alten Zuschläge A bis K und die Allgemeinen Bestimmungen der alten GOÄ. Das PDF "
            "dient nur für Kapitelüberschriften und die Gegenprobe der Beträge.",
        ]

    L += ["", "## 4d. Intervalle", ""]
    if not intervalle["datei"]:
        L.append("Nicht vorhanden: `input/intervalle.json` oder Gebührenverzeichnis fehlt.")
    else:
        defs, ije = intervalle["defs"], intervalle["je"]
        L += ["Die Systematik (bestehend/neu, Cluster, Beispielziffern) steht in `input/intervalle.json` und entspricht der Vorgabe. "
              "Die Zuordnung der Ziffern erfolgt über Textmuster im Gebührenverzeichnis: in jedem Satz der Abrechnungsbestimmung, "
              "bei eindeutigen Formulierungen („je Sitzung“, „je Kalendertag“ …) auch in Legende und Zusatz. Jeder Treffer wird im "
              "Dashboard mit Wortlaut und Quelle gezeigt.", "",
              f"Ziffern mit mindestens einem Intervall: **{len(ije)}** von {len(daten_alle)}.", "",
              "| Status | Cluster | Intervall | Ziffern |", "|---|---|---|---|"]
        for i, d in enumerate(defs):
            L.append(f"| {d['status']} | {d['cluster']}: {d['cluster_name']} | {d['name']} | {intervalle['zahl'][i]} |")
        L += ["", "Beispielziffern der Vorgabe ohne passenden Wortlaut im Gebührenverzeichnis:", ""]
        nach = {}
        for name, z in intervalle["bsp_fehlt"]:
            nach.setdefault(name, []).append(z)
        L += [f"- {name}: {', '.join(map(str, zs))}" for name, zs in nach.items()] or ["- keine"]
        L += ["", "Sätze der Abrechnungsbestimmung mit Zeitangabe, die keinem Intervall zugeordnet wurden (" + str(len(intervalle["rest"])) + "):", ""]
        L += [f"- Ziffer {z}: „{satz}“" for z, satz in intervalle["rest"]]
        offen += [
            "**Intervalle – Erkennung aus dem Wortlaut:** Die Zuordnung Ziffer → Intervall ist eine Textauswertung des "
            "Gebührenverzeichnisses, keine fachliche Prüfung. Bei „Sitzung“ zählt jede Nennung in der Abrechnungsbestimmung, auch "
            "wenn sie Teil einer Nicht-neben-Regel ist („in gleicher Sitzung …“).",
            "**Intervalle – Kalenderwoche und Mindestabstand zur Vorgängerziffer:** Die Vorgabe nennt „2702, 2704 bis 2718“ bzw. "
            "„2702 bis 2718“. Den Wortlaut („frühestens fünf Tage nach … einmal je Kalenderwoche“) haben nur 2702 und die geraden "
            "Ziffern 2704 bis 2718; die ungeraden 2705 bis 2717 sind die Vorgängerziffern („einmal zu Beginn der Behandlung“) und "
            "wurden nicht zugeordnet. Bitte bestätigen.",
            "**Intervalle – Hyperfraktionierung (Mindestabstand 6 Stunden):** im Gebührenverzeichnis nicht gefunden; vermutlich in "
            "den Allgemeinen Bestimmungen, die nicht vorliegen. Unter „Mindestabstand am selben Tag“ stehen daher nur 1022 und 1023.",
            "**Intervalle – Jahr (365 Tage) und Monat (30 Tage):** Im Gebührenverzeichnis gibt es dafür keinen Wortlaut; beide "
            "Intervalle haben 0 Ziffern. Ob sie in der neuen GOÄ entfallen, ist fachlich zu bewerten.",
            "**Intervalle – Behandlungsfall:** Ziffern mit „Behandlungsfall“ stehen sowohl unter dem bestehenden Intervall als auch "
            "unter „Behandlungsfall (geänderte Definition)“, weil die bestehende Prüfung auf die neue Definition umzustellen ist. "
            "Falls sie nur unter einem der beiden erscheinen sollen, bitte melden.",
            "**Intervalle – fallbezogene Definitionen (AB A Nr. 5 und Nr. 6)** und alle Intervall-Regeln aus Allgemeinen "
            "Bestimmungen sind nicht ausgewertet; die Beschreibungen stammen aus der Vorgabe.",
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
    intervalle = lese_intervalle(gesetz.get("roh", {}))
    mapping = lese_mapping({int(z): int(v["_g"] * 100) for z, v in kap["K"].items()} if kap["datei"] else {})
    geschlecht = lese_geschlecht({int(z): int(v["_g"] * 100) for z, v in kap["K"].items()} if kap["datei"] else {},
                                 {int(z): v["kapitel"] for z, v in kap["K"].items()} if kap["datei"] else {})
    alter = lese_alter({int(z): int(v["_g"] * 100) for z, v in kap["K"].items()} if kap["datei"] else {},
                       {int(z): v["kapitel"] for z, v in kap["K"].items()} if kap["datei"] else {})
    js_obj = baue_json(daten, pdf, gesetz, kap, regeln, intervalle, mapping, geschlecht, alter)
    res = tests(daten, js_obj, kap, gesetz, regeln, intervalle, mapping, geschlecht, alter)

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

    schreibe_bericht(daten, pdf, gesetz, kap, regeln, intervalle, mapping, geschlecht, alter, res, ui, excels[0].name, [r[0] for r in js_obj["rows"]])
    for name, ok, ist in res:
        print(("OK   " if ok else "FAIL ") + name + "  →  " + ist)
    for c in (ui or {}).get("checks", []):
        print(("OK   " if c["ok"] else "FAIL ") + "[UI] " + c["name"] + "  →  " + str(c["ist"]))
    print(f"\n{DIST.relative_to(ROOT)}  ({DIST.stat().st_size / 1024:.0f} KB)\n{REPORT.relative_to(ROOT)}")
    if not all(o for _, o, _ in res) or any(not c["ok"] for c in (ui or {}).get("checks", [])):
        sys.exit(1)


if __name__ == "__main__":
    main()
