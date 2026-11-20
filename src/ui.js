/* Oberfläche. Alle Berechnungen liegen in Core (src/core.js); hier nur Darstellung und Ereignisse.
 * BASE_CONFIG wird beim Build aus config/basisplan.json eingebettet. */
(function () {
  'use strict';
  var C = window.Core, X = window.Xlsx;
  var BASE = C.planFromConfig(window.BASE_CONFIG);        // Basisplan: immer im Code hinterlegt
  var STORE = 'goae-budget-szenarien-v1';
  var COLORS = ['#0b4f6c', '#5a9bb8', '#b08968', '#7a8b99', '#c0a062', '#6b8f71', '#a05a5a', '#8d7aa8'];
  var TRAVEL_COLOR = '#c9ced3';

  var state = {
    plan: C.clonePlan(BASE),
    budget: { text: '200.000', amount: 200000, gross: false, includeTravel: true },
    target: '2027-03-31', scenarios: [], tab: 'kap'
  };

  // ---------- Formatierung ----------
  var nfEur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nfEur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
  var nfNum = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  var nfPct = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  function eur(x) { return nfEur.format(x); }
  function eurS(x) { return Number.isInteger(Math.round(x * 100) / 100) ? nfEur0.format(Math.round(x)) : nfEur.format(x); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function dFmt(iso) { return C.formatDate(C.parseISO(iso)); }
  function dLong(iso) { return C.weekdayName(C.parseISO(iso)) + ', ' + dFmt(iso); }
  function $(id) { return document.getElementById(id); }
  function signed(x, f) { return (x > 0 ? '+' : x < 0 ? '−' : '') + f(Math.abs(x)); }

  /** Freitext → Zahl. Akzeptiert "200.000", "200000", "200k", "1,5k", "200.000 €". */
  function parseAmount(t) {
    var s = String(t).toLowerCase().replace(/[€\s]/g, ''), mult = 1;
    if (/k$/.test(s)) { mult = 1000; s = s.slice(0, -1); }
    s = s.replace(/\./g, '').replace(',', '.');
    var v = parseFloat(s);
    return isFinite(v) && v >= 0 ? v * mult : NaN;
  }

  // ---------- Ableitungen ----------
  function netBudget() { return state.budget.gross ? state.budget.amount / (1 + state.plan.parameters.vat) : state.budget.amount; }
  function compute() {
    var net = netBudget();
    return { net: net, S: C.summarize(state.plan, net, { includeTravel: state.budget.includeTravel }) };
  }
  function reachSentence(R, b, vat) {
    var basis = b.gross ? ' brutto' : ' netto';
    var trv = b.includeTravel ? 'inkl. Reisekosten' : 'Reisekosten nicht im Budget';
    var amt = eurS(b.amount) + basis;
    if (R.status === 'zero') return { cls: 'warn', text: 'Mit ' + eurS(b.amount) + ' ist keine Leistung finanziert – das Budget deckt keinen Beratertag.' };
    if (R.status === 'beyond') {
      var rest = b.gross ? R.remaining * (1 + vat) : R.remaining;
      return { cls: '', text: 'Mit ' + amt + ' (' + trv + ') reicht das Budget bei aktueller Teamaufstellung über das Planende hinaus (Planende: ' +
        dLong(R.planEnd) + ', KW ' + R.kw + '/' + R.year + '). Es bleiben ' + eurS(rest) + basis + ' übrig.' };
    }
    return { cls: '', text: 'Mit ' + amt + ' (' + trv + ') reicht das Budget bei aktueller Teamaufstellung bis ca. ' +
      dLong(R.endDate) + ' (KW ' + R.kw + '/' + R.year + ').' };
  }
  function reachShort(R) {
    if (R.status === 'zero') return 'kein Budget';
    if (R.status === 'beyond') return 'über Planende';
    return dFmt(R.endDate) + ' (KW ' + R.kw + ')';
  }

  // ---------- Diagramme (SVG) ----------
  function niceMax(v) {
    if (v <= 0) return { max: 1, step: 0.25 };
    var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p, s = n <= 1 ? 0.2 : n <= 2 ? 0.5 : n <= 5 ? 1 : 2;
    var step = s * p, max = Math.ceil(v / step) * step; return { max: max, step: step };
  }
  function tK(v) { return nfNum.format(v / 1000) + ' T€'; }
  function axisX(W, x, h, mb) {
    var o = '', every = W.length > 30 ? 4 : 2;
    W.forEach(function (w, i) { if (i % every === 0) o += '<text x="' + x(i + 0.5) + '" y="' + (h - mb + 14) + '" text-anchor="middle">' + w.info.label + '</text>'; });
    return o;
  }
  function chartCum(S, net, inc) {
    var W = S.calc.weeks, R = S.reach, n = W.length, w = 900, h = 320, ml = 62, mr = 16, mt = 16, mb = 34;
    var cum = [0], t = 0; W.forEach(function (k) { t += k.fee + (inc ? k.travel : 0); cum.push(t); });
    var ymax = niceMax(Math.max(t, net) * 1.05), pw = w - ml - mr, ph = h - mt - mb;
    function x(i) { return ml + pw * i / n; } function y(v) { return mt + ph - ph * v / ymax.max; }
    var o = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Kumulierte Kosten mit Budgetlinie">';
    for (var g = 0; g <= ymax.max + 1e-6; g += ymax.step) o += '<line x1="' + ml + '" x2="' + (w - mr) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#e7ecf0"/><text x="' + (ml - 6) + '" y="' + (y(g) + 4) + '" text-anchor="end">' + tK(g) + '</text>';
    o += axisX(W, x, h, mb);
    o += '<polyline fill="none" stroke="' + COLORS[0] + '" stroke-width="2.5" points="' + cum.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ') + '"/>';
    if (net > 0) o += '<line x1="' + ml + '" x2="' + (w - mr) + '" y1="' + y(net) + '" y2="' + y(net) + '" stroke="#9a5b00" stroke-width="1.5" stroke-dasharray="6 4"/><text x="' + (w - mr) + '" y="' + (y(net) - 5) + '" text-anchor="end" style="fill:#9a5b00">Budget ' + eurS(net) + ' netto</text>';
    if (R.status === 'within') {
      var px = x(R.weekIndex + R.weekShare), py = y(net);
      var left = px > w * 0.65, tx = left ? px - 10 : px + 10;
      o += '<line x1="' + px + '" x2="' + px + '" y1="' + py + '" y2="' + (mt + ph) + '" stroke="#9a5b00" stroke-dasharray="2 3"/><circle cx="' + px + '" cy="' + py + '" r="6" fill="#fff" stroke="#9a5b00" stroke-width="3"/>' +
        '<text x="' + tx + '" y="' + (py + 22) + '" text-anchor="' + (left ? 'end' : 'start') + '" style="font-weight:600;font-size:12px;fill:#9a5b00">Budget reicht bis ' + dFmt(R.endDate) + '</text>';
    }
    return o + '</svg>';
  }
  function chartBars(S, inc) {
    var W = S.calc.weeks, roles = S.calc.roles, n = W.length, w = 900, h = 280, ml = 62, mr = 16, mt = 12, mb = 34;
    var mx = 0; W.forEach(function (k) { mx = Math.max(mx, k.fee + (inc ? k.travel : 0)); });
    var ym = niceMax(mx * 1.05), pw = w - ml - mr, ph = h - mt - mb, bw = pw / n * 0.7;
    function x(i) { return ml + pw * i / n; } function y(v) { return mt + ph - ph * v / ym.max; }
    var o = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Wochenkosten je Rolle">';
    for (var g = 0; g <= ym.max + 1e-6; g += ym.step) o += '<line x1="' + ml + '" x2="' + (w - mr) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#e7ecf0"/><text x="' + (ml - 6) + '" y="' + (y(g) + 4) + '" text-anchor="end">' + tK(g) + '</text>';
    W.forEach(function (k, i) {
      var base = 0, bx = x(i) + (pw / n - bw) / 2, tip = k.info.label + ' (ab ' + dFmt(k.info.monday) + ')';
      roles.forEach(function (r, j) {
        var v = k.roleFee[j]; if (v <= 0) return;
        o += '<rect x="' + bx + '" y="' + y(base + v) + '" width="' + bw + '" height="' + (y(base) - y(base + v)) + '" fill="' + COLORS[j % COLORS.length] + '"><title>' + tip + ' · ' + esc(r.name) + ': ' + eur(v) + '</title></rect>'; base += v;
      });
      if (inc && k.travel > 0) { o += '<rect x="' + bx + '" y="' + y(base + k.travel) + '" width="' + bw + '" height="' + (y(base) - y(base + k.travel)) + '" fill="' + TRAVEL_COLOR + '"><title>' + tip + ' · Reisekosten: ' + eur(k.travel) + '</title></rect>'; }
    });
    return o + axisX(W, x, h, mb) + '</svg>';
  }
  function legend(S, inc) {
    var l = S.calc.roles.map(function (r, j) { return '<span><i style="background:' + COLORS[j % COLORS.length] + '"></i>' + esc(r.name) + '</span>'; });
    if (inc) l.push('<span><i style="background:' + TRAVEL_COLOR + '"></i>Reisekosten</span>');
    return '<div class="legend">' + l.join('') + '</div>';
  }
  function chartHeat(S) {
    var W = S.calc.weeks, roles = S.calc.roles, plan = state.plan, n = W.length, w = 900, lw = 120, cw = (w - lw - 8) / n, ch = 26, h = 22 + roles.length * ch + 6;
    var o = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Kapazität je Rolle und KW">';
    W.forEach(function (k, i) { if (i % (n > 30 ? 4 : 2) === 0) o += '<text x="' + (lw + i * cw + cw / 2) + '" y="14" text-anchor="middle">' + k.info.label + '</text>'; });
    roles.forEach(function (r, j) {
      var y0 = 22 + j * ch;
      o += '<text x="' + (lw - 8) + '" y="' + (y0 + ch / 2 + 4) + '" text-anchor="end">' + esc(r.name) + '</text>';
      W.forEach(function (k, i) {
        var v = plan.roles[j].fte[i] || 0;
        o += '<rect x="' + (lw + i * cw + 0.5) + '" y="' + (y0 + 1) + '" width="' + (cw - 1) + '" height="' + (ch - 2) + '" rx="2" fill="' + (v > 0 ? '#0b4f6c' : '#f1f4f6') + '" fill-opacity="' + (v > 0 ? 0.15 + 0.85 * v : 1) + '"><title>' + esc(r.name) + ', ' + k.info.label + ': ' + Math.round(v * 100) + ' %</title></rect>';
        if (cw > 24 && v > 0) o += '<text x="' + (lw + i * cw + cw / 2) + '" y="' + (y0 + ch / 2 + 4) + '" text-anchor="middle" style="font-size:9px;fill:' + (v > 0.5 ? '#fff' : '#1c2530') + '">' + Math.round(v * 100) + '</text>';
      });
    });
    return o + '</svg>';
  }

  // ---------- Ergebnisbereiche ----------
  function renderResult(cp) {
    var R = cp.S.reach, T = cp.S.totals, b = state.budget, vat = state.plan.parameters.vat, st = reachSentence(R, b, vat);
    $('sentence').className = 'big ' + st.cls; $('sentence').textContent = st.text;
    var roleRows = cp.S.calc.roles.map(function (r, j) { return '<tr><td>' + esc(r.name) + '</td><td>' + nfNum.format(R.coveredByRole[j]) + '</td><td>' + nfNum.format(r.days) + '</td></tr>'; }).join('');
    var d = '<div><span>Abgedeckte Beratertage gesamt</span><b>' + nfNum.format(R.coveredDays) + ' von ' + nfNum.format(T.days) + '</b></div>';
    d += '<div><span>Verbrauchtes Budget</span><b>' + eur(R.used) + ' netto / ' + eur(R.used * (1 + vat)) + ' brutto</b></div>';
    if (R.status === 'within') {
      d += '<div><span>Finanziert in der letzten Woche (KW ' + R.kw + ')</span><b>' + eur(R.weekFunded) + ' von ' + eur(R.weekCostTotal) + ' (' + nfPct.format(R.weekShare * 100) + ' %)</b></div>';
      d += '<div><span>Letzter voll gedeckter Arbeitstag</span><b>' + (R.lastFullDay ? dLong(R.lastFullDay) : 'keiner') + '</b></div>';
    }
    if (R.status === 'beyond') d += '<div><span>Übriges Budget</span><b>' + eur(R.remaining) + ' netto / ' + eur(R.remaining * (1 + vat)) + ' brutto</b></div>';
    var gap = R.totalCost - R.budget;
    d += '<div><span>Gesamtplan nach Abzug des Vorschusses (' + (b.includeTravel ? 'inkl.' : 'ohne') + ' Reisekosten, netto)</span><b>' + (gap > 0 ? 'noch ungedeckt: ' + eur(gap) : 'Budget übersteigt Plan um ' + eur(-gap)) + '</b></div>';
    $('details').innerHTML = d;
    $('roletable').innerHTML = '<table><tr><th>Rolle</th><th>Beratertage abgedeckt</th><th>Beratertage Gesamtplan</th></tr>' + roleRows + '</table>';
  }
  function renderKpis(cp) {
    var T = cp.S.totals;
    var k = [['Gesamtaufwand netto (inkl. Reise)', eur(T.net)], ['Gesamtaufwand brutto', eur(T.gross)], ['Beratertage gesamt', nfNum.format(T.days)], ['Reichweite des Budgets', reachShort(cp.S.reach)]];
    var html = k.map(function (x, i) { return '<div class="kpi' + (i === 3 ? ' acc' : '') + '"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('');
    $('kpis').innerHTML = html; $('sb-kpis').innerHTML = html;
  }
  function renderCharts(cp) {
    var inc = state.budget.includeTravel, cum = chartCum(cp.S, cp.net, inc);
    $('ch-cum').innerHTML = cum; $('sb-cum').innerHTML = cum;
    $('ch-bars').innerHTML = chartBars(cp.S, inc); $('ch-legend').innerHTML = legend(cp.S, inc);
    $('ch-heat').innerHTML = chartHeat(cp.S);
  }
  function renderInverse() {
    var t = state.target, el = $('inv-out');
    if (!t) { el.textContent = 'Bitte ein Zieldatum wählen.'; return; }
    var r = C.budgetForDate(state.plan, t, state.budget.includeTravel);
    el.innerHTML = 'Bis einschließlich ' + dLong(t) + ' werden <b>' + nfNum.format(r.days) + ' Beratertage</b> benötigt.<br>Benötigtes Budget: <b>' + eur(r.net) + ' netto</b> / <b>' + eur(r.gross) + ' brutto</b> (' + (state.budget.includeTravel ? 'inkl.' : 'ohne') + ' Reisekosten).';
  }
  function renderSteckbrief(cp) {
    var R = cp.S.reach, st = reachSentence(R, state.budget, state.plan.parameters.vat), p = state.plan.parameters;
    $('sb-sentence').textContent = st.text;
    $('sb-date').textContent = 'Stand ' + dFmt(C.toISO(new Date())) + ' · Leistungsbeginn ' + dFmt(state.plan.start) + ' · ' + state.plan.weeks + ' Wochen';
    $('sb-roles').innerHTML = $('roletable').innerHTML;
    $('sb-ann').textContent = 'Annahmen: ' + p.daysPerFte + ' Tage je FTE-Woche · ' + nfPct.format(p.onsiteQuote * 100) + ' % Onsite · ' + eurS(p.travelPerDay) + ' je Onsite-Tag · MwSt. ' + nfPct.format(p.vat * 100) + ' % · Feiertage ' + (p.holidays ? 'berücksichtigt' : 'nicht berücksichtigt') + '.';
  }
  function update() {
    var cp = compute();
    renderResult(cp); renderKpis(cp); renderCharts(cp); renderInverse(); renderSteckbrief(cp);
    renderCompare(cp);
  }

  // ---------- Szenarien ----------
  function loadStore() { try { var s = JSON.parse(localStorage.getItem(STORE) || '[]'); if (Array.isArray(s)) state.scenarios = s.filter(function (x) { return x && x.name && x.plan; }); } catch (e) { /* ohne Speicher weiterarbeiten */ } }
  function saveStore() { try { localStorage.setItem(STORE, JSON.stringify(state.scenarios)); } catch (e) { $('sc-msg').textContent = 'Hinweis: Browser-Speicher nicht verfügbar – Szenarien gelten nur bis zum Schließen.'; } }
  function renderScenarioList() {
    $('sc-list').innerHTML = state.scenarios.length ? state.scenarios.map(function (s, i) {
      return '<li>' + esc(s.name) + ' <button class="link" data-sc-load="' + i + '">Laden</button><button class="link" data-sc-del="' + i + '">Löschen</button></li>';
    }).join('') : '<li class="note">Noch keine Szenarien gespeichert (Basisplan ist immer vorhanden).</li>';
  }
  function renderCompare(cp) {
    var net = cp.net, opts = { includeTravel: state.budget.includeTravel }, start = state.plan.start;
    var cols = [{ name: 'Basisplan', plan: BASE }].concat(state.scenarios, [{ name: 'Aktuell (Editor)', plan: state.plan }]);
    var res = cols.map(function (c) { var p = C.clonePlan(c.plan); p.start = start; return { name: c.name, S: C.summarize(p, net, opts) }; });
    var types = []; res.forEach(function (r) { r.S.calc.roles.forEach(function (ro) { if (types.indexOf(ro.name) < 0) types.push(ro.name); }); });
    var b = res[0];
    function dayOf(r, nm) { var f = r.S.calc.roles.filter(function (x) { return x.name === nm; })[0]; return f ? f.days : 0; }
    function reachDays(r) { var R = r.S.reach; return R.status === 'within' ? R.endDate : (R.status === 'beyond' ? '9999-12-31' : null); }
    function dcell(v, f, invert) { if (Math.abs(v) < 0.005) return '<td>–</td>'; var good = invert ? v > 0 : v < 0; return '<td class="' + (good ? 'delta-neg' : 'delta-pos') + '">' + signed(v, f) + '</td>'; }
    var h = '<tr><th></th>' + res.map(function (r) { return '<th>' + esc(r.name) + '</th>'; }).join('') + '</tr>';
    function line(label, fn) { return '<tr><td>' + label + '</td>' + res.map(fn).join('') + '</tr>'; }
    h += line('Gesamtkosten netto', function (r) { return '<td>' + eur(r.S.totals.net) + '</td>'; });
    h += line('Gesamtkosten brutto', function (r) { return '<td>' + eur(r.S.totals.gross) + '</td>'; });
    h += line('Beratertage gesamt', function (r) { return '<td>' + nfNum.format(r.S.totals.days) + '</td>'; });
    types.forEach(function (t) { h += line('&nbsp;&nbsp;' + esc(t), function (r) { return '<td>' + nfNum.format(dayOf(r, t)) + '</td>'; }); });
    h += line('Reichweite von ' + eurS(state.budget.gross ? net * (1 + state.plan.parameters.vat) : net) + (state.budget.gross ? ' brutto' : ' netto'), function (r) { return '<td>' + reachShort(r.S.reach) + '</td>'; });
    h += line('Δ Kosten netto zum Basisplan', function (r, i) { return i === 0 ? '<td>–</td>' : dcell(r.S.totals.net - b.S.totals.net, eur, false); });
    h += line('Δ Beratertage zum Basisplan', function (r, i) { return i === 0 ? '<td>–</td>' : dcell(r.S.totals.days - b.S.totals.days, nfNum.format.bind(nfNum), false); });
    h += line('Δ Reichweite (Kalendertage)', function (r, i) {
      if (i === 0) return '<td>–</td>'; var a = reachDays(r), z = reachDays(b); if (!a || !z) return '<td>–</td>';
      if (a === z) return '<td>–</td>'; if (a === '9999-12-31' || z === '9999-12-31') return '<td>' + (a === '9999-12-31' ? 'über Planende' : 'kürzer') + '</td>';
      var dd = Math.round((C.parseISO(a) - C.parseISO(z)) / 86400000); return dcell(dd, function (v) { return v + ' Tage'; }, true);
    });
    $('sc-table').innerHTML = '<table>' + h + '</table>';
  }

  // ---------- Kapazitätsmatrix ----------
  function weekOptions(sel) {
    var cp = C.computePlan(state.plan);
    return cp.weeks.map(function (w, i) { return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + w.info.label + '/' + w.info.year + '</option>'; }).join('');
  }
  function renderMatrix() {
    var plan = state.plan, cp = C.computePlan(plan), W = cp.weeks;
    var h = '<table class="mx"><tr><th>Rolle</th>' + W.map(function (w) { return '<th title="ab ' + dFmt(w.info.monday) + '">' + w.info.label + '</th>'; }).join('') + '<th></th></tr>';
    plan.roles.forEach(function (r, j) {
      h += '<tr><td>' + esc(cp.roles[j].name) + '</td>' + W.map(function (w, i) {
        return '<td><input type="number" min="0" max="100" step="5" data-r="' + j + '" data-w="' + i + '" value="' + Math.round((r.fte[i] || 0) * 100) + '" aria-label="' + esc(cp.roles[j].name) + ' ' + w.info.label + ' in Prozent"></td>';
      }).join('') + '<td><button class="link" data-rm="' + j + '" title="Rolle entfernen">entfernen</button></td></tr>';
    });
    $('matrix').innerHTML = h + '</table>';
    var sel = plan.roles.map(function (r, j) { return '<option value="' + j + '">' + esc(cp.roles[j].name) + '</option>'; }).join('');
    $('rg-role').innerHTML = sel; $('rg-from').innerHTML = weekOptions(0); $('rg-to').innerHTML = weekOptions(plan.weeks - 1);
    $('add-type').innerHTML = Object.keys(plan.rates).map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('');
    renderParams();
  }
  function renderParams() {
    var p = state.plan.parameters;
    $('p-days').value = p.daysPerFte; $('p-onsite').value = nfPct.format(p.onsiteQuote * 100).replace(',', '.');
    $('p-travel').value = p.travelPerDay; $('p-vat').value = nfPct.format(p.vat * 100).replace(',', '.');
    $('p-hol').checked = !!p.holidays; $('p-xmas').checked = !!p.christmasBreak;
    $('rates').innerHTML = Object.keys(state.plan.rates).map(function (t) {
      return '<tr><td>' + esc(t) + '</td><td><input type="number" min="0" step="10" data-rate="' + esc(t) + '" value="' + state.plan.rates[t] + '"> €</td></tr>';
    }).join('');
    $('start').value = state.plan.start;
  }

  // ---------- Ereignisse ----------
  function setTab(t) {
    state.tab = t;
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    document.querySelectorAll('.pane').forEach(function (p) { p.hidden = p.id !== 'pane-' + t; });
  }
  function readNum(el, min, max, dflt) { var v = parseFloat(String(el.value).replace(',', '.')); if (!isFinite(v)) return dflt; return Math.min(max, Math.max(min, v)); }
  function bind() {
    $('budget').addEventListener('input', function (e) {
      var v = parseAmount(e.target.value); $('budget-err').textContent = isFinite(v) ? '' : 'Bitte einen Betrag eingeben (z. B. 200.000 oder 200k).';
      if (isFinite(v)) { state.budget.amount = v; update(); }
    });
    document.querySelectorAll('[data-quick]').forEach(function (b) { b.addEventListener('click', function () { var v = +b.dataset.quick; state.budget.amount = v; $('budget').value = nfNum.format(v); $('budget-err').textContent = ''; update(); }); });
    document.querySelectorAll('input[name=basis]').forEach(function (r) { r.addEventListener('change', function () { if (r.checked) { state.budget.gross = r.value === 'gross'; update(); } }); });
    $('inc-travel').addEventListener('change', function (e) { state.budget.includeTravel = e.target.checked; update(); });
    $('start').addEventListener('change', function (e) { if (e.target.value) { state.plan.start = e.target.value; renderMatrix(); update(); } });
    $('target').addEventListener('change', function (e) { state.target = e.target.value; renderInverse(); });
    $('matrix').addEventListener('input', function (e) {
      var t = e.target; if (t.dataset.r === undefined) return;
      var v = Math.min(100, Math.max(0, parseFloat(t.value) || 0)); state.plan.roles[+t.dataset.r].fte[+t.dataset.w] = v / 100; update();
    });
    $('matrix').addEventListener('change', function (e) { var t = e.target; if (t.dataset.r === undefined) return; var v = Math.round(Math.min(100, Math.max(0, parseFloat(t.value) || 0)) / 5) * 5; t.value = v; state.plan.roles[+t.dataset.r].fte[+t.dataset.w] = v / 100; update(); });
    $('matrix').addEventListener('click', function (e) { if (e.target.dataset.rm !== undefined) { state.plan = C.removeRole(state.plan, state.plan.roles[+e.target.dataset.rm].id); renderMatrix(); update(); } });
    $('rg-go').addEventListener('click', function () {
      var j = +$('rg-role').value, a = +$('rg-from').value, b = +$('rg-to').value, v = +$('rg-val').value / 100;
      if (b < a) { var t = a; a = b; b = t; }
      state.plan = C.setRange(state.plan, state.plan.roles[j].id, a, b, v); renderMatrix(); update();
    });
    $('add-go').addEventListener('click', function () { state.plan = C.addRole(state.plan, $('add-type').value); renderMatrix(); update(); });
    $('ext-go').addEventListener('click', function () { state.plan = C.extendWeeks(state.plan, readNum($('ext-n'), 1, 52, 4)); renderMatrix(); update(); });
    $('reset').addEventListener('click', function () { if (confirm('Ausgangsplan wiederherstellen? Alle Änderungen im Editor gehen verloren (gespeicherte Szenarien bleiben).')) { state.plan = C.clonePlan(BASE); renderMatrix(); update(); } });
    $('p-days').addEventListener('input', function (e) { state.plan.parameters.daysPerFte = readNum(e.target, 0.5, 7, 5); update(); });
    $('p-onsite').addEventListener('input', function (e) { state.plan.parameters.onsiteQuote = readNum(e.target, 0, 100, 40) / 100; update(); });
    $('p-travel').addEventListener('input', function (e) { state.plan.parameters.travelPerDay = readNum(e.target, 0, 10000, 200); update(); });
    $('p-vat').addEventListener('input', function (e) { state.plan.parameters.vat = readNum(e.target, 0, 100, 19) / 100; update(); });
    $('p-hol').addEventListener('change', function (e) { state.plan.parameters.holidays = e.target.checked; renderMatrix(); update(); });
    $('p-xmas').addEventListener('change', function (e) { state.plan.parameters.christmasBreak = e.target.checked; renderMatrix(); update(); });
    $('rates').addEventListener('input', function (e) { var t = e.target; if (t.dataset.rate) { state.plan.rates[t.dataset.rate] = readNum(t, 0, 100000, 0); update(); } });
    $('sc-save').addEventListener('click', function () {
      var n = $('sc-name').value.trim(); if (!n) { $('sc-msg').textContent = 'Bitte einen Namen vergeben.'; return; }
      if (n === 'Basisplan') { $('sc-msg').textContent = 'Der Name „Basisplan“ ist reserviert.'; return; }
      var snap = { name: n, plan: C.clonePlan(state.plan) }, i = state.scenarios.map(function (s) { return s.name; }).indexOf(n);
      if (i >= 0) state.scenarios[i] = snap; else state.scenarios.push(snap);
      $('sc-msg').textContent = 'Szenario „' + n + '“ gespeichert.'; saveStore(); renderScenarioList(); update();
    });
    $('sc-list').addEventListener('click', function (e) {
      var d = e.target.dataset; if (d.scLoad !== undefined) { state.plan = C.clonePlan(state.scenarios[+d.scLoad].plan); $('sc-name').value = state.scenarios[+d.scLoad].name; renderMatrix(); update(); }
      if (d.scDel !== undefined) { state.scenarios.splice(+d.scDel, 1); saveStore(); renderScenarioList(); update(); }
    });
    document.querySelectorAll('.tabs button').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });
    $('btn-xlsx').addEventListener('click', function () {
      var out = X.build(state.plan), blob = new Blob([out.bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Budget-Szenario_' + C.toISO(new Date()) + '.xlsx';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    $('btn-print').addEventListener('click', function () { window.print(); });
  }

  loadStore(); bind(); $('budget').value = nfNum.format(state.budget.amount); $('target').value = state.target;
  renderMatrix(); renderScenarioList(); setTab('kap'); update();
  window.__dashboard = { state: state };   // nur für Tests/Debugging
})();
