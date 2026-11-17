import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDb } from './db';
import { createApp } from './app';

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp(openDb(':memory:'));
});

const base = { date: '2026-11-03', amountCents: 1999, type: 'expense', categoryId: null, payee: 'REWE', note: '' };

describe('Transaktions-API', () => {
  it('legt an, listet, ändert und löscht', async () => {
    const created = await request(app).post('/api/transactions').send(base).expect(201);
    expect(created.body.amountCents).toBe(1999);

    const list = await request(app).get('/api/transactions').expect(200);
    expect(list.body).toHaveLength(1);

    await request(app)
      .put(`/api/transactions/${created.body.id}`)
      .send({ ...base, amountCents: 2500 })
      .expect(200);
    const after = await request(app).get('/api/transactions').expect(200);
    expect(after.body[0].amountCents).toBe(2500);

    await request(app).delete(`/api/transactions/${created.body.id}`).expect(204);
    await request(app).delete(`/api/transactions/${created.body.id}`).expect(404);
  });

  it('validiert Eingaben', async () => {
    await request(app).post('/api/transactions').send({ ...base, amountCents: 12.5 }).expect(400);
    await request(app).post('/api/transactions').send({ ...base, date: '2026-02-30' }).expect(400);
    await request(app).post('/api/transactions').send({ ...base, payee: '  ' }).expect(400);
  });

  it('lehnt Kategorie mit falschem Typ ab', async () => {
    const cats = await request(app).get('/api/categories');
    const gehalt = cats.body.find((c: { name: string }) => c.name === 'Gehalt');
    await request(app).post('/api/transactions').send({ ...base, categoryId: gehalt.id }).expect(400);
  });

  it('filtert und sortiert', async () => {
    const post = (b: object) => request(app).post('/api/transactions').send({ ...base, ...b });
    await post({ date: '2026-10-01', payee: 'Aldi', amountCents: 500 });
    await post({ date: '2026-11-01', payee: 'REWE', amountCents: 5000 });
    await post({ date: '2026-11-02', payee: 'Gehalt AG', amountCents: 300000, type: 'income' });

    const nov = await request(app).get('/api/transactions?from=2026-11-01&to=2026-11-30');
    expect(nov.body).toHaveLength(2);
    const search = await request(app).get('/api/transactions?q=rew');
    expect(search.body.map((t: { payee: string }) => t.payee)).toEqual(['REWE']);
    const byAmount = await request(app).get('/api/transactions?sort=amount&dir=asc&type=expense');
    expect(byAmount.body.map((t: { amountCents: number }) => t.amountCents)).toEqual([500, 5000]);
    const range = await request(app).get('/api/transactions?minCents=1000&maxCents=10000');
    expect(range.body).toHaveLength(1);
  });

  it('schlägt Empfänger vor', async () => {
    const post = (payee: string) => request(app).post('/api/transactions').send({ ...base, payee });
    await post('REWE Markt');
    await post('REWE Markt');
    await post('Rossmann');
    const s = await request(app).get('/api/transactions/payees/suggest?q=re');
    expect(s.body).toEqual(['REWE Markt']);
  });
});
