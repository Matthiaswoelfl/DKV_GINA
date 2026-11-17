import type { PeriodKind } from '../../shared/period';
import type { Summary } from '../../shared/stats';
import { formatEuro, formatPercent } from '../lib/format';

const PREV_LABEL: Record<PeriodKind, string> = {
  month: 'Vormonat',
  quarter: 'Vorquartal',
  year: 'Vorjahr',
  custom: 'Vorzeitraum',
};

interface DeltaProps {
  text: string | null;
  /** true = Anstieg ist gut, false = Anstieg ist schlecht */
  upIsGood: boolean;
  direction: 'up' | 'down' | 'flat';
  prevLabel: string;
}

function Delta({ text, upIsGood, direction, prevLabel }: DeltaProps) {
  if (text === null) return <p className="mt-1 text-xs text-slate-500">kein Vergleich zum {prevLabel}</p>;
  const good = direction === 'flat' ? null : (direction === 'up') === upIsGood;
  const color = good === null ? 'text-slate-500' : good ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400';
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '■';
  return (
    <p className={`mt-1 text-xs ${color}`}>
      <span aria-hidden>{arrow}</span> {text} <span className="text-slate-500">zum {prevLabel}</span>
    </p>
  );
}

const direction = (diff: number): 'up' | 'down' | 'flat' => (diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat');

/** Relative Änderung in %; null, wenn der Vergleichswert 0 ist. */
function relative(cur: number, prev: number): string | null {
  if (prev === 0) return null;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const s = Math.abs(pct).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${s} %`;
}

interface Props {
  current: Summary | undefined;
  previous: Summary | undefined;
  kind: PeriodKind;
}

export default function KpiCards({ current: c, previous: p, kind }: Props) {
  const prevLabel = PREV_LABEL[kind];
  const tile = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60';

  const money = (cur: number, prev: number | undefined, upIsGood: boolean) => (
    <Delta text={prev === undefined ? null : relative(cur, prev)} direction={direction(cur - (prev ?? cur))} upIsGood={upIsGood} prevLabel={prevLabel} />
  );

  const rate = c?.savingsRate ?? null;
  const prevRate = p?.savingsRate ?? null;
  const rateDiff = rate !== null && prevRate !== null ? (rate - prevRate) * 100 : null;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className={tile}>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Einnahmen</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{c ? formatEuro(c.incomeCents) : '…'}</p>
        {c && money(c.incomeCents, p?.incomeCents, true)}
      </div>
      <div className={tile}>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ausgaben</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{c ? formatEuro(c.expenseCents) : '…'}</p>
        {c && money(c.expenseCents, p?.expenseCents, false)}
      </div>
      <div className={tile}>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Saldo</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${c && c.balanceCents < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>
          {c ? formatEuro(c.balanceCents) : '…'}
        </p>
        {c && money(c.balanceCents, p?.balanceCents, true)}
        {c && c.savedCents > 0 && <p className="text-xs text-slate-500">nach {formatEuro(c.savedCents)} Gespartem</p>}
      </div>
      <div className={tile}>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sparquote</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{c ? (rate === null ? '–' : formatPercent(rate)) : '…'}</p>
        {c && (
          <Delta
            text={rateDiff === null ? null : `${rateDiff > 0 ? '+' : rateDiff < 0 ? '−' : ''}${Math.abs(rateDiff).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Pp.`}
            direction={direction(rateDiff ?? 0)}
            upIsGood
            prevLabel={prevLabel}
          />
        )}
        {c && rate === null && <p className="text-xs text-slate-500">keine Einnahmen im Zeitraum</p>}
      </div>
    </div>
  );
}
