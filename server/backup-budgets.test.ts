import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDb } from './db';
import { createApp } from './app';
import { centsToCsv, text } from './csv';

let app: ReturnType<typeof createApp>;
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finanz-test-'));
  app = createApp(openDb(':memory:'), { backupDir: path.join(dir, 'backups') });
});

const cats = async () => (await request(app).get('/api/categories')).body as Array<{ id: number; name: string; type: string }>;
const catId = async (name: string, type = 'expense') => (await cats()).find((c) => c.name === name && c.type === type)?.id as number;
const add = (o: object) =>
  request(app).post('/api/transactions').send({ date: '2026-11-03', amountCents: 1000, type: 'expense', categoryId: null, payee: 'X', note: '', ...o });

describe('Budgets', () => {
  it('setzt, ändert und löscht Budgets', async () => {
    const lm = await catId('Lebensmittel');
    await request(app).put(`/api/budgets/${lm}`).send({ monthlyCents: 40000 }).expect(200);
    await request(app).put(`/api/budgets/${lm}`).send({ monthlyCents: 45000 }).expect(200);
    expect((await request(app).get('/api/budgets')).body).toEqual([{ categoryId: lm, monthlyCents: 45000 }]);
    await request(app).delete(`/api/budgets/${lm}`).expect(204);
    await request(app).delete(`/api/budgets/${lm}`).expect(404);
  });
  it('lehnt Einnahmen-, Sparen- und ungültige Budgets ab', async () => {
    await request(app).put(`/api/budgets/${await catId('Gehalt', 'income')}`).send({ monthlyCents: 100 }).expect(400);
    await request(app).put(`/api/budgets/${await catId('Sparen')}`).send({ monthlyCents: 100 }).expect(400);
    await request(app).put(`/api/budgets/${await catId('Abos')}`).send({ monthlyCents: 0 }).expect(400);
    await request(app).put('/api/budgets/9999').send({ monthlyCents: 100 }).expect(404);
  });
  it('liefert den Fortschritt', async () => {
    const lm = await catId('Lebensmittel');
    await request(app).put(`/api/budgets/${lm}`).send({ monthlyCents: 10000 });
    await add({ categoryId: lm, amountCents: 8500 });
    await add({ categoryId: lm, amountCents: 100, date: '2026-10-31' });
    const r = await request(app).get('/api/stats/budget-progress?from=2026-11-01&to=2026-11-30').expect(200);
    expect(r.body).toEqual([{ categoryId: lm, budgetCents: 10000, spentCents: 8500, ratio: 0.85, status: 'warn' }]);
  });
});

describe('Wiederkehrende Zahlungen (API)', () => {
  it('erkennt Abos aus den Buchungen', async () => {
    const abos = await catId('Abos');
    for (const d of ['2026-08-05', '2026-09-05', '2026-10-05', '2026-11-05']) await add({ date: d, payee: 'Netflix', amountCents: 1299, categoryId: abos });
    const r = await request(app).get('/api/stats/recurring?today=2026-11-17').expect(200);
    expect(r.body.monthlyTotalCents).toBe(1299);
    expect(r.body.payments[0]).toMatchObject({ payee: 'Netflix', interval: 'monthly', nextDate: '2026-12-05' });
  });
});

describe('Export', () => {
  it('CSV: BOM, Semikolon, deutsche Formate, Ausgaben negativ', async () => {
    await add({ payee: 'REWE; Markt', amountCents: 123456, note: 'Zeile "1"' });
    await add({ type: 'income', payee: 'Firma', amountCents: 5, date: '2026-11-04', categoryId: await catId('Gehalt', 'income') });
    const res = await request(app).get('/api/export/csv').expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    const body = res.text;
    expect(body.charCodeAt(0)).toBe(0xfeff);
    const lines = body.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('Datum;Typ;Betrag;Kategorie;Empfänger;Notiz');
    expect(lines[1]).toBe('03.11.2026;Ausgabe;-1234,56;;"REWE; Markt";"Zeile ""1"""');
    expect(lines[2]).toBe('04.11.2026;Einnahme;0,05;Gehalt;Firma;');
  });
  it('CSV neutralisiert Formeln und formatiert Cent', () => {
    expect(text('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(text('+49 Telekom')).toBe("'+49 Telekom");
    expect(text('Normal')).toBe('Normal');
    expect(centsToCsv(-5)).toBe('-0,05');
    expect(centsToCsv(100000)).toBe('1000,00');
  });
  it('JSON-Export enthält alle Daten', async () => {
    const lm = await catId('Lebensmittel');
    await add({ categoryId: lm });
    await request(app).post('/api/rules').send({ pattern: 'rewe', categoryId: lm });
    await request(app).put(`/api/budgets/${lm}`).send({ monthlyCents: 1000 });
    const res = await request(app).get('/api/export/json').expect(200);
    const b = JSON.parse(res.text);
    expect(b).toMatchObject({ app: 'finanz-dashboard', version: 1 });
    expect(b.transactions).toHaveLength(1);
    expect(b.rules).toHaveLength(1);
    expect(b.budgets).toEqual([{ categoryId: lm, monthlyCents: 1000 }]);
    expect(b.categories.length).toBeGreaterThan(10);
  });
});

describe('Wiederherstellung', () => {
  async function snapshot() {
    const lm = await catId('Lebensmittel');
    await add({ categoryId: lm, payee: 'Original 1' });
    await add({ payee: 'Original 2', note: 'Ä ö ü ß €' });
    await request(app).post('/api/rules').send({ pattern: 'orig', categoryId: lm });
    await request(app).put(`/api/budgets/${lm}`).send({ monthlyCents: 5000 });
    return JSON.parse((await request(app).get('/api/export/json')).text);
  }

  it('Export -> Änderung -> Import stellt den Stand exakt wieder her', async () => {
    const backup = await snapshot();
    await add({ payee: 'Neu nach Backup' });
    await request(app).delete(`/api/budgets/${await catId('Lebensmittel')}`);

    const res = await request(app).post('/api/import/json').send(backup).expect(200);
    expect(res.body).toMatchObject({ transactions: 2, rules: 1, budgets: 1 });

    const after = JSON.parse((await request(app).get('/api/export/json')).text);
    expect({ ...after, exportedAt: 0 }).toEqual({ ...backup, exportedAt: 0 });
  });

  it('legt vor dem Ersetzen automatisch eine Sicherung an', async () => {
    const backup = await snapshot();
    await add({ payee: 'Wird überschrieben' });
    const res = await request(app).post('/api/import/json').send(backup).expect(200);
    const file = path.join(dir, 'backups', res.body.safetyBackup);
    expect(fs.existsSync(file)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(saved.transactions.map((t: { payee: string }) => t.payee)).toContain('Wird überschrieben');
  });

  it('dryRun prüft nur und ändert nichts', async () => {
    const backup = await snapshot();
    await add({ payee: 'Bleibt' });
    const res = await request(app).post('/api/import/json?dryRun=1').send(backup).expect(200);
    expect(res.body).toMatchObject({ dryRun: true, transactions: 2 });
    expect((await request(app).get('/api/transactions')).body).toHaveLength(3);
  });

  it('lehnt ungültige oder inkonsistente Dateien ab und lässt den Bestand unverändert', async () => {
    const backup = await snapshot();
    await request(app).post('/api/import/json').send({ foo: 1 }).expect(400);
    await request(app).post('/api/import/json').send({ ...backup, version: 99 }).expect(400);
    const bad = { ...backup, transactions: [{ ...backup.transactions[0], categoryId: 9999 }] };
    const r = await request(app).post('/api/import/json').send(bad).expect(400);
    expect(r.body.error).toContain('inkonsistent');
    const dup = { ...backup, transactions: [backup.transactions[0], backup.transactions[0]] };
    await request(app).post('/api/import/json').send(dup).expect(400);
    expect((await request(app).get('/api/transactions')).body).toHaveLength(2);
  });
});
