import type { BudgetProgress, BudgetStatus } from '../../shared/stats';
import type { CategoryTotal } from '../../shared/stats';

export interface BudgetRow {
  categoryId: number;
  monthlyCents: number;
}

export function budgetStatus(spentCents: number, budgetCents: number): BudgetStatus {
  if (spentCents > budgetCents) return 'over';
  return spentCents * 100 >= budgetCents * 80 ? 'warn' : 'ok';
}

/**
 * Vergleicht die Ausgaben je Kategorie mit den Monatsbudgets.
 * `scale` rechnet das Monatsbudget auf den Zeitraum um (z. B. 3 für ein Quartal).
 * Größte Auslastung zuerst.
 */
export function budgetProgress(budgets: readonly BudgetRow[], spent: readonly CategoryTotal[], scale = 1): BudgetProgress[] {
  const spentBy = new Map(spent.map((s) => [s.categoryId, s.totalCents]));
  return budgets
    .map((b) => {
      const budgetCents = Math.round(b.monthlyCents * scale);
      const spentCents = spentBy.get(b.categoryId) ?? 0;
      return {
        categoryId: b.categoryId,
        budgetCents,
        spentCents,
        ratio: budgetCents > 0 ? spentCents / budgetCents : 0,
        status: budgetStatus(spentCents, budgetCents),
      };
    })
    .sort((a, b) => b.ratio - a.ratio || a.categoryId - b.categoryId);
}
