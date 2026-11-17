import { describe, expect, it } from 'vitest';
import { budgetProgress, budgetStatus } from './budget';

describe('budgetStatus', () => {
  it('Grenzen: unter 80 % ok, ab 80 % bis 100 % warn, darüber over', () => {
    expect(budgetStatus(7999, 10000)).toBe('ok');
    expect(budgetStatus(8000, 10000)).toBe('warn');
    expect(budgetStatus(10000, 10000)).toBe('warn');
    expect(budgetStatus(10001, 10000)).toBe('over');
    expect(budgetStatus(0, 10000)).toBe('ok');
  });
});

describe('budgetProgress', () => {
  const budgets = [
    { categoryId: 1, monthlyCents: 40000 },
    { categoryId: 2, monthlyCents: 10000 },
    { categoryId: 3, monthlyCents: 5000 },
  ];
  const spent = [
    { categoryId: 2, totalCents: 12000 },
    { categoryId: 1, totalCents: 32000 },
    { categoryId: null, totalCents: 999 },
  ];
  it('verbindet Budget und Ausgaben, sortiert nach Auslastung', () => {
    const r = budgetProgress(budgets, spent);
    expect(r.map((x) => [x.categoryId, x.status])).toEqual([
      [2, 'over'],
      [1, 'warn'],
      [3, 'ok'],
    ]);
    expect(r[0]).toMatchObject({ spentCents: 12000, budgetCents: 10000, ratio: 1.2 });
    expect(r[2]).toMatchObject({ spentCents: 0, ratio: 0 });
  });
  it('skaliert das Budget auf den Zeitraum', () => {
    const r = budgetProgress([{ categoryId: 2, monthlyCents: 10000 }], spent, 3);
    expect(r[0]).toMatchObject({ budgetCents: 30000, status: 'ok' });
  });
});
