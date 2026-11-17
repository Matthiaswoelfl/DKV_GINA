import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../db';
import { isoDate } from '../../shared/schemas';
import { lastDayOfMonth, monthsEndingAt } from '../../shared/period';
import { budgetProgress } from '../domain/budget';
import { detectRecurring } from '../domain/recurring';
import {
  categoryTrend,
  expensesByCategory,
  monthlySeries,
  summarize,
  topPayees,
  type AggCategory,
  type AggTx,
} from '../domain/aggregate';

const range = z.object({ from: isoDate, to: isoDate }).refine((r) => r.from <= r.to, {
  message: '„Von“ darf nicht nach „Bis“ liegen',
});
const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Monat muss JJJJ-MM sein');
const monthsQuery = z.object({
  end: monthParam,
  months: z.coerce.number().int().min(1).max(60).default(12),
});

export function statsRouter(db: Db): Router {
  const r = Router();

  const load = (from: string, to: string): AggTx[] =>
    db
      .prepare(
        'SELECT date, amount_cents AS amountCents, type, category_id AS categoryId, payee FROM transactions WHERE date >= ? AND date <= ?',
      )
      .all(from, to) as AggTx[];

  const categories = (): AggCategory[] =>
    (db.prepare('SELECT id, is_savings AS s FROM categories').all() as Array<{ id: number; s: number }>).map((c) => ({
      id: c.id,
      isSavings: c.s === 1,
    }));

  r.get('/summary', (req, res) => {
    const { from, to } = range.parse(req.query);
    res.json(summarize(load(from, to), categories()));
  });

  r.get('/by-category', (req, res) => {
    const { from, to } = range.parse(req.query);
    res.json(expensesByCategory(load(from, to), categories()));
  });

  r.get('/top-payees', (req, res) => {
    const { from, to } = range.parse(req.query);
    const limit = z.coerce.number().int().min(1).max(50).default(10).parse(req.query.limit);
    res.json(topPayees(load(from, to), categories(), limit));
  });

  r.get('/budget-progress', (req, res) => {
    const { from, to } = range.parse(req.query);
    const scale = z.coerce.number().min(0.01).max(1000).default(1).parse(req.query.scale);
    const budgets = db.prepare('SELECT category_id AS categoryId, monthly_cents AS monthlyCents FROM budgets').all() as Array<{
      categoryId: number;
      monthlyCents: number;
    }>;
    res.json(budgetProgress(budgets, expensesByCategory(load(from, to), categories()), scale));
  });

  r.get('/recurring', (req, res) => {
    const today = isoDate.default(new Date().toLocaleDateString('sv-SE')).parse(req.query.today);
    const all = db
      .prepare(
        "SELECT date, amount_cents AS amountCents, type, category_id AS categoryId, payee FROM transactions WHERE type = 'expense'",
      )
      .all() as AggTx[];
    res.json(detectRecurring(all, categories(), today));
  });

  r.get('/monthly', (req, res) => {
    const { end, months: n } = monthsQuery.parse(req.query);
    const months = monthsEndingAt(end, n);
    const first = months[0] ?? end;
    res.json(monthlySeries(load(`${first}-01`, lastDayOfMonth(end)), categories(), months));
  });

  r.get('/category-trend', (req, res) => {
    const { end, months: n } = monthsQuery.parse(req.query);
    const categoryId = z.coerce.number().int().positive().parse(req.query.categoryId);
    const months = monthsEndingAt(end, n);
    const first = months[0] ?? end;
    res.json(categoryTrend(load(`${first}-01`, lastDayOfMonth(end)), categoryId, months));
  });

  return r;
}
