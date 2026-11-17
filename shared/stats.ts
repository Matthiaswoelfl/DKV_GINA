// Ergebnistypen der Statistik-API (Server und Frontend teilen sie).

export interface Summary {
  incomeCents: number;
  /** Ausgaben ohne Sparen-Kategorien */
  expenseCents: number;
  /** Ausgaben in Sparen-Kategorien */
  savedCents: number;
  /** Einnahmen − Ausgaben − Gespartes: was auf dem Konto übrig bleibt */
  balanceCents: number;
  /** (Einnahmen − Ausgaben) / Einnahmen, null ohne Einnahmen */
  savingsRate: number | null;
}

export interface MonthPoint extends Omit<Summary, 'savingsRate'> {
  month: string;
}

export interface CategoryTotal {
  categoryId: number | null;
  totalCents: number;
}

export interface PayeeTotal {
  payee: string;
  totalCents: number;
  count: number;
}


export type BudgetStatus = 'ok' | 'warn' | 'over';

export interface BudgetProgress {
  categoryId: number;
  budgetCents: number;
  spentCents: number;
  /** spent / budget, z. B. 0.85 */
  ratio: number;
  /** ok < 80 %, warn ab 80 % bis einschließlich 100 %, over bei Überschreitung */
  status: BudgetStatus;
}

export type RecurringInterval = 'monthly' | 'quarterly' | 'yearly';

export interface RecurringPayment {
  payee: string;
  categoryId: number | null;
  /** aktueller Betrag je Abbuchung */
  amountCents: number;
  interval: RecurringInterval;
  /** auf einen Monat umgerechnet */
  monthlyCents: number;
  count: number;
  lastDate: string;
  /** nächste erwartete Abbuchung, nur bei aktiven Zahlungen */
  nextDate: string | null;
  active: boolean;
}

export interface RecurringResult {
  payments: RecurringPayment[];
  /** Summe der aktiven Zahlungen pro Monat */
  monthlyTotalCents: number;
}
