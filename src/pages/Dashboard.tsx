import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError, type TxQuery } from '../api/client';
import { periodContaining, previousPeriod, type Period } from '../../shared/period';
import ChartCard, { EmptyChart } from '../components/ChartCard';
import CategoryDonut, { toSlices, UNCATEGORIZED_KEY } from '../components/CategoryDonut';
import CategoryTrendChart, { TrendTable } from '../components/CategoryTrendChart';
import BudgetBar from '../components/BudgetBar';
import RecurringList from '../components/RecurringList';
import KpiCards from '../components/KpiCards';
import MonthlyChart, { MonthlyTable } from '../components/MonthlyChart';
import PeriodPicker from '../components/PeriodPicker';
import TopPayees from '../components/TopPayees';
import { formatDate, formatEuro, todayIso } from '../lib/format';

const MAX_ROWS = 100;

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>(() => periodContaining('month', todayIso()));
  const [selected, setSelected] = useState<string | null>(null);
  const [trendCategory, setTrendCategory] = useState<string>('');
  const prev = useMemo(() => previousPeriod(period), [period]);

  const total = useQuery({ queryKey: ['transactions', 'count'], queryFn: api.transactionCount });
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const summary = useQuery({ queryKey: ['stats', 'summary', period.from, period.to], queryFn: () => api.summary(period.from, period.to) });
  const prevSummary = useQuery({ queryKey: ['stats', 'summary', prev.from, prev.to], queryFn: () => api.summary(prev.from, prev.to) });
  const byCategory = useQuery({ queryKey: ['stats', 'by-category', period.from, period.to], queryFn: () => api.byCategory(period.from, period.to) });
  const payees = useQuery({ queryKey: ['stats', 'payees', period.from, period.to], queryFn: () => api.topPayees(period.from, period.to, 10) });

  // Verlauf: bis zum Monat des Zeitraum-Endes, höchstens bis zum aktuellen Monat.
  const endMonth = period.to.slice(0, 7) < todayIso().slice(0, 7) ? period.to.slice(0, 7) : todayIso().slice(0, 7);
  const monthly = useQuery({ queryKey: ['stats', 'monthly', endMonth], queryFn: () => api.monthly(endMonth, 12) });

  // Monatsbudgets auf den Zeitraum hochrechnen (Quartal = 3, Jahr = 12, sonst anteilig nach Tagen).
  const budgetScale =
    period.kind === 'month' ? 1 : period.kind === 'quarter' ? 3 : period.kind === 'year' ? 12 : Math.max(0.01, (Date.parse(period.to) - Date.parse(period.from)) / 86_400_000 / 30.4375 + 1 / 30.4375);
  const budgetScaleRounded = Math.round(budgetScale * 1000) / 1000;
  const budgets = useQuery({ queryKey: ['stats', 'budget-progress', period.from, period.to, budgetScaleRounded], queryFn: () => api.budgetProgress(period.from, period.to, budgetScaleRounded) });
  const recurring = useQuery({ queryKey: ['stats', 'recurring', todayIso()], queryFn: () => api.recurring(todayIso()) });

  const cats = categories.data ?? [];
  const slices = toSlices(byCategory.data ?? [], cats);
  const firstCategoryKey = slices.find((s) => s.key !== UNCATEGORIZED_KEY)?.key ?? '';
  const trendKey = trendCategory || firstCategoryKey || String(cats.find((c) => c.type === 'expense' && !c.isSavings)?.id ?? '');
  const trendCat = cats.find((c) => String(c.id) === trendKey);
  const trend = useQuery({
    queryKey: ['stats', 'trend', trendKey, endMonth],
    queryFn: () => api.categoryTrend(Number(trendKey), endMonth, 12),
    enabled: trendKey !== '',
  });

  const listQuery: TxQuery = {
    sort: 'date',
    dir: 'desc',
    from: period.from,
    to: period.to,
    ...(selected === UNCATEGORIZED_KEY ? { uncategorized: '1' as const, type: 'expense' as const } : {}),
    ...(selected && selected !== UNCATEGORIZED_KEY ? { categoryId: Number(selected) } : {}),
  };
  const txs = useQuery({ queryKey: ['transactions', 'dashboard', listQuery], queryFn: () => api.transactions(listQuery) });
  const rows = txs.data ?? [];
  const selectedName = selected ? slices.find((s) => s.key === selected)?.name ?? cats.find((c) => String(c.id) === selected)?.name : null;
  const catById = new Map(cats.map((c) => [c.id, c]));

  const error = [summary, byCategory, monthly, payees, categories].find((q) => q.isError);
  const empty = summary.data && summary.data.incomeCents === 0 && summary.data.expenseCents === 0 && summary.data.savedCents === 0;

  function changePeriod(p: Period) {
    setPeriod(p);
    setSelected(null);
  }

  if (total.data?.count === 0) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <h2 className="text-lg font-semibold">Willkommen!</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Noch ist nichts erfasst. Sobald du die ersten Buchungen angelegt hast, zeigt dir das Dashboard, wohin dein Geld geht und wie sich das über die Zeit verändert.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link className="btn-primary" to="/transaktionen">Erste Buchung erfassen</Link>
          <Link className="btn-secondary" to="/daten">Backup wiederherstellen</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PeriodPicker period={period} onChange={changePeriod} />

      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error.error instanceof ApiError ? error.error.message : 'Daten konnten nicht geladen werden.'}
        </p>
      )}

      <KpiCards current={summary.data} previous={prevSummary.data} kind={period.kind} />
      {empty && <p className="text-sm text-slate-500">Keine Buchungen in diesem Zeitraum. Unter „Transaktionen“ kannst du welche erfassen.</p>}

      <ChartCard
        title="Budgets"
        subtitle={period.kind === 'month' ? 'Verbrauch im gewählten Monat' : 'Monatsbudgets hochgerechnet auf den Zeitraum'}
        actions={<Link className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline" to="/budgets">Budgets verwalten</Link>}
        chart={
          budgets.isError ? (
            <EmptyChart>Budgets konnten nicht geladen werden.</EmptyChart>
          ) : (budgets.data ?? []).length === 0 ? (
            <EmptyChart>Noch keine Budgets. Lege unter „Budgets“ Monatsbeträge pro Kategorie fest.</EmptyChart>
          ) : (
            <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              {(budgets.data ?? []).map((p) => {
                const c = cats.find((x) => x.id === p.categoryId);
                return (
                  <li key={p.categoryId}>
                    <p className="mb-1 flex items-center gap-2 text-sm">
                      <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: c?.color }} aria-hidden />
                      {c?.name}
                    </p>
                    <BudgetBar label={c?.name ?? ''} spentCents={p.spentCents} budgetCents={p.budgetCents} status={p.status} />
                  </li>
                );
              })}
            </ul>
          )
        }
      />

      <ChartCard
        title="Ausgaben nach Kategorie"
        subtitle="Klick auf eine Kategorie filtert die Buchungen darunter (ohne Sparen)"
        chart={<CategoryDonut data={byCategory.data ?? []} categories={cats} selected={selected} onSelect={setSelected} />}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60" aria-label="Buchungen im Zeitraum">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{selectedName ? `Buchungen: ${selectedName}` : 'Buchungen im Zeitraum'} ({rows.length})</h2>
          {selected && <button className="btn-secondary !py-1 text-xs" onClick={() => setSelected(null)}>Filter aufheben</button>}
        </div>
        {rows.length === 0 ? (
          <EmptyChart>Keine Buchungen.</EmptyChart>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <tbody>
                {rows.slice(0, MAX_ROWS).map((t) => {
                  const c = t.categoryId ? catById.get(t.categoryId) : undefined;
                  return (
                    <tr key={t.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700/50">
                      <td className="whitespace-nowrap py-1.5 pr-3">{formatDate(t.date)}</td>
                      <td className="pr-3">{t.payee}</td>
                      <td className="pr-3 text-slate-500">
                        {c && <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ backgroundColor: c.color }} aria-hidden />}
                        {c?.name ?? 'Unkategorisiert'}
                      </td>
                      <td className={`whitespace-nowrap text-right tabular-nums ${t.type === 'income' ? 'text-green-700 dark:text-green-400' : ''}`}>
                        {t.type === 'income' ? '+' : '−'}{formatEuro(t.amountCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > MAX_ROWS && <p className="pt-2 text-xs text-slate-500">Die ersten {MAX_ROWS} von {rows.length} Buchungen. Alle findest du unter „Transaktionen“.</p>}
          </div>
        )}
      </section>

      <ChartCard
        title="Einnahmen und Ausgaben pro Monat"
        subtitle="Letzte 12 Monate"
        chart={monthly.data ? <MonthlyChart data={monthly.data} /> : <EmptyChart>Lade …</EmptyChart>}
        table={monthly.data ? <MonthlyTable data={monthly.data} /> : undefined}
      />

      <ChartCard
        title="Wiederkehrende Zahlungen"
        subtitle="Automatisch aus deinen Buchungen erkannt (Abos, Verträge)"
        chart={recurring.data ? <RecurringList data={recurring.data} categories={cats} /> : <EmptyChart>{recurring.isError ? 'Konnte nicht geladen werden.' : 'Lade …'}</EmptyChart>}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Kategorie-Trend"
          subtitle={trendCat ? `${trendCat.name}, letzte 12 Monate` : 'Letzte 12 Monate'}
          actions={
            <select aria-label="Kategorie für den Trend" className="input !w-auto" value={trendKey} onChange={(e) => setTrendCategory(e.target.value)}>
              {(['expense', 'income'] as const).map((t) => (
                <optgroup key={t} label={t === 'expense' ? 'Ausgaben' : 'Einnahmen'}>
                  {cats.filter((c) => c.type === t).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          }
          chart={trendCat && trend.data ? <CategoryTrendChart name={trendCat.name} color={trendCat.color} data={trend.data} /> : <EmptyChart>Keine Kategorie gewählt.</EmptyChart>}
          table={trend.data ? <TrendTable data={trend.data} /> : undefined}
        />
        <ChartCard title="Top-Empfänger" subtitle="Größte Ausgaben im Zeitraum (ohne Sparen)" chart={<TopPayees data={payees.data ?? []} />} />
      </div>
    </div>
  );
}
