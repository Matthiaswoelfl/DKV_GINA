/* Rechenkern Budget- und Reichweitenrechner – Projekt GOÄ-Novelle.
 * Reine Funktionen, kein DOM. Läuft im Browser (window.Core) und in Node (require).
 *
 * Plan-Objekt:
 *   { projekt, start:'YYYY-MM-DD', weeks:n,
 *     parameters:{ daysPerFte, onsiteQuote, travelPerDay, vat, holidays, christmasBreak },
 *     rates:{ Rolle: Tagessatz }, roles:[{ id, type, fte:[n Werte 0..1] }] }
 *
 * Konventionen (siehe README "Annahmen"):
 *  - Plan-Woche 1 ist die Kalenderwoche des Startdatums (Montag bis Freitag).
 *  - Beratertage = FTE × Tage je FTE-Woche × (verfügbare Arbeitstage / 5).
 *    Ohne Feiertage und bei Start am Montag ist der Faktor 1 → exakt "Kapazität × 5" wie in Excel.
 *  - Reisekosten = Beratertage × Onsite-Quote × Reisekosten je Onsite-Tag (proportional je Woche).
 *  - Innerhalb einer Woche verteilen sich die Kosten gleichmäßig auf die verfügbaren Arbeitstage.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WORKWEEK = 5;               // Arbeitstage Mo–Fr je Kalenderwoche
  var EPS = 1e-9;
  var WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  // ---------- Datum ----------
  function parseISO(s) {                       // 'YYYY-MM-DD' -> Date (UTC, ohne Zeitzonen-Effekte)
    var p = String(s).split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }
  function toISO(d) { return d.toISOString().slice(0, 10); }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function mondayOf(d) { var wd = (d.getUTCDay() + 6) % 7; return addDays(d, -wd); }
  function isoWeek(d) {                        // ISO-8601-Kalenderwoche
    var t = addDays(d, 3 - ((d.getUTCDay() + 6) % 7));   // Donnerstag der Woche
    var y = t.getUTCFullYear();
    var jan4 = new Date(Date.UTC(y, 0, 4));
    var w = 1 + Math.round(((t - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
    return { year: y, week: w };
  }
  function formatDate(d) {                     // TT.MM.JJJJ
    var iso = toISO(d);
    return iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4);
  }
  function weekdayName(d) { return WEEKDAYS[d.getUTCDay()]; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function kwLabel(w) { return 'KW' + pad2(w); }

  // ---------- Feiertage (bundesweit) ----------
  function easterSunday(y) {                   // Gauß/Meeus-Algorithmus
    var a = y % 19, b = Math.floor(y / 100), c = y % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(y, mo - 1, da));
  }
  var holidayCache = {};
  function federalHolidays(y) {                // Set von ISO-Daten
    if (holidayCache[y]) return holidayCache[y];
    var e = easterSunday(y), s = {};
    [new Date(Date.UTC(y, 0, 1)), addDays(e, -2), addDays(e, 1), new Date(Date.UTC(y, 4, 1)),
      addDays(e, 39), addDays(e, 50), new Date(Date.UTC(y, 9, 3)),
      new Date(Date.UTC(y, 11, 25)), new Date(Date.UTC(y, 11, 26))
    ].forEach(function (d) { s[toISO(d)] = true; });
    return (holidayCache[y] = s);
  }
  /** Weihnachtspause: 24.12. bis 31.12. (Annahme). */
  function isChristmasBreak(d) { return d.getUTCMonth() === 11 && d.getUTCDate() >= 24; }

  // ---------- Wochenraster ----------
  /** Informationen zu Plan-Woche i: Montag, KW, verfügbare Arbeitstage (ISO-Daten). */
  function weekInfo(plan, i) {
    var start = parseISO(plan.start);
    var monday = addDays(mondayOf(start), 7 * i);
    var p = plan.parameters, days = [];
    for (var k = 0; k < WORKWEEK; k++) {
      var d = addDays(monday, k), iso = toISO(d);
      if (i === 0 && d < start) continue;                                  // vor Leistungsbeginn
      if (p.holidays && federalHolidays(d.getUTCFullYear())[iso]) continue;
      if (p.christmasBreak && isChristmasBreak(d)) continue;
      days.push(iso);
    }
    var iw = isoWeek(monday);
    return { index: i, monday: toISO(monday), kw: iw.week, year: iw.year,
      label: kwLabel(iw.week), days: days, avail: days.length };
  }

  // ---------- Rollen ----------
  /** Anzeigenamen: eindeutig → "Consultant", mehrfach → "Consultant 1", "Consultant 2". */
  function roleNames(plan) {
    var cnt = {}, seen = {};
    plan.roles.forEach(function (r) { cnt[r.type] = (cnt[r.type] || 0) + 1; });
    return plan.roles.map(function (r) {
      seen[r.type] = (seen[r.type] || 0) + 1;
      return cnt[r.type] > 1 ? r.type + ' ' + seen[r.type] : r.type;
    });
  }
  function round2(x) { return Math.round((x + (x >= 0 ? EPS : -EPS)) * 100) / 100; }

  // ---------- Hauptrechnung ----------
  /** Berechnet Wochen-, Rollen- und Gesamtwerte eines Plans. */
  function computePlan(plan) {
    var p = plan.parameters, names = roleNames(plan);
    var rate = plan.roles.map(function (r) { return +plan.rates[r.type] || 0; });
    var weeks = [], roleTot = plan.roles.map(function () { return { days: 0, fee: 0 }; });
    var totals = { days: 0, fee: 0, travel: 0 };
    for (var i = 0; i < plan.weeks; i++) {
      var wi = weekInfo(plan, i), f = wi.avail / WORKWEEK;
      var roleDays = [], roleFee = [], days = 0, fee = 0;
      plan.roles.forEach(function (r, j) {
        var d = (+r.fte[i] || 0) * p.daysPerFte * f;
        roleDays.push(d); roleFee.push(d * rate[j]);
        days += d; fee += d * rate[j];
        roleTot[j].days += d; roleTot[j].fee += d * rate[j];
      });
      var travel = days * p.onsiteQuote * p.travelPerDay;
      weeks.push({ info: wi, roleDays: roleDays, roleFee: roleFee, days: days, fee: fee,
        travel: travel, total: fee + travel });
      totals.days += days; totals.fee += fee; totals.travel += travel;
    }
    totals.net = totals.fee + totals.travel;
    totals.gross = totals.net * (1 + p.vat);
    return {
      weeks: weeks,
      roles: plan.roles.map(function (r, j) {
        return { id: r.id, type: r.type, name: names[j], rate: rate[j],
          days: round2(roleTot[j].days), fee: round2(roleTot[j].fee) };
      }),
      totals: { days: round2(totals.days), fee: round2(totals.fee), travel: round2(totals.travel),
        net: round2(totals.net), gross: round2(totals.gross) }
    };
  }

  function weekCost(w, includeTravel) { return w.fee + (includeTravel ? w.travel : 0); }

  /**
   * Reichweite eines Netto-Budgets.
   * opts.includeTravel: Reisekosten werden aus dem Budget bezahlt (Standard true).
   * Rückgabe-status: 'zero' (Budget ≤ 0) | 'within' (reicht bis endDate) | 'beyond' (reicht über das Planende hinaus).
   */
  function reach(plan, budgetNet, opts) {
    var inc = !opts || opts.includeTravel !== false;
    var calc = computePlan(plan), W = calc.weeks, n = plan.roles.length;
    var budget = Math.max(0, +budgetNet || 0);
    var res = { status: 'zero', budget: budget, includeTravel: inc, endDate: null, kw: null, year: null,
      lastFullDay: null, coveredDays: 0, coveredByRole: calc.roles.map(function () { return 0; }),
      used: 0, remaining: budget, weekIndex: null, weekFunded: 0, weekCostTotal: 0, weekShare: 0,
      planEnd: null, totalCost: 0, shortfall: 0 };
    var lastWeekDays = W[W.length - 1].info.days;
    res.planEnd = lastWeekDays.length ? lastWeekDays[lastWeekDays.length - 1] : W[W.length - 1].info.monday;
    var total = 0; W.forEach(function (w) { total += weekCost(w, inc); });
    res.totalCost = round2(total);
    if (budget <= 0) return res;

    var cum = 0, covered = 0, byRole = res.coveredByRole;
    for (var i = 0; i < W.length; i++) {
      var w = W[i], c = weekCost(w, inc);
      if (c > 0 && cum + c >= budget - EPS) {                 // Budget erschöpft sich in dieser Woche
        var rem = Math.min(c, budget - cum), share = rem / c;
        var dayPos = share * w.info.avail;                    // lineare Interpolation auf Arbeitstage
        var idx = Math.min(w.info.avail, Math.max(1, Math.ceil(dayPos - EPS)));
        var full = Math.floor(dayPos + EPS);
        res.status = 'within'; res.weekIndex = i;
        res.endDate = w.info.days[idx - 1]; res.kw = w.info.kw; res.year = w.info.year;
        res.lastFullDay = full >= 1 ? w.info.days[full - 1] : (i > 0 ? lastDayBefore(W, i) : null);
        res.coveredDays = round2(covered + w.days * share);
        res.coveredByRole = byRole.map(function (x, j) { return round2(x + w.roleDays[j] * share); });
        res.used = round2(budget); res.remaining = 0;
        res.weekFunded = round2(rem); res.weekCostTotal = round2(c); res.weekShare = share;
        return res;
      }
      cum += c; covered += w.days;
      for (var j = 0; j < n; j++) byRole[j] += w.roleDays[j];
    }
    res.status = 'beyond';
    res.endDate = res.planEnd; res.kw = W[W.length - 1].info.kw; res.year = W[W.length - 1].info.year;
    res.coveredDays = round2(covered);
    res.coveredByRole = byRole.map(round2);
    res.used = round2(cum); res.remaining = round2(budget - cum);
    return res;
  }
  function lastDayBefore(W, i) {
    for (var k = i - 1; k >= 0; k--) if (W[k].info.days.length) return W[k].info.days[W[k].info.days.length - 1];
    return null;
  }

  /** Umkehrrechnung: Netto-Kosten vom Leistungsbeginn bis einschließlich Zieldatum. */
  function budgetForDate(plan, dateISO, includeTravel) {
    var inc = includeTravel !== false, calc = computePlan(plan), cost = 0, days = 0;
    calc.weeks.forEach(function (w) {
      var c = weekCost(w, inc);
      if (!w.info.avail) return;
      var upTo = w.info.days.filter(function (d) { return d <= dateISO; }).length;
      var share = upTo / w.info.avail;
      cost += c * share; days += w.days * share;
    });
    var vat = plan.parameters.vat;
    return { net: round2(cost), gross: round2(cost * (1 + vat)), days: round2(days) };
  }

  /** Kennzahlen eines Szenarios für Vergleich und KPI-Leiste. */
  function summarize(plan, budgetNet, opts) {
    var calc = computePlan(plan);
    return { calc: calc, totals: calc.totals, reach: reach(plan, budgetNet, opts) };
  }

  // ---------- Plan-Bearbeitung (liefern immer neue Pläne) ----------
  function clonePlan(plan) { return JSON.parse(JSON.stringify(plan)); }
  var idCounter = 0;
  function newId() { idCounter += 1; return 'r' + Date.now().toString(36) + idCounter; }

  /** Baut aus der JSON-Konfiguration einen Plan. */
  function planFromConfig(cfg) {
    var p = cfg.parameters;
    return {
      projekt: cfg.projekt, start: cfg.start, weeks: cfg.weeks,
      parameters: { daysPerFte: p.daysPerFte, onsiteQuote: p.onsiteQuote, travelPerDay: p.travelPerDay,
        vat: p.vat, holidays: false, christmasBreak: false },
      rates: JSON.parse(JSON.stringify(cfg.rates)),
      roles: cfg.roles.map(function (r, i) { return { id: 'base' + i, type: r.type, fte: r.fte.slice() }; })
    };
  }
  /** Setzt FTE einer Rolle für Wochen from..to (0-basiert, inklusive). */
  function setRange(plan, roleId, from, to, fte) {
    var np = clonePlan(plan), v = Math.min(1, Math.max(0, fte));
    np.roles.forEach(function (r) {
      if (r.id !== roleId) return;
      for (var i = Math.max(0, from); i <= Math.min(np.weeks - 1, to); i++) r.fte[i] = v;
    });
    return np;
  }
  function addRole(plan, type) {
    var np = clonePlan(plan);
    var fte = []; for (var i = 0; i < np.weeks; i++) fte.push(0);
    np.roles.push({ id: newId(), type: type, fte: fte });
    return np;
  }
  function removeRole(plan, roleId) {
    var np = clonePlan(plan);
    np.roles = np.roles.filter(function (r) { return r.id !== roleId; });
    return np;
  }
  /** Verlängert den Plan um n Wochen; neue Wochen übernehmen die Auslastung der letzten Planwoche. */
  function extendWeeks(plan, n) {
    var np = clonePlan(plan), add = Math.max(0, Math.floor(n) || 0);
    np.roles.forEach(function (r) {
      var last = r.fte.length ? r.fte[r.fte.length - 1] : 0;
      for (var i = 0; i < add; i++) r.fte.push(last);
    });
    np.weeks += add;
    return np;
  }

  return {
    WORKWEEK: WORKWEEK, parseISO: parseISO, toISO: toISO, addDays: addDays, mondayOf: mondayOf,
    isoWeek: isoWeek, formatDate: formatDate, weekdayName: weekdayName, kwLabel: kwLabel,
    easterSunday: easterSunday, federalHolidays: federalHolidays, weekInfo: weekInfo,
    roleNames: roleNames, round2: round2, computePlan: computePlan, reach: reach,
    budgetForDate: budgetForDate, summarize: summarize, clonePlan: clonePlan,
    planFromConfig: planFromConfig, setRange: setRange, addRole: addRole,
    removeRole: removeRole, extendWeeks: extendWeeks
  };
});
