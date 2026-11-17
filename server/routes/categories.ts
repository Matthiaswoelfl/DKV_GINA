import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { categoryInput, type Category } from '../../shared/schemas';

interface Row {
  id: number;
  name: string;
  type: 'income' | 'expense';
  color: string;
  is_savings: number;
  sort_order: number;
  archived: number;
  tx_count: number;
}

const toCategory = (c: Row): Category => ({
  id: c.id,
  name: c.name,
  type: c.type,
  color: c.color,
  isSavings: c.is_savings === 1,
  sortOrder: c.sort_order,
  archived: c.archived === 1,
  transactionCount: c.tx_count,
});

const SELECT = `SELECT c.*, (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS tx_count FROM categories c`;
const idParam = z.coerce.number().int().positive();

export function categoriesRouter(db: Db): Router {
  const r = Router();
  const get = (id: number) => db.prepare(`${SELECT} WHERE c.id = ?`).get(id) as Row | undefined;
  const nameTaken = (name: string, type: string, exceptId = 0) =>
    db
      .prepare('SELECT 1 FROM categories WHERE name = ? COLLATE NOCASE AND type = ? AND id != ?')
      .get(name, type, exceptId) !== undefined;

  r.get('/', (_req, res) => {
    const rows = db.prepare(`${SELECT} ORDER BY c.type DESC, c.sort_order, c.name`).all() as Row[];
    res.json(rows.map(toCategory));
  });

  r.post('/', (req, res) => {
    const i = categoryInput.parse(req.body);
    if (nameTaken(i.name, i.type)) {
      res.status(409).json({ error: `Es gibt bereits eine Kategorie „${i.name}“` });
      return;
    }
    const { m } = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS m FROM categories').get() as { m: number };
    const info = db
      .prepare('INSERT INTO categories (name, type, color, is_savings, sort_order, archived) VALUES (?,?,?,?,?,?)')
      .run(i.name, i.type, i.color, i.isSavings ? 1 : 0, m, i.archived ? 1 : 0);
    const row = get(Number(info.lastInsertRowid));
    res.status(201).json(row && toCategory(row));
  });

  r.put('/:id', (req, res) => {
    const id = idParam.parse(req.params.id);
    const i = categoryInput.parse(req.body);
    const existing = get(id);
    if (!existing) {
      res.status(404).json({ error: 'Kategorie nicht gefunden' });
      return;
    }
    if (existing.type !== i.type) {
      res.status(400).json({ error: 'Der Typ einer Kategorie kann nicht geändert werden' });
      return;
    }
    if (nameTaken(i.name, i.type, id)) {
      res.status(409).json({ error: `Es gibt bereits eine Kategorie „${i.name}“` });
      return;
    }
    db.prepare('UPDATE categories SET name=?, color=?, is_savings=?, archived=? WHERE id=?').run(
      i.name,
      i.color,
      i.isSavings ? 1 : 0,
      i.archived ? 1 : 0,
      id,
    );
    const row = get(id);
    res.json(row && toCategory(row));
  });

  /**
   * Löschen. Hat die Kategorie Buchungen, muss `reassignTo` (Kategorie-ID gleichen Typs oder
   * "none" für unkategorisiert) angegeben werden. Zugehörige Regeln und Budgets entfallen.
   */
  r.delete('/:id', (req, res) => {
    const id = idParam.parse(req.params.id);
    const existing = get(id);
    if (!existing) {
      res.status(404).json({ error: 'Kategorie nicht gefunden' });
      return;
    }
    const reassign = z.union([z.literal('none'), z.coerce.number().int().positive()]).optional().parse(req.query.reassignTo);
    if (existing.tx_count > 0 && reassign === undefined) {
      res.status(409).json({
        error: `Die Kategorie hat ${existing.tx_count} Buchungen. Bitte Ziel angeben.`,
        transactionCount: existing.tx_count,
      });
      return;
    }
    let target: number | null = null;
    if (typeof reassign === 'number') {
      const t = get(reassign);
      if (!t || t.type !== existing.type || t.id === id) {
        res.status(400).json({ error: 'Ungültige Ziel-Kategorie' });
        return;
      }
      target = t.id;
    }
    db.transaction(() => {
      db.prepare('UPDATE transactions SET category_id = ? WHERE category_id = ?').run(target, id);
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    })();
    res.status(204).end();
  });

  return r;
}
