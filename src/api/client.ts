import type { Category, Transaction, TransactionFilter, TransactionInput } from '../../shared/schemas';

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
  payees: (q: string) => call<string[]>(`/api/transactions/payees/suggest?q=${encodeURIComponent(q)}`),
};
