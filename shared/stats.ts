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

