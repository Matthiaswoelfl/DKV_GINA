import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';

const idParam = z.coerce.number().int().positive();
const body = z.object({ monthlyCents: z.number().int().positive().max(100_000_000_000) });

export function budgetsRouter(db: Db): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    const rows = db.prepare('SELECT category_id AS categoryId, monthly_cents AS monthlyCents FROM budgets').all();
    res.json(rows);
  });

  r.put('/:categoryId', (req, res) => {
    const categoryId = idParam.parse(req.params.categoryId);
    const { monthlyCents } = body.parse(req.body);
    const cat = db.prepare('SELECT type, is_savings AS s FROM categories WHERE id = ?').get(categoryId) as
      | { type: string; s: number }
      | undefined;
    if (!cat) {
      res.status(404).json({ error: 'Kategorie nicht gefunden' });
      return;
    }
    if (cat.type !== 'expense' || cat.s === 1) {
      res.status(400).json({ error: 'Budgets gibt es nur für Ausgaben-Kategorien ohne „Sparen“' });
      return;
    }
    db.prepare(
      'INSERT INTO budgets (category_id, monthly_cents) VALUES (?, ?) ON CONFLICT(category_id) DO UPDATE SET monthly_cents = excluded.monthly_cents',
    ).run(categoryId, monthlyCents);
    res.json({ categoryId, monthlyCents });
  });

  r.delete('/:categoryId', (req, res) => {
    const info = db.prepare('DELETE FROM budgets WHERE category_id = ?').run(idParam.parse(req.params.categoryId));
    if (info.changes === 0) {
      res.status(404).json({ error: 'Kein Budget für diese Kategorie' });
      return;
    }
    res.status(204).end();
  });

  return r;
}
