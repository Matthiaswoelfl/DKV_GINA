import { describe, expect, it } from 'vitest';
import { categoryTrend, expensesByCategory, monthlySeries, summarize, topPayees, type AggCategory, type AggTx } from './aggregate';

const cats: AggCategory[] = [
  { id: 1, isSavings: false }, // Lebensmittel
  { id: 2, isSavings: true }, // Sparen
  { id: 3, isSavings: false }, // Gehalt
];
const tx = (date: string, amountCents: number, type: 'income' | 'expense', categoryId: number | null, payee = 'X'): AggTx => ({
  date,
  amountCents,
  type,
  categoryId,
  payee,
});

describe('summarize', () => {
  const txs = [
    tx('2026-11-01', 300000, 'income', 3),
    tx('2026-11-02', 50000, 'expense', 1),
    tx('2026-11-03', 10000, 'expense', null),
    tx('2026-11-04', 40000, 'expense', 2),
  ];
  it('trennt Ausgaben und Gespartes', () => {
    expect(summarize(txs, cats)).toEqual({
      incomeCents: 300000,
      expenseCents: 60000,
      savedCents: 40000,
      balanceCents: 200000,
      savingsRate: 0.8,
    });
  });
  it('Sparquote ist null ohne Einnahmen, leere Liste ergibt Nullen', () => {
    expect(summarize([tx('2026-11-02', 100, 'expense', 1)], cats).savingsRate).toBeNull();
    expect(summarize([], cats)).toEqual({ incomeCents: 0, expenseCents: 0, savedCents: 0, balanceCents: 0, savingsRate: null });
  });
  it('Sparquote kann negativ sein', () => {
    const r = summarize([tx('2026-11-01', 1000, 'income', 3), tx('2026-11-02', 1500, 'expense', 1)], cats);
    expect(r.savingsRate).toBeCloseTo(-0.5);
  });
  it('rechnet exakt in Cent (keine Rundungsfehler)', () => {
    const many = Array.from({ length: 10 }, () => tx('2026-11-01', 10, 'expense', 1));
    expect(summarize(many, cats).expenseCents).toBe(100);
  });
});

describe('monthlySeries', () => {
  const months = ['2026-09', '2026-10', '2026-11'];
  const txs = [
    tx('2026-09-30', 1000, 'income', 3),
    tx('2026-11-01', 2000, 'income', 3),
    tx('2026-11-15', 500, 'expense', 1),
    tx('2026-11-20', 300, 'expense', 2),
    tx('2025-01-01', 9999, 'expense', 1), // außerhalb
  ];
  it('füllt leere Monate mit 0 und grenzt Monate korrekt ab', () => {
    const s = monthlySeries(txs, cats, months);
    expect(s.map((m) => m.month)).toEqual(months);
    expect(s[0]).toMatchObject({ incomeCents: 1000, expenseCents: 0, balanceCents: 1000 });
    expect(s[1]).toMatchObject({ incomeCents: 0, expenseCents: 0, savedCents: 0, balanceCents: 0 });
    expect(s[2]).toMatchObject({ incomeCents: 2000, expenseCents: 500, savedCents: 300, balanceCents: 1200 });
  });
});

describe('expensesByCategory', () => {
  it('summiert, sortiert, schließt Einnahmen und Sparen aus, behält unkategorisiert', () => {
    const r = expensesByCategory(
      [
        tx('2026-11-01', 100, 'expense', 1),
        tx('2026-11-02', 700, 'expense', null),
        tx('2026-11-03', 300, 'expense', 1),
        tx('2026-11-04', 5000, 'expense', 2),
        tx('2026-11-05', 9000, 'income', 3),
      ],
      cats,
    );
    expect(r).toEqual([
      { categoryId: null, totalCents: 700 },
      { categoryId: 1, totalCents: 400 },
    ]);
  });
});

describe('categoryTrend', () => {
  it('liefert je Monat die Summe der Kategorie', () => {
    const r = categoryTrend(
      [tx('2026-10-05', 100, 'expense', 1), tx('2026-11-05', 250, 'expense', 1), tx('2026-11-06', 999, 'expense', 2)],
      1,
      ['2026-09', '2026-10', '2026-11'],
    );
    expect(r.map((x) => x.totalCents)).toEqual([0, 100, 250]);
  });
});

describe('topPayees', () => {
  it('fasst Schreibweisen zusammen, sortiert und begrenzt', () => {
    const r = topPayees(
      [
        tx('2026-11-01', 1000, 'expense', 1, 'REWE'),
        tx('2026-11-02', 500, 'expense', 1, 'rewe '),
        tx('2026-11-03', 500, 'expense', 1, 'REWE'),
        tx('2026-11-04', 1800, 'expense', 1, 'Vermieter'),
        tx('2026-11-05', 7000, 'expense', 2, 'Sparplan'),
        tx('2026-11-06', 5000, 'income', 3, 'Firma'),
      ],
      cats,
      5,
    );
    expect(r).toEqual([
      { payee: 'REWE', totalCents: 2000, count: 3 },
      { payee: 'Vermieter', totalCents: 1800, count: 1 },
    ]);
    expect(topPayees([tx('2026-11-01', 1, 'expense', 1, 'A'), tx('2026-11-01', 2, 'expense', 1, 'B')], cats, 1)).toHaveLength(1);
  });
});
