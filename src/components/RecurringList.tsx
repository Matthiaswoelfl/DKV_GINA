import type { Category } from '../../shared/schemas';
import type { RecurringInterval, RecurringResult } from '../../shared/stats';
import { formatDate, formatEuro } from '../lib/format';
import { EmptyChart } from './ChartCard';

const INTERVAL: Record<RecurringInterval, string> = { monthly: 'monatlich', quarterly: 'vierteljährlich', yearly: 'jährlich' };

export default function RecurringList({ data, categories }: { data: RecurringResult; categories: Category[] }) {
  if (data.payments.length === 0) {
    return <EmptyChart>Noch keine regelmäßigen Zahlungen erkannt. Dafür braucht es mindestens drei gleiche Abbuchungen im Monatsabstand (bei jährlichen zwei).</EmptyChart>;
  }
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (
    <div>
      <p className="mb-3 text-sm">
        Aktive Zahlungen kosten dich <strong className="tabular-nums">{formatEuro(data.monthlyTotalCents)}</strong> pro Monat
        <span className="text-slate-500"> ({formatEuro(data.monthlyTotalCents * 12)} pro Jahr)</span>
      </p>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700">
              <th className="py-1">Empfänger</th><th>Rhythmus</th><th className="text-right">Betrag</th><th className="text-right">pro Monat</th><th className="text-right">Nächste</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map((p) => {
              const c = p.categoryId ? byId.get(p.categoryId) : undefined;
              return (
                <tr key={p.payee} className={`border-b border-slate-100 last:border-0 dark:border-slate-700/50 ${p.active ? '' : 'opacity-60'}`}>
                  <td className="py-1.5 pr-2">
                    {c && <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ backgroundColor: c.color }} aria-hidden />}
                    {p.payee}
                    {!p.active && <span className="ml-2 rounded bg-slate-200 px-1.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">beendet?</span>}
                  </td>
                  <td className="pr-2">{INTERVAL[p.interval]}</td>
                  <td className="text-right tabular-nums">{formatEuro(p.amountCents)}</td>
                  <td className="text-right tabular-nums">{formatEuro(p.monthlyCents)}</td>
                  <td className="whitespace-nowrap text-right">{p.nextDate ? formatDate(p.nextDate) : `zuletzt ${formatDate(p.lastDate)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
