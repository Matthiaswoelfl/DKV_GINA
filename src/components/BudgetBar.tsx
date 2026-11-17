import type { BudgetStatus } from '../../shared/stats';
import { formatEuro } from '../lib/format';

const COLOR: Record<BudgetStatus, string> = { ok: 'bg-green-600', warn: 'bg-amber-500', over: 'bg-red-600' };
const TEXT: Record<BudgetStatus, string> = {
  ok: 'text-green-700 dark:text-green-400',
  warn: 'text-amber-700 dark:text-amber-400',
  over: 'text-red-700 dark:text-red-400',
};

interface Props {
  label: string;
  spentCents: number;
  budgetCents: number;
  status: BudgetStatus;
}

/** Fortschrittsbalken: grün, gelb ab 80 %, rot bei Überschreitung. Status steht zusätzlich als Text da. */
export default function BudgetBar({ label, spentCents, budgetCents, status }: Props) {
  const ratio = budgetCents > 0 ? spentCents / budgetCents : 0;
  const remaining = budgetCents - spentCents;
  const note =
    status === 'over' ? `${formatEuro(-remaining)} überschritten` : status === 'warn' ? `ab 80 % erreicht, noch ${formatEuro(remaining)}` : `noch ${formatEuro(remaining)}`;
  return (
    <div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
        aria-label={`Budget ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuetext={`${Math.round(ratio * 100)} % von ${formatEuro(budgetCents)} verbraucht`}
      >
        <div className={`h-full rounded-full ${COLOR[status]}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      <p className="mt-1 flex justify-between gap-2 text-xs">
        <span className="tabular-nums">
          {formatEuro(spentCents)} von {formatEuro(budgetCents)} ({Math.round(ratio * 100)} %)
        </span>
        <span className={`font-medium ${TEXT[status]}`}>{note}</span>
      </p>
    </div>
  );
}
