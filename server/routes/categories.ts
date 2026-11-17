import { Router } from 'express';
import type { Db } from '../db';
import type { Category } from '../../shared/schemas';

interface Row {
  id: number;
  name: string;
  type: 'income' | 'expense';
  color: string;
  is_savings: number;
  sort_order: number;
  archived: number;
}

export function categoriesRouter(db: Db): Router {
  const r = Router();
  r.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM categories ORDER BY type DESC, sort_order, name').all() as Row[];
    const out: Category[] = rows.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      color: c.color,
      isSavings: c.is_savings === 1,
      sortOrder: c.sort_order,
      archived: c.archived === 1,
    }));
    res.json(out);
  });
  return r;
}
