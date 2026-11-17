import type { PayeeTotal } from '../../shared/stats';
import { formatEuro } from '../lib/format';
import { EmptyChart } from './ChartCard';

export default function TopPayees({ data }: { data: PayeeTotal[] }) {
  if (data.length === 0) return <EmptyChart>Keine Ausgaben im Zeitraum.</EmptyChart>;
  const max = Math.max(...data.map((d) => d.totalCents));
  return (
    <ol className="space-y-2">
      {data.map((d) => (
        <li key={d.payee} title={`${d.payee}: ${formatEuro(d.totalCents)} in ${d.count} Buchungen`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{d.payee}</span>
            <span className="shrink-0 tabular-nums">
              {formatEuro(d.totalCents)} <span className="text-xs text-slate-500">({d.count}×)</span>
            </span>
          </div>
          <div className="mt-0.5 h-2 rounded-r bg-slate-100 dark:bg-slate-700" aria-hidden>
            <div className="h-2 rounded-r" style={{ width: `${(d.totalCents / max) * 100}%`, backgroundColor: 'var(--c-income)' }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
