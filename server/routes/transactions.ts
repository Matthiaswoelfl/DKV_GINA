import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import {
  transactionFilter,
  transactionInput,
  type Transaction,
  type TransactionFilter,
} from '../../shared/schemas';

interface Row {
  id: number;
  date: string;
  amount_cents: number;
  type: 'income' | 'expense';
  category_id: number | null;
  payee: string;
  note: string;
  created_at: string;
  updated_at: string;
}

const toTx = (r: Row): Transaction => ({
  id: r.id,
  date: r.date,
  amountCents: r.amount_cents,
  type: r.type,
  categoryId: r.category_id,
  payee: r.payee,
  note: r.note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const SORT_COLUMNS: Record<TransactionFilter['sort'], string> = {
  date: 't.date',
  amount: 't.amount_cents',
  payee: 't.payee COLLATE NOCASE',
  category: 'c.name COLLATE NOCASE',
};

export function listTransactions(db: Db, f: TransactionFilter): Transaction[] {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (f.from) {
    where.push('t.date >= ?');
    params.push(f.from);
  }
  if (f.to) {
    where.push('t.date <= ?');
    params.push(f.to);
  }
  if (f.uncategorized) where.push('t.category_id IS NULL');
  else if (f.categoryId !== undefined) {
    where.push('t.category_id = ?');
    params.push(f.categoryId);
  }
  if (f.type) {
    where.push('t.type = ?');
    params.push(f.type);
  }
  if (f.minCents !== undefined) {
    where.push('t.amount_cents >= ?');
    params.push(f.minCents);
  }
  if (f.maxCents !== undefined) {
    where.push('t.amount_cents <= ?');
    params.push(f.maxCents);
  }
  if (f.q) {
    where.push(`(t.payee LIKE ? ESCAPE '\\' OR t.note LIKE ? ESCAPE '\\')`);
    const like = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    params.push(like, like);
  }
  const sql = `SELECT t.* FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${SORT_COLUMNS[f.sort]} ${f.dir === 'asc' ? 'ASC' : 'DESC'}, t.id DESC`;
  return (db.prepare(sql).all(...params) as Row[]).map(toTx);
}

const idParam = z.coerce.number().int().positive();

export function transactionsRouter(db: Db): Router {
  const r = Router();

  const categoryMatchesType = (categoryId: number | null, type: string): boolean => {
    if (categoryId === null) return true;
    const c = db.prepare('SELECT type FROM categories WHERE id = ?').get(categoryId) as
      | { type: string }
      | undefined;
    return c !== undefined && c.type === type;
  };

  r.get('/', (req, res) => {
    const f = transactionFilter.parse(req.query);
    res.json(listTransactions(db, f));
  });

  r.post('/', (req, res) => {
    const i = transactionInput.parse(req.body);
    if (!categoryMatchesType(i.categoryId, i.type)) {
      res.status(400).json({ error: 'Kategorie passt nicht zum Typ der Buchung' });
      return;
    }
    const info = db
      .prepare(
        'INSERT INTO transactions (date, amount_cents, type, category_id, payee, note) VALUES (?,?,?,?,?,?)',
      )
      .run(i.date, i.amountCents, i.type, i.categoryId, i.payee, i.note);
    const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid) as Row;
    res.status(201).json(toTx(row));
  });

  r.put('/:id', (req, res) => {
    const id = idParam.parse(req.params.id);
    const i = transactionInput.parse(req.body);
    if (!categoryMatchesType(i.categoryId, i.type)) {
      res.status(400).json({ error: 'Kategorie passt nicht zum Typ der Buchung' });
      return;
    }
    const info = db
      .prepare(
        `UPDATE transactions SET date=?, amount_cents=?, type=?, category_id=?, payee=?, note=?,
         updated_at=datetime('now') WHERE id=?`,
      )
      .run(i.date, i.amountCents, i.type, i.categoryId, i.payee, i.note, id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Buchung nicht gefunden' });
      return;
    }
    res.json(toTx(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Row));
  });

  r.patch('/:id/category', (req, res) => {
    const id = idParam.parse(req.params.id);
    const { categoryId } = z.object({ categoryId: z.number().int().positive().nullable() }).parse(req.body);
    const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Row | undefined;
    if (!row) {
      res.status(404).json({ error: 'Buchung nicht gefunden' });
      return;
    }
    if (!categoryMatchesType(categoryId, row.type)) {
      res.status(400).json({ error: 'Kategorie passt nicht zum Typ der Buchung' });
      return;
    }
    db.prepare(`UPDATE transactions SET category_id=?, updated_at=datetime('now') WHERE id=?`).run(
      categoryId,
      id,
    );
    res.json(toTx(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Row));
  });

  r.delete('/:id', (req, res) => {
    const id = idParam.parse(req.params.id);
    const info = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Buchung nicht gefunden' });
      return;
    }
    res.status(204).end();
  });

  r.get('/payees/suggest', (req, res) => {
    const q = z.string().trim().max(100).default('').parse(req.query.q ?? '');
    const like = `${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const rows = db
      .prepare(
        `SELECT payee, COUNT(*) n FROM transactions WHERE payee LIKE ? ESCAPE '\\'
         GROUP BY payee ORDER BY n DESC, payee LIMIT 8`,
      )
      .all(like) as Array<{ payee: string }>;
    res.json(rows.map((x) => x.payee));
  });

  return r;
}
