import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDb } from './db';
import { createApp } from './app';

let app: ReturnType<typeof createApp>;
beforeEach(async () => {
  app = createApp(openDb(':memory:'));
  const cats = (await request(app).get('/api/categories')).body as Array<{ id: number; name: string; type: string }>;
  const id = (n: string, t = 'expense') => cats.find((c) => c.name === n && c.type === t)?.id ?? null;
  const add = (date: string, amountCents: number, type: string, categoryId: number | null, payee: string) =>
    request(app).post('/api/transactions').send({ date, amountCents, type, categoryId, payee, note: '' });
  await add('2026-10-01', 300000, 'income', id('Gehalt', 'income'), 'Firma');
  await add('2026-11-01', 310000, 'income', id('Gehalt', 'income'), 'Firma');
  await add('2026-11-02', 50000, 'expense', id('Lebensmittel'), 'REWE');
  await add('2026-11-03', 20000, 'expense', id('Sparen'), 'ETF');
  await add('2026-11-30', 1000, 'expense', null, 'Kiosk');
});

describe('Statistik-API', () => {
  it('summary', async () => {
    const r = await request(app).get('/api/stats/summary?from=2026-11-01&to=2026-11-30').expect(200);
    expect(r.body).toMatchObject({ incomeCents: 310000, expenseCents: 51000, savedCents: 20000, balanceCents: 239000 });
  });
  it('by-category ohne Sparen, mit unkategorisiert', async () => {
    const r = await request(app).get('/api/stats/by-category?from=2026-11-01&to=2026-11-30').expect(200);
    expect(r.body.map((x: { totalCents: number }) => x.totalCents)).toEqual([50000, 1000]);
    expect(r.body[1].categoryId).toBeNull();
  });
  it('monthly liefert 12 Monate inkl. Nullmonate', async () => {
    const r = await request(app).get('/api/stats/monthly?end=2026-11').expect(200);
    expect(r.body).toHaveLength(12);
    expect(r.body[0].month).toBe('2025-12');
    expect(r.body[10]).toMatchObject({ month: '2026-10', incomeCents: 300000 });
    expect(r.body[11]).toMatchObject({ month: '2026-11', expenseCents: 51000 });
  });
  it('top-payees und category-trend', async () => {
    const top = await request(app).get('/api/stats/top-payees?from=2026-11-01&to=2026-11-30&limit=1').expect(200);
    expect(top.body).toEqual([{ payee: 'REWE', totalCents: 50000, count: 1 }]);
    const cats = (await request(app).get('/api/categories')).body as Array<{ id: number; name: string }>;
    const lm = cats.find((c) => c.name === 'Lebensmittel')?.id;
    const trend = await request(app).get(`/api/stats/category-trend?categoryId=${lm}&end=2026-11&months=3`).expect(200);
    expect(trend.body.map((x: { totalCents: number }) => x.totalCents)).toEqual([0, 0, 50000]);
  });
  it('validiert Parameter', async () => {
    await request(app).get('/api/stats/summary?from=2026-11-30&to=2026-11-01').expect(400);
    await request(app).get('/api/stats/summary').expect(400);
    await request(app).get('/api/stats/monthly?end=2026-13').expect(400);
  });
});
