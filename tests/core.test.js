// Automatisierte Tests des Rechenkerns: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../src/core.js');
const cfg = require('../config/basisplan.json');
const base = () => Core.planFromConfig(cfg);
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 0.005, (m || '') + ' ' + a + ' != ' + b);

test('Basisplan reproduziert die Excel-Werte', () => {
  const t = Core.computePlan(base()).totals;
  assert.equal(t.days, 174);
  assert.equal(t.fee, 354370);
  assert.equal(t.travel, 13920);
  assert.equal(t.net, 368290);
  assert.equal(t.gross, 438265.1);
});

test('Basisplan je Rolle (Beratertage / Honorar)', () => {
  const r = Core.computePlan(base()).roles;
  assert.deepEqual(r.map(x => [x.name, x.days, x.fee]),
    [['Partner', 13, 45370], ['Senior Consultant', 48, 105600], ['Consultant', 113, 203400]]);
});

test('Kalender: KW01/2027 beginnt am 04.01.2027, KW26 am 28.06.2027', () => {
  const p = base();
  assert.equal(Core.weekInfo(p, 0).monday, '2027-01-04');
  assert.equal(Core.weekInfo(p, 0).kw, 1);
  assert.equal(Core.weekInfo(p, 25).monday, '2027-06-28');
  assert.equal(Core.weekInfo(p, 25).kw, 26);
  assert.deepEqual(Core.isoWeek(Core.parseISO('2026-12-31')), { year: 2026, week: 53 });
});

test('Kumuliert nach KW13 = 194.155 €', () => {
  const w = Core.computePlan(base()).weeks;
  let cum = 0; for (let i = 0; i < 13; i++) cum += w[i].total;
  near(cum, 194155);
});

test('Reichweite 200.000 € netto inkl. Reisekosten → aufgebraucht in KW14/2027', () => {
  const r = Core.reach(base(), 200000, { includeTravel: true });
  assert.equal(r.status, 'within');
  assert.equal(r.kw, 14); assert.equal(r.year, 2027); assert.equal(r.weekIndex, 13);
  assert.equal(r.endDate, '2027-04-07');          // 5.845 / 14.035 = 41,6 % → 2,08 Tage → 3. Arbeitstag
  assert.equal(r.lastFullDay, '2027-04-06');
  near(r.weekFunded, 5845); near(r.used, 200000); near(r.remaining, 0);
  assert.ok(r.coveredDays > 0 && r.coveredDays < 174);
  near(r.coveredByRole.reduce((a, b) => a + b, 0), r.coveredDays, 'Rollen-Summe');
});

test('Ohne Reisekosten im Budget reicht dasselbe Budget länger', () => {
  const a = Core.reach(base(), 200000, { includeTravel: true });
  const b = Core.reach(base(), 200000, { includeTravel: false });
  assert.ok(b.endDate > a.endDate);
});

test('Budget 0 € → status zero, keine Division durch 0', () => {
  const r = Core.reach(base(), 0);
  assert.equal(r.status, 'zero'); assert.equal(r.endDate, null); assert.equal(r.coveredDays, 0);
  assert.equal(Core.reach(base(), -5).status, 'zero');
});

test('Budget größer als Gesamtplan → reicht über Planende, Rest korrekt', () => {
  const r = Core.reach(base(), 400000);
  assert.equal(r.status, 'beyond');
  near(r.remaining, 400000 - 368290); near(r.used, 368290);
  assert.equal(r.coveredDays, 174);
  assert.equal(r.planEnd, '2027-07-02');
});

test('Budget exakt = Kosten bis Ende KW13 → endet am letzten Tag von KW13', () => {
  const r = Core.reach(base(), 194155);
  assert.equal(r.status, 'within'); assert.equal(r.kw, 13); assert.equal(r.endDate, '2027-04-02');
});

test('0 % Auslastung in allen Rollen für einen Zeitraum', () => {
  let p = base();
  p.roles.forEach(r => { p = Core.setRange(p, r.id, 0, 25, 0); });
  const c = Core.computePlan(p);
  assert.equal(c.totals.net, 0);
  assert.equal(Core.reach(p, 1000).status, 'beyond');
  assert.equal(Core.reach(p, 0).status, 'zero');
  // Nur Wochen 5–10 auf 0: Reichweite überspringt die Lücke ohne Fehler
  let q = base();
  q.roles.forEach(r => { q = Core.setRange(q, r.id, 4, 9, 0); });
  const r = Core.reach(q, 200000);
  assert.equal(r.status, 'within'); assert.ok(r.kw > 14);
  assert.equal(Core.budgetForDate(q, '2027-03-14').net, Core.budgetForDate(q, '2027-02-01').net);
});

test('Änderung einer Auslastung wirkt auf Kennzahlen und Reichweite', () => {
  const sc = base().roles[1].id;
  const p = Core.setRange(base(), sc, 4, 25, 0.25);   // SC ab KW05 auf 25 %
  const a = Core.computePlan(base()).totals, b = Core.computePlan(p).totals;
  assert.ok(b.net < a.net && b.days < a.days);
  assert.ok(Core.reach(p, 200000).endDate > Core.reach(base(), 200000).endDate);
  assert.equal(base().roles[1].fte[5], 0.5);          // Original unverändert (Immutabilität)
});

test('Umkehrrechnung: Budget bis Zieldatum und Rückweg', () => {
  const b = Core.budgetForDate(base(), '2027-04-02');          // Ende KW13
  near(b.net, 194155); near(b.gross, 194155 * 1.19);
  const g = Core.budgetForDate(base(), '2027-12-31');
  near(g.net, 368290);
  near(Core.budgetForDate(base(), '2026-12-31').net, 0);
  const mid = Core.budgetForDate(base(), '2027-04-07');
  const r = Core.reach(base(), mid.net);
  assert.equal(r.endDate, '2027-04-07');
});

test('Start im Dezember 2026 verschiebt den Plan (Wochen ab KW50/2026)', () => {
  const p = base(); p.start = '2026-12-07';
  const w0 = Core.weekInfo(p, 0);
  assert.equal(w0.kw, 50); assert.equal(w0.year, 2026);
  near(Core.computePlan(p).totals.net, 368290);               // ohne Feiertage unverändert
  assert.equal(Core.reach(p, 200000).year, 2027);
});

test('Start mitten in der Woche: Resttage der ersten Woche', () => {
  const p = base(); p.start = '2027-01-06';                   // Mittwoch → 3 von 5 Tagen
  assert.equal(Core.weekInfo(p, 0).avail, 3);
  assert.ok(Core.computePlan(p).totals.net < 368290);
});

test('Feiertage und Weihnachtspause (optional) reduzieren Tage', () => {
  const h = Core.federalHolidays(2027);
  ['2027-01-01', '2027-03-26', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-17', '2027-10-03']
    .forEach(d => assert.ok(h[d], d));
  const p = base(); p.parameters.holidays = true;
  const c = Core.computePlan(p);
  assert.ok(c.totals.days < 174);
  assert.equal(Core.weekInfo(p, 11).avail, 4);                // KW12: Karfreitag
  assert.equal(Core.weekInfo(p, 12).avail, 4);                // KW13: Ostermontag
  const q = Core.extendWeeks(base(), 26); q.start = '2026-12-14'; q.parameters.christmasBreak = true;
  assert.ok(Core.weekInfo(q, 2).avail < 5);                   // Woche mit 24.–31.12.
});

test('Plan verlängern, Rolle hinzufügen/entfernen', () => {
  let p = Core.extendWeeks(base(), 4);
  assert.equal(p.weeks, 30); assert.equal(p.roles[2].fte.length, 30);
  assert.equal(Core.computePlan(p).weeks.length, 30);
  p = Core.addRole(p, 'Associate'); p = Core.addRole(p, 'Consultant');
  assert.deepEqual(Core.roleNames(p), ['Partner', 'Senior Consultant', 'Consultant 1', 'Associate', 'Consultant 2']);
  assert.equal(Core.computePlan(p).roles[3].rate, 850);
  p = Core.removeRole(p, p.roles[3].id);
  assert.equal(p.roles.length, 4);
});

test('Brutto-Eingabe: Netto = Brutto / 1,19', () => {
  const gross = 238000, net = gross / 1.19;
  near(net, 200000);
  assert.equal(Core.reach(base(), net).kw, 14);
});
