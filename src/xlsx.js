/* Excel-Export (.xlsx) mit echten Formeln – eigener minimaler Writer ohne Bibliothek.
 * Aufbau analog zur Ausgangsdatei: Kapazität → Beratertage → Honorar → Reisekosten → Gesamtaufwand.
 * Alle Tagessätze und Parameter stehen in Zellen; es gibt keine #REF!-Verweise und keine fest
 * verdrahteten Faktoren. Läuft im Browser (window.Xlsx) und in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.Xlsx = factory(root.Core);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  // Stile (Index in cellXfs): 0 normal, 1 fett, 2 Prozent, 3 Euro, 4 Zahl 0,00, 5 Kopf (fett+Fläche), 6 Euro fett
  var S = { normal: 0, bold: 1, pct: 2, eur: 3, num: 4, head: 5, eurBold: 6 };

  function colName(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /** Baut die Zellen: Liste von { r, c, v | f, s }. Gibt auch die Adressen der Kernzellen zurück. */
  function buildCells(plan, title) {
    var calc = Core.computePlan(plan), W = plan.weeks, N = plan.roles.length;
    var cells = [], c0 = 3, cTot = c0 + W;                       // Spalte C = erste KW
    var firstCol = colName(c0), lastCol = colName(c0 + W - 1), totCol = colName(cTot);
    function put(r, c, o) { o.r = r; o.c = c; cells.push(o); }
    function rng(r) { return firstCol + r + ':' + lastCol + r; }
    var names = calc.roles.map(function (x) { return x.name; });

    var row = 1;
    put(row, 1, { v: title, s: S.bold });
    row = 2; var rHead = row;
    put(row, 1, { v: 'Rolle', s: S.head }); put(row, 2, { v: 'Tagessatz', s: S.head });
    for (var i = 0; i < W; i++) put(row, c0 + i, { v: calc.weeks[i].info.label, s: S.head });
    put(row, cTot, { v: 'TOTAL', s: S.head });
    row = 3; put(row, 1, { v: 'Montag der Woche' });
    for (i = 0; i < W; i++) put(row, c0 + i, { v: Core.formatDate(Core.parseISO(calc.weeks[i].info.monday)) });
    row = 4; var rAvail = row; put(row, 1, { v: 'Verfügbare Arbeitstage (Mo–Fr)' });
    for (i = 0; i < W; i++) put(row, c0 + i, { v: calc.weeks[i].info.avail });
    put(row, cTot, { f: 'SUM(' + rng(row) + ')' });

    // Parameterblock zuerst positionieren (Adressen werden in Formeln gebraucht)
    var types = Object.keys(plan.rates);
    var rCapSec = 6, rCap0 = 7, rCapSum = rCap0 + N;
    var rDaySec = rCapSum + 2, rDay0 = rDaySec + 1, rDaySum = rDay0 + N;
    var rFeeSec = rDaySum + 2, rFee0 = rFeeSec + 1, rFeeSum = rFee0 + N;
    var rTravel = rFeeSum + 2, rNet = rTravel + 1, rGross = rNet + 1, rCum = rGross + 1;
    var rPar = rCum + 3;
    var P = { days: '$B$' + (rPar + 1), work: '$B$' + (rPar + 2), onsite: '$B$' + (rPar + 3), travel: '$B$' + (rPar + 4), vat: '$B$' + (rPar + 5) };
    var rRate0 = rPar + 8;

    put(rCapSec, 1, { v: 'Kapazität je KW (FTE-Anteil, 1 = volle Woche)', s: S.bold });
    calc.roles.forEach(function (ro, j) {
      var r = rCap0 + j, ti = types.indexOf(ro.type);
      put(r, 1, { v: names[j] });
      put(r, 2, { f: '$B$' + (rRate0 + ti), s: S.eur });
      for (var k = 0; k < W; k++) put(r, c0 + k, { v: plan.roles[j].fte[k] || 0, s: S.pct });
      put(r, cTot, { f: 'AVERAGE(' + rng(r) + ')', s: S.pct });
    });
    put(rCapSum, 1, { v: 'Gesamtkapazität', s: S.bold });
    for (i = 0; i < W; i++) { var cl = colName(c0 + i); put(rCapSum, c0 + i, { f: 'SUM(' + cl + rCap0 + ':' + cl + (rCapSum - 1) + ')', s: S.pct }); }

    put(rDaySec, 1, { v: 'Beratertage je KW  (= FTE × Tage je FTE-Woche × verfügbare Arbeitstage / Arbeitstage Mo–Fr)', s: S.bold });
    names.forEach(function (n, j) {
      var r = rDay0 + j; put(r, 1, { v: n });
      for (var k = 0; k < W; k++) { var cl2 = colName(c0 + k);
        put(r, c0 + k, { f: cl2 + (rCap0 + j) + '*' + P.days + '*' + cl2 + '$' + rAvail + '/' + P.work, s: S.num }); }
      put(r, cTot, { f: 'SUM(' + rng(r) + ')', s: S.num });
    });
    put(rDaySum, 1, { v: 'Gesamtkapazität Beratertage', s: S.bold });
    for (i = 0; i <= W; i++) { var cc = colName(c0 + i);
      put(rDaySum, c0 + i, { f: 'SUM(' + cc + rDay0 + ':' + cc + (rDaySum - 1) + ')', s: S.num }); }

    put(rFeeSec, 1, { v: 'Honorar je KW (Tagessatz × Beratertage, netto)', s: S.bold });
    names.forEach(function (n, j) {
      var r = rFee0 + j; put(r, 1, { v: n });
      for (var k = 0; k < W; k++) { var cl3 = colName(c0 + k);
        put(r, c0 + k, { f: '$B$' + (rCap0 + j) + '*' + cl3 + (rDay0 + j), s: S.eur }); }
      put(r, cTot, { f: 'SUM(' + rng(r) + ')', s: S.eur });
    });
    put(rFeeSum, 1, { v: 'Gesamtberatungsbudget netto ohne Nebenkosten', s: S.bold });
    for (i = 0; i <= W; i++) { var c4 = colName(c0 + i);
      put(rFeeSum, c0 + i, { f: 'SUM(' + c4 + rFee0 + ':' + c4 + (rFeeSum - 1) + ')', s: S.eurBold }); }

    put(rTravel, 1, { v: 'Reisekosten (Beratertage × Onsite-Quote × Kosten je Onsite-Tag)' });
    put(rNet, 1, { v: 'Gesamtaufwand (Budget netto)', s: S.bold });
    put(rGross, 1, { v: 'Gesamtaufwand (Budget brutto) inkl. MwSt.', s: S.bold });
    put(rCum, 1, { v: 'Kumuliert netto' });
    for (i = 0; i < W; i++) { var c5 = colName(c0 + i), prev = colName(c0 + i - 1);
      put(rTravel, c0 + i, { f: c5 + rDaySum + '*' + P.onsite + '*' + P.travel, s: S.eur });
      put(rNet, c0 + i, { f: c5 + rFeeSum + '+' + c5 + rTravel, s: S.eur });
      put(rGross, c0 + i, { f: c5 + rNet + '*(1+' + P.vat + ')', s: S.eur });
      put(rCum, c0 + i, { f: i === 0 ? c5 + rNet : prev + rCum + '+' + c5 + rNet, s: S.eur });
    }
    put(rTravel, cTot, { f: 'SUM(' + rng(rTravel) + ')', s: S.eur });
    put(rNet, cTot, { f: 'SUM(' + rng(rNet) + ')', s: S.eurBold });
    put(rGross, cTot, { f: 'SUM(' + rng(rGross) + ')', s: S.eurBold });

    var p = plan.parameters;
    put(rPar, 1, { v: 'Parameter', s: S.bold });
    put(rPar + 1, 1, { v: 'Tage je FTE-Woche' }); put(rPar + 1, 2, { v: p.daysPerFte });
    put(rPar + 2, 1, { v: 'Arbeitstage je Kalenderwoche (Mo–Fr)' }); put(rPar + 2, 2, { v: Core.WORKWEEK });
    put(rPar + 3, 1, { v: 'Onsite-Quote' }); put(rPar + 3, 2, { v: p.onsiteQuote, s: S.pct });
    put(rPar + 4, 1, { v: 'Reisekosten je Onsite-Tag' }); put(rPar + 4, 2, { v: p.travelPerDay, s: S.eur });
    put(rPar + 5, 1, { v: 'MwSt.' }); put(rPar + 5, 2, { v: p.vat, s: S.pct });
    put(rRate0 - 1, 1, { v: 'Tagessatztabelle', s: S.bold });
    types.forEach(function (t, k) { put(rRate0 + k, 1, { v: t }); put(rRate0 + k, 2, { v: plan.rates[t], s: S.eur }); });
    put(rRate0 + types.length + 1, 1, { v: 'Start: ' + Core.formatDate(Core.parseISO(plan.start)) + (p.holidays ? ' · Feiertage berücksichtigt' : '') + (p.christmasBreak ? ' · Weihnachtspause berücksichtigt' : '') });
    return { cells: cells, addr: { net: totCol + rNet, gross: totCol + rGross, days: totCol + rDaySum, fee: totCol + rFeeSum, travel: totCol + rTravel }, rows: rRate0 + types.length + 1, cols: cTot };
  }

  function sheetXml(model) {
    var byRow = {};
    model.cells.forEach(function (c) { (byRow[c.r] = byRow[c.r] || []).push(c); });
    var out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="2" topLeftCell="C3" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="46" customWidth="1"/><col min="2" max="2" width="14" customWidth="1"/><col min="3" max="' + model.cols + '" width="11" customWidth="1"/></cols><sheetData>';
    Object.keys(byRow).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
      out += '<row r="' + r + '">';
      byRow[r].sort(function (a, b) { return a.c - b.c; }).forEach(function (c) {
        var ref = colName(c.c) + c.r, st = c.s ? ' s="' + c.s + '"' : '';
        if (c.f !== undefined) out += '<c r="' + ref + '"' + st + '><f>' + esc(c.f) + '</f></c>';
        else if (typeof c.v === 'number') out += '<c r="' + ref + '"' + st + '><v>' + c.v + '</v></c>';
        else out += '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + esc(c.v) + '</t></is></c>';
      });
      out += '</row>';
    });
    return out + '</sheetData></worksheet>';
  }

  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="0.00"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE9F0"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs></styleSheet>';

  // ---------- minimaler ZIP-Writer (ohne Kompression) ----------
  var crcTable = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return new TextEncoder().encode(s); }
  function zip(files) {
    var parts = [], central = [], offset = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = utf8(f.name), data = utf8(f.data), crc = crc32(data);
      var head = [0x50, 0x4b, 3, 4].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(Uint8Array.from(head), name, data);
      central.push(Uint8Array.from([0x50, 0x4b, 1, 2].concat(u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
      offset += head.length + name.length + data.length;
    });
    var cdSize = 0; central.forEach(function (p) { cdSize += p.length; });
    var end = Uint8Array.from([0x50, 0x4b, 5, 6].concat(u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
    var all = parts.concat(central, [end]), total = 0; all.forEach(function (p) { total += p.length; });
    var out = new Uint8Array(total), pos = 0; all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  /** Erzeugt die .xlsx-Datei als Uint8Array. */
  function build(plan, title) {
    var model = buildCells(plan, title || ('Projekt GOÄ-Novelle | ' + Core.formatDate(Core.parseISO(plan.start))));
    var X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    var files = [
      { name: '[Content_Types].xml', data: X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Budget" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: STYLES },
      { name: 'xl/worksheets/sheet1.xml', data: sheetXml(model) }
    ];
    return { bytes: zip(files), addr: model.addr };
  }

  return { build: build, buildCells: buildCells, colName: colName };
});
