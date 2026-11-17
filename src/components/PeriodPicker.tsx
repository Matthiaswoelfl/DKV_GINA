import { periodContaining, periodLabel, shiftPeriod, type Period, type PeriodKind } from '../../shared/period';
import { todayIso } from '../lib/format';

const KINDS: Array<[PeriodKind, string]> = [
  ['month', 'Monat'],
  ['quarter', 'Quartal'],
  ['year', 'Jahr'],
  ['custom', 'Benutzerdefiniert'],
];

interface Props {
  period: Period;
  onChange: (p: Period) => void;
}

export default function PeriodPicker({ period, onChange }: Props) {
  function changeKind(kind: PeriodKind) {
    if (kind === 'custom') onChange({ kind, from: period.from, to: period.to });
    else onChange(periodContaining(kind, period.from));
  }
  const btn = 'btn-secondary !px-2.5';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600" role="group" aria-label="Zeitraum-Art">
        {KINDS.map(([k, label]) => (
          <button
            key={k}
            aria-pressed={period.kind === k}
            className={`px-3 py-1.5 text-sm ${period.kind === k ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700'}`}
            onClick={() => changeKind(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <button className={btn} aria-label="Vorheriger Zeitraum" onClick={() => onChange(shiftPeriod(period, -1))}>‹</button>
      {period.kind === 'custom' ? (
        <div className="flex items-center gap-1">
          <input aria-label="Von" type="date" className="input !w-auto" value={period.from} max={period.to} onChange={(e) => e.target.value && onChange({ ...period, from: e.target.value })} />
          <span>–</span>
          <input aria-label="Bis" type="date" className="input !w-auto" value={period.to} min={period.from} onChange={(e) => e.target.value && onChange({ ...period, to: e.target.value })} />
        </div>
      ) : (
        <span className="min-w-36 text-center text-sm font-semibold" aria-live="polite">{periodLabel(period)}</span>
      )}
      <button className={btn} aria-label="Nächster Zeitraum" onClick={() => onChange(shiftPeriod(period, 1))}>›</button>
      {period.kind !== 'custom' && (
        <button className={btn} onClick={() => onChange(periodContaining(period.kind, todayIso()))}>Heute</button>
      )}
    </div>
  );
}
