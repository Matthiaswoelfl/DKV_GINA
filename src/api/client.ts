import type {
  Category,
  CategoryInput,
  Rule,
  RuleInput,
  Transaction,
  TransactionFilter,
  TransactionInput,
} from '../../shared/schemas';
import type { BudgetProgress, CategoryTotal, MonthPoint, PayeeTotal, RecurringResult, Summary } from '../../shared/stats';

export class ApiError extends Error {}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError('Server nicht erreichbar. Läuft „npm run dev“?');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? `Fehler ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export type TxQuery = Partial<Omit<TransactionFilter, 'sort' | 'dir'>> &
  Pick<TransactionFilter, 'sort' | 'dir'>;

export const api = {
  categories: () => call<Category[]>('/api/categories'),
  createCategory: (c: CategoryInput) =>
    call<Category>('/api/categories', { method: 'POST', body: JSON.stringify(c) }),
  updateCategory: (id: number, c: CategoryInput) =>
    call<Category>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(c) }),
  deleteCategory: (id: number, reassignTo?: number | 'none') =>
    call<undefined>(`/api/categories/${id}${reassignTo === undefined ? '' : `?reassignTo=${reassignTo}`}`, {
      method: 'DELETE',
    }),
  rules: () => call<Rule[]>('/api/rules'),
  createRule: (r: RuleInput) => call<Rule>('/api/rules', { method: 'POST', body: JSON.stringify(r) }),
  updateRule: (id: number, r: RuleInput) =>
    call<Rule>(`/api/rules/${id}`, { method: 'PUT', body: JSON.stringify(r) }),
  deleteRule: (id: number) => call<undefined>(`/api/rules/${id}`, { method: 'DELETE' }),
  applyRules: () => call<{ updated: number }>('/api/rules/apply', { method: 'POST' }),
  uncategorizedCount: () => call<{ count: number }>('/api/transactions/uncategorized/count'),
  transactions: (q: TxQuery) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
    return call<Transaction[]>(`/api/transactions?${p}`);
  },
  createTransaction: (t: TransactionInput) =>
    call<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(t) }),
  updateTransaction: (id: number, t: TransactionInput) =>
    call<Transaction>(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(t) }),
  setCategory: (id: number, categoryId: number | null) =>
    call<Transaction>(`/api/transactions/${id}/category`, {
      method: 'PATCH',
      body: JSON.stringify({ categoryId }),
    }),
  deleteTransaction: (id: number) => call<undefined>(`/api/transactions/${id}`, { method: 'DELETE' }),
  summary: (from: string, to: string) => call<Summary>(`/api/stats/summary?from=${from}&to=${to}`),
  byCategory: (from: string, to: string) => call<CategoryTotal[]>(`/api/stats/by-category?from=${from}&to=${to}`),
  topPayees: (from: string, to: string, limit = 10) =>
    call<PayeeTotal[]>(`/api/stats/top-payees?from=${from}&to=${to}&limit=${limit}`),
  monthly: (end: string, months = 12) => call<MonthPoint[]>(`/api/stats/monthly?end=${end}&months=${months}`),
  categoryTrend: (categoryId: number, end: string, months = 12) =>
    call<Array<{ month: string; totalCents: number }>>(
      `/api/stats/category-trend?categoryId=${categoryId}&end=${end}&months=${months}`,
    ),
  budgets: () => call<Array<{ categoryId: number; monthlyCents: number }>>('/api/budgets'),
  setBudget: (categoryId: number, monthlyCents: number) =>
    call<{ categoryId: number; monthlyCents: number }>(`/api/budgets/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify({ monthlyCents }),
    }),
  deleteBudget: (categoryId: number) => call<undefined>(`/api/budgets/${categoryId}`, { method: 'DELETE' }),
  budgetProgress: (from: string, to: string, scale = 1) =>
    call<BudgetProgress[]>(`/api/stats/budget-progress?from=${from}&to=${to}&scale=${scale}`),
  recurring: (today: string) => call<RecurringResult>(`/api/stats/recurring?today=${today}`),
  importBackup: (json: unknown, dryRun: boolean) =>
    call<{ categories: number; transactions: number; rules: number; budgets: number; exportedAt: string; safetyBackup?: string | null }>(
      `/api/import/json${dryRun ? '?dryRun=1' : ''}`,
      { method: 'POST', body: JSON.stringify(json) },
    ),
  payees: (q: string) => call<string[]>(`/api/transactions/payees/suggest?q=${encodeURIComponent(q)}`),
};
