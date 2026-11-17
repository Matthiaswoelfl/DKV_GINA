import type { TransactionType } from '../../shared/schemas';
import type { CategoryTotal, MonthPoint, PayeeTotal, Summary } from '../../shared/stats';

export type { CategoryTotal, MonthPoint, PayeeTotal, Summary };

export interface AggTx {
  date: string;
  amountCents: number;
  type: TransactionType;
  categoryId: number | null;
  payee: string;
}

export interface AggCategory {
  id: number;
  isSavings: boolean;
}

const savingsIds = (cats: readonly AggCategory[]) => new Set(cats.filter((c) => c.isSavings).map((c) => c.id));

const isSavingsTx = (t: AggTx, ids: ReadonlySet<number>) =>
  t.type === 'expense' && t.categoryId !== null && ids.has(t.categoryId);

export function summarize(txs: readonly AggTx[], cats: readonly AggCategory[]): Summary {
  const sav = savingsIds(cats);
  let income = 0;
  let expense = 0;
  let saved = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amountCents;
    else if (isSavingsTx(t, sav)) saved += t.amountCents;
    else expense += t.amountCents;
  }
  return {
    incomeCents: income,
    expenseCents: expense,
    savedCents: saved,
    balanceCents: income - expense - saved,
    savingsRate: income > 0 ? (income - expense) / income : null,
  };
}

/** Aggregiert je Monat ("JJJJ-MM"); Monate ohne Buchungen erscheinen mit 0. Buchungen außerhalb werden ignoriert. */
export function monthlySeries(txs: readonly AggTx[], cats: readonly AggCategory[], months: readonly string[]): MonthPoint[] {
  const buckets = new Map<string, AggTx[]>(months.map((m) => [m, []]));
  for (const t of txs) buckets.get(t.date.slice(0, 7))?.push(t);
  return months.map((month) => {
    const { incomeCents, expenseCents, savedCents, balanceCents } = summarize(buckets.get(month) ?? [], cats);
    return { month, incomeCents, expenseCents, savedCents, balanceCents };
  });
}

/** Ausgaben je Kategorie (ohne Sparen), größte zuerst. null = unkategorisiert. */
export function expensesByCategory(txs: readonly AggTx[], cats: readonly AggCategory[]): CategoryTotal[] {
  const sav = savingsIds(cats);
  const totals = new Map<number | null, number>();
  for (const t of txs) {
    if (t.type !== 'expense' || isSavingsTx(t, sav)) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amountCents);
  }
  return [...totals.entries()]
    .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/** Verlauf einer Kategorie über die gegebenen Monate (Nullen für leere Monate). */
export function categoryTrend(
  txs: readonly AggTx[],
  categoryId: number | null,
  months: readonly string[],
): Array<{ month: string; totalCents: number }> {
  const totals = new Map<string, number>(months.map((m) => [m, 0]));
  for (const t of txs) {
    if (t.categoryId !== categoryId) continue;
    const m = t.date.slice(0, 7);
    const cur = totals.get(m);
    if (cur !== undefined) totals.set(m, cur + t.amountCents);
  }
  return months.map((month) => ({ month, totalCents: totals.get(month) ?? 0 }));
}

const normPayee = (s: string) => s.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');

/** Empfänger mit den höchsten Ausgaben (ohne Sparen); Schreibweisen werden zusammengefasst. */
export function topPayees(txs: readonly AggTx[], cats: readonly AggCategory[], limit: number): PayeeTotal[] {
  const sav = savingsIds(cats);
  const groups = new Map<string, { names: Map<string, number>; totalCents: number; count: number }>();
  for (const t of txs) {
    if (t.type !== 'expense' || isSavingsTx(t, sav)) continue;
    const key = normPayee(t.payee);
    const g = groups.get(key) ?? { names: new Map(), totalCents: 0, count: 0 };
    g.names.set(t.payee.trim(), (g.names.get(t.payee.trim()) ?? 0) + 1);
    g.totalCents += t.amountCents;
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({
      // häufigste Schreibweise als Anzeigename
      payee: [...g.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
      totalCents: g.totalCents,
      count: g.count,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.payee.localeCompare(b.payee, 'de'))
    .slice(0, limit);
}
