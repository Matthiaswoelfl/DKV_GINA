import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDb, type Db } from './db';
import { createApp } from './app';

let db: Db;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  db = openDb(':memory:');
  app = createApp(db);
});

const cats = async () => (await request(app).get('/api/categories')).body as Array<{ id: number; name: string; type: string; transactionCount: number }>;
const catId = async (name: string, type = 'expense') => (await cats()).find((c) => c.name === name && c.type === type)?.id as number;
const tx = (o: object) => ({ date: '2026-11-03', amountCents: 1000, type: 'expense', categoryId: null, payee: 'X', note: '', ...o });

describe('Regeln', () => {
  it('kategorisiert neue Buchungen automatisch, manuelle Wahl hat Vorrang', async () => {
    const lebensmittel = await catId('Lebensmittel');
    const restaurants = await catId('Restaurants');
    await request(app).post('/api/rules').send({ pattern: 'rewe', categoryId: lebensmittel }).expect(201);

    const auto = await request(app).post('/api/transactions').send(tx({ payee: 'REWE Markt' })).expect(201);
    expect(auto.body.categoryId).toBe(lebensmittel);

    const manual = await request(app).post('/api/transactions').send(tx({ payee: 'REWE Markt', categoryId: restaurants })).expect(201);
    expect(manual.body.categoryId).toBe(restaurants);

    const none = await request(app).post('/api/transactions').send(tx({ payee: 'Unbekannt' })).expect(201);
    expect(none.body.categoryId).toBeNull();
  });

  it('wendet Regeln nachträglich auf Unkategorisiertes an', async () => {
    await request(app).post('/api/transactions').send(tx({ payee: 'Netflix' }));
    await request(app).post('/api/transactions').send(tx({ payee: 'Etwas anderes' }));
    await request(app).post('/api/rules').send({ pattern: 'netflix', categoryId: await catId('Abos') });
    const res = await request(app).post('/api/rules/apply').expect(200);
    expect(res.body.updated).toBe(1);
    const count = await request(app).get('/api/transactions/uncategorized/count');
    expect(count.body.count).toBe(1);
  });

  it('CRUD und Validierung', async () => {
    const abos = await catId('Abos');
    const r = await request(app).post('/api/rules').send({ pattern: 'spotify', categoryId: abos }).expect(201);
    expect(r.body.categoryType).toBe('expense');
    await request(app).put(`/api/rules/${r.body.id}`).send({ pattern: 'spotify ab', categoryId: abos, enabled: false }).expect(200);
    expect((await request(app).get('/api/rules')).body[0].enabled).toBe(false);
    await request(app).post('/api/rules').send({ pattern: '', categoryId: abos }).expect(400);
    await request(app).post('/api/rules').send({ pattern: 'x', categoryId: 99999 }).expect(400);
    await request(app).delete(`/api/rules/${r.body.id}`).expect(204);
    await request(app).delete(`/api/rules/${r.body.id}`).expect(404);
  });
});

describe('Kategorien', () => {
  const body = { name: 'Haustier', type: 'expense', color: '#123abc' };

  it('legt an, ändert und verhindert doppelte Namen', async () => {
    const c = await request(app).post('/api/categories').send(body).expect(201);
    expect(c.body.transactionCount).toBe(0);
    await request(app).post('/api/categories').send({ ...body, name: 'haustier' }).expect(409);
    await request(app).put(`/api/categories/${c.body.id}`).send({ ...body, name: 'Tiere', color: '#ff0000' }).expect(200);
    await request(app).put(`/api/categories/${c.body.id}`).send({ ...body, type: 'income' }).expect(400);
    await request(app).post('/api/categories').send({ ...body, name: 'Y', color: 'rot' }).expect(400);
    await request(app).post('/api/categories').send({ ...body, name: 'Z', type: 'income', isSavings: true }).expect(400);
  });

  it('Löschen mit Buchungen verlangt ein Ziel und verschiebt sie', async () => {
    const abos = await catId('Abos');
    const freizeit = await catId('Freizeit');
    await request(app).post('/api/transactions').send(tx({ categoryId: abos }));
    const refused = await request(app).delete(`/api/categories/${abos}`).expect(409);
    expect(refused.body.transactionCount).toBe(1);
    await request(app).delete(`/api/categories/${abos}?reassignTo=${freizeit}`).expect(204);
    expect((await cats()).find((c) => c.id === freizeit)?.transactionCount).toBe(1);
  });

  it('Löschen nach "none" macht Buchungen unkategorisiert, Ziel muss gleichen Typ haben', async () => {
    const abos = await catId('Abos');
    const gehalt = await catId('Gehalt', 'income');
    await request(app).post('/api/transactions').send(tx({ categoryId: abos }));
    await request(app).delete(`/api/categories/${abos}?reassignTo=${gehalt}`).expect(400);
    await request(app).delete(`/api/categories/${abos}?reassignTo=none`).expect(204);
    expect((await request(app).get('/api/transactions/uncategorized/count')).body.count).toBe(1);
  });

  it('entfernt Regeln mit der Kategorie', async () => {
    const abos = await catId('Abos');
    await request(app).post('/api/rules').send({ pattern: 'netflix', categoryId: abos });
    await request(app).delete(`/api/categories/${abos}`).expect(204);
    expect((await request(app).get('/api/rules')).body).toHaveLength(0);
  });
});
