import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { parseAmountToCents } from '../../shared/money';
import { periodContaining, periodLabel, shiftPeriod, type Period } from '../../shared/period';
import type { Category } from '../../shared/schemas';
import BudgetBar from '../components/BudgetBar';
import ConfirmDialog from '../components/ConfirmDialog';
import { centsToInput, formatEuro, todayIso } from '../lib/format';

const card = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60';

export default function Budgets() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>(() => periodContaining('month', todayIso()));
  const [editing, setEditing] = useState<number | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);

  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const budgets = useQuery({ queryKey: ['budgets'], queryFn: api.budgets });
  const progress = useQuery({ queryKey: ['stats', 'budget-progress', period.from, period.to, 1], queryFn: () => api.budgetProgress(period.from, period.to) });

  const refresh = () => Promise.all(['budgets', 'stats'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const onError = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Aktion fehlgeschlagen');

  const save = useMutation({
    mutationFn: (v: { id: number; cents: number }) => api.setBudget(v.id, v.cents),
    onSuccess: async () => { setEditing(null); setError(null); await refresh(); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteBudget(id),
    onSuccess: async () => { setRemoving(null); await refresh(); },
    onError: (e) => { setRemoving(null); onError(e); },
  });

  const eligible = (categories.data ?? []).filter((c) => c.type === 'expense' && !c.isSavings && !c.archived);
  const byId = new Map((progress.data ?? []).map((p) => [p.categoryId, p]));
  const withBudget = eligible.filter((c) => byId.has(c.id)).sort((a, b) => (byId.get(b.id)?.ratio ?? 0) - (byId.get(a.id)?.ratio ?? 0));
  const without = eligible.filter((c) => !byId.has(c.id));
  const totalBudget = (progress.data ?? []).reduce((s, p) => s + p.budgetCents, 0);
  const totalSpent = (progress.data ?? []).reduce((s, p) => s + p.spentCents, 0);

  function startEdit(c: Category) {
    setEditing(c.id);
    setError(null);
    const current = budgets.data?.find((b) => b.categoryId === c.id)?.monthlyCents;
    setValue(current ? centsToInput(current) : '');
  }
  function submit(c: Category) {
    const cents = parseAmountToCents(value);
    if (cents === null || cents <= 0) return setError('Bitte einen Betrag größer 0 eingeben (z. B. 400,00).');
    save.mutate({ id: c.id, cents });
  }

  const editor = (c: Category) => (
    <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); submit(c); }}>
      <label className="sr-only" htmlFor={`b-${c.id}`}>Monatsbudget für {c.name}</label>
      <input id={`b-${c.id}`} autoFocus className="input !w-32 text-right" inputMode="decimal" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} />
      <span className="text-sm">€ pro Monat</span>
      <button className="btn-primary" disabled={save.isPending}>Speichern</button>
      <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Abbrechen</button>
    </form>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary !px-2.5" aria-label="Vorheriger Monat" onClick={() => setPeriod(shiftPeriod(period, -1))}>‹</button>
        <span className="min-w-36 text-center text-sm font-semibold" aria-live="polite">{periodLabel(period)}</span>
        <button className="btn-secondary !px-2.5" aria-label="Nächster Monat" onClick={() => setPeriod(shiftPeriod(period, 1))}>›</button>
        <button className="btn-secondary" onClick={() => setPeriod(periodContaining('month', todayIso()))}>Heute</button>
      </div>

      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      {(categories.isError || budgets.isError || progress.isError) && <p role="alert" className="text-sm text-red-600">Budgets konnten nicht geladen werden.</p>}

      {withBudget.length > 0 && (
        <section className={card} aria-label="Gesamt">
          <h2 className="mb-2 text-sm font-semibold">Gesamt (alle Budgets)</h2>
          <BudgetBar label="Gesamt" spentCents={totalSpent} budgetCents={totalBudget} status={totalSpent > totalBudget ? 'over' : totalSpent * 100 >= totalBudget * 80 ? 'warn' : 'ok'} />
        </section>
      )}

      <section className={card} aria-label="Budgets pro Kategorie">
        <h2 className="mb-3 text-sm font-semibold">Budgets pro Kategorie</h2>
        {withBudget.length === 0 && !categories.isLoading && (
          <p className="mb-4 rounded-md bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
            Noch kein Budget gesetzt. Lege unten für eine Kategorie ein Monatsbudget fest, dann siehst du hier und auf dem Dashboard, ob du im Rahmen bleibst.
          </p>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {withBudget.map((c) => {
            const p = byId.get(c.id);
            if (!p) return null;
            return (
              <li key={c.id} className="py-3">
                <div className="mb-1.5 flex items-center gap-2 text-sm">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: c.color }} aria-hidden />
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-auto flex gap-1">
                    <button className="px-1 text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => startEdit(c)}>Ändern</button>
                    <button className="px-1 text-red-600 dark:text-red-400 hover:underline" onClick={() => setRemoving(c)}>Entfernen</button>
                  </span>
                </div>
                <BudgetBar label={c.name} spentCents={p.spentCents} budgetCents={p.budgetCents} status={p.status} />
                {editing === c.id && editor(c)}
              </li>
            );
          })}
        </ul>
        {without.length > 0 && (
          <>
            <h3 className="mb-1 mt-4 text-xs font-medium text-slate-500">Ohne Budget</h3>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {without.map((c) => (
                <li key={c.id} className="py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: c.color }} aria-hidden />
                    <span>{c.name}</span>
                    {editing !== c.id && <button className="ml-auto px-1 text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => startEdit(c)}>Budget festlegen</button>}
                  </div>
                  {editing === c.id && editor(c)}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-3 text-xs text-slate-500">Budgets sind Monatsbeträge. Kategorien mit „Sparen“ haben keins. Aktuell gesetzt: {formatEuro(totalBudget)} pro Monat.</p>
      </section>

      {removing && (
        <ConfirmDialog title="Budget entfernen?" message={`Das Budget für „${removing.name}“ wird gelöscht. Buchungen bleiben unverändert.`} confirmLabel="Entfernen" onConfirm={() => remove.mutate(removing.id)} onCancel={() => setRemoving(null)} />
      )}
    </div>
  );
}
