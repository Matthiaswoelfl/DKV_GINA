import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type TxQuery } from '../api/client';
import { parseAmountToCents } from '../../shared/money';
import type { Transaction, TransactionFilter } from '../../shared/schemas';
import TransactionForm from '../components/TransactionForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate, formatEuro } from '../lib/format';

type SortKey = TransactionFilter['sort'];

export default function Transactions() {
  const qc = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<'' | 'income' | 'expense'>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [q, setQ] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [sort, setSort] = useState<SortKey>('date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const minCents = min ? parseAmountToCents(min) : null;
  const maxCents = max ? parseAmountToCents(max) : null;

  const query: TxQuery = {
    sort,
    dir,
    from: from || undefined,
    to: to || undefined,
    type: type || undefined,
    q: q || undefined,
    uncategorized: categoryFilter === 'none' ? '1' : undefined,
    categoryId: categoryFilter && categoryFilter !== 'none' ? Number(categoryFilter) : undefined,
    minCents: minCents ?? undefined,
    maxCents: maxCents ?? undefined,
  };

  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const txs = useQuery({ queryKey: ['transactions', query], queryFn: () => api.transactions(query) });

  const onError = (e: unknown) => setActionError(e instanceof ApiError ? e.message : 'Aktion fehlgeschlagen');
  const setCategory = useMutation({
    mutationFn: (v: { id: number; categoryId: number | null }) => api.setCategory(v.id, v.categoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteTransaction(id),
    onSuccess: () => {
      setDeleting(null);
      return qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (e) => {
      setDeleting(null);
      onError(e);
    },
  });

  const cats = categories.data ?? [];
  const catById = new Map(cats.map((c) => [c.id, c]));
  const rows = txs.data ?? [];
  const sumIncome = rows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountCents, 0);
  const sumExpense = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0);

  function toggleSort(key: SortKey) {
    if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setDir(key === 'date' || key === 'amount' ? 'desc' : 'asc');
    }
  }
  const arrow = (key: SortKey) => (sort === key ? (dir === 'asc' ? ' ▲' : ' ▼') : '');
  const filtersActive = Boolean(from || to || type || categoryFilter || q || min || max);

  const card = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60';

  return (
    <div className="space-y-5">
      <section className={card} aria-label="Neue Buchung">
        <h2 className="mb-3 text-sm font-semibold">Neue Buchung</h2>
        {categories.isError ? (
          <p role="alert" className="text-sm text-red-600">Kategorien konnten nicht geladen werden.</p>
        ) : (
          <TransactionForm categories={cats} />
        )}
      </section>

      <section className={card} aria-label="Filter">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
          <div className="col-span-2">
            <label className="label" htmlFor="f-q">Suche</label>
            <input id="f-q" className="input" placeholder="Empfänger oder Notiz" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-from">Von</label>
            <input id="f-from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-to">Bis</label>
            <input id="f-to" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-type">Typ</label>
            <select id="f-type" className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="">Alle</option>
              <option value="expense">Ausgaben</option>
              <option value="income">Einnahmen</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-2">
            <label className="label" htmlFor="f-cat">Kategorie</label>
            <select id="f-cat" className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Alle</option>
              <option value="none">Unkategorisiert</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === 'income' ? 'Einnahme' : 'Ausgabe'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-min">Betrag ab (€)</label>
            <input id="f-min" className="input" inputMode="decimal" aria-invalid={min !== '' && minCents === null} value={min} onChange={(e) => setMin(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-max">Betrag bis (€)</label>
            <input id="f-max" className="input" inputMode="decimal" aria-invalid={max !== '' && maxCents === null} value={max} onChange={(e) => setMax(e.target.value)} />
          </div>
          {filtersActive && (
            <div className="flex items-end">
              <button
                className="btn-secondary"
                onClick={() => {
                  setFrom(''); setTo(''); setType(''); setCategoryFilter(''); setQ(''); setMin(''); setMax('');
                }}
              >
                Filter zurücksetzen
              </button>
            </div>
          )}
        </div>
      </section>

      {actionError && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {actionError}
        </p>
      )}

      <section className={`${card} overflow-x-auto`} aria-label="Buchungen">
        {txs.isError ? (
          <p role="alert" className="text-sm text-red-600">
            {txs.error instanceof ApiError ? txs.error.message : 'Buchungen konnten nicht geladen werden.'}
          </p>
        ) : txs.isLoading ? (
          <p className="text-sm text-slate-500">Lade …</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {filtersActive ? 'Keine Buchungen für diese Filter.' : 'Noch keine Buchungen. Lege oben die erste an.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700">
                <th className="py-2 pr-3"><button onClick={() => toggleSort('date')}>Datum{arrow('date')}</button></th>
                <th className="pr-3"><button onClick={() => toggleSort('payee')}>Empfänger{arrow('payee')}</button></th>
                <th className="pr-3"><button onClick={() => toggleSort('category')}>Kategorie{arrow('category')}</button></th>
                <th className="pr-3 text-right"><button onClick={() => toggleSort('amount')}>Betrag{arrow('amount')}</button></th>
                <th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700/50">
                  <td className="whitespace-nowrap py-2 pr-3">{formatDate(t.date)}</td>
                  <td className="pr-3">
                    {t.payee}
                    {t.note && <span className="block text-xs text-slate-500">{t.note}</span>}
                  </td>
                  <td className="pr-3">
                    <select
                      aria-label={`Kategorie für ${t.payee}`}
                      className="rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-300 dark:hover:border-slate-600"
                      style={{ color: t.categoryId ? catById.get(t.categoryId)?.color : undefined }}
                      value={t.categoryId ?? ''}
                      onChange={(e) =>
                        setCategory.mutate({ id: t.id, categoryId: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    >
                      <option value="">— unkategorisiert —</option>
                      {cats.filter((c) => c.type === t.type).map((c) => (
                        <option key={c.id} value={c.id} className="text-slate-900">{c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className={`whitespace-nowrap pr-3 text-right tabular-nums ${t.type === 'income' ? 'text-green-600' : ''}`}>
                    {t.type === 'income' ? '+' : '−'}{formatEuro(t.amountCents)}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button className="px-2 text-indigo-600 hover:underline" onClick={() => setEditing(t)}>Bearbeiten</button>
                    <button className="px-2 text-red-600 hover:underline" onClick={() => setDeleting(t)}>Löschen</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-xs text-slate-500">
                <td colSpan={5} className="pt-3 text-right">
                  {rows.length} Buchungen · Einnahmen {formatEuro(sumIncome)} · Ausgaben {formatEuro(sumExpense)} · Saldo {formatEuro(sumIncome - sumExpense)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Buchung bearbeiten" onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}>
          <div className="w-full max-w-3xl rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800">
            <h2 className="mb-3 text-lg font-semibold">Buchung bearbeiten</h2>
            <TransactionForm categories={cats} editing={editing} onDone={() => setEditing(null)} />
          </div>
        </div>
      )}
      {deleting && (
        <ConfirmDialog
          title="Buchung löschen?"
          message={`„${deleting.payee}“ vom ${formatDate(deleting.date)} (${formatEuro(deleting.amountCents)}) wird endgültig gelöscht.`}
          onConfirm={() => remove.mutate(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
