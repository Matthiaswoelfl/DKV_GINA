import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { categorize } from '../../shared/categorize';
import { ruleInput, type Rule, type TransactionType } from '../../shared/schemas';

interface Row {
  id: number;
  match_field: Rule['matchField'];
  match_type: Rule['matchType'];
  pattern: string;
  category_id: number;
  priority: number;
  enabled: number;
  category_type: TransactionType;
}

const toRule = (r: Row): Rule => ({
  id: r.id,
  matchField: r.match_field,
  matchType: r.match_type,
  pattern: r.pattern,
  categoryId: r.category_id,
  priority: r.priority,
  enabled: r.enabled === 1,
  categoryType: r.category_type,
});

const SELECT = `SELECT r.*, c.type AS category_type FROM rules r JOIN categories c ON c.id = r.category_id`;

export function loadRules(db: Db): Rule[] {
  return (db.prepare(`${SELECT} ORDER BY r.priority DESC, r.id`).all() as Row[]).map(toRule);
}

/** Wendet die Regeln auf alle unkategorisierten Buchungen an. */
export function applyRules(db: Db): number {
  const rules = loadRules(db);
  const rows = db
    .prepare('SELECT id, payee, note, type FROM transactions WHERE category_id IS NULL')
    .all() as Array<{ id: number; payee: string; note: string; type: TransactionType }>;
  const upd = db.prepare(`UPDATE transactions SET category_id = ?, updated_at = datetime('now') WHERE id = ?`);
  let updated = 0;
  db.transaction(() => {
    for (const t of rows) {
      const cat = categorize(t, rules);
      if (cat !== null) {
        upd.run(cat, t.id);
        updated++;
      }
    }
  })();
  return updated;
}

const idParam = z.coerce.number().int().positive();

export function rulesRouter(db: Db): Router {
  const r = Router();
  const get = (id: number) => db.prepare(`${SELECT} WHERE r.id = ?`).get(id) as Row | undefined;
  const categoryExists = (id: number) => db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id) !== undefined;

  r.get('/', (_req, res) => {
    res.json(loadRules(db));
  });

  r.post('/apply', (_req, res) => {
    res.json({ updated: applyRules(db) });
  });

  r.post('/', (req, res) => {
    const i = ruleInput.parse(req.body);
    if (!categoryExists(i.categoryId)) {
      res.status(400).json({ error: 'Kategorie existiert nicht' });
      return;
    }
    const info = db
      .prepare('INSERT INTO rules (match_field, match_type, pattern, category_id, priority, enabled) VALUES (?,?,?,?,?,?)')
      .run(i.matchField, i.matchType, i.pattern, i.categoryId, i.priority, i.enabled ? 1 : 0);
    const row = get(Number(info.lastInsertRowid));
    res.status(201).json(row && toRule(row));
  });

  r.put('/:id', (req, res) => {
    const id = idParam.parse(req.params.id);
    const i = ruleInput.parse(req.body);
    if (!categoryExists(i.categoryId)) {
      res.status(400).json({ error: 'Kategorie existiert nicht' });
      return;
    }
    const info = db
      .prepare('UPDATE rules SET match_field=?, match_type=?, pattern=?, category_id=?, priority=?, enabled=? WHERE id=?')
      .run(i.matchField, i.matchType, i.pattern, i.categoryId, i.priority, i.enabled ? 1 : 0, id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Regel nicht gefunden' });
      return;
    }
    const row = get(id);
    res.json(row && toRule(row));
  });

  r.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM rules WHERE id = ?').run(idParam.parse(req.params.id));
    if (info.changes === 0) {
      res.status(404).json({ error: 'Regel nicht gefunden' });
      return;
    }
    res.status(204).end();
  });

  return r;
}
