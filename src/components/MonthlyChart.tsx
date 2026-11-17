import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthLabel } from '../../shared/period';
import type { MonthPoint } from '../../shared/stats';
import { formatEuro, formatEuroShort } from '../lib/format';
import ChartTooltip from './ChartTooltip';

const SERIES = [
  { name: 'Einnahmen', color: 'var(--c-income)' },
  { name: 'Ausgaben', color: 'var(--c-expense)' },
  { name: 'Saldo', color: 'var(--c-balance)' },
] as const;

export function Legend() {
  return (
    <ul className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300" aria-label="Legende">
      {SERIES.map((s) => (
        <li key={s.name} className="flex items-center gap-1.5">
          <span className={`inline-block ${s.name === 'Saldo' ? 'h-0.5 w-4' : 'h-2.5 w-2.5 rounded-sm'}`} style={{ backgroundColor: s.color }} aria-hidden />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

export function MonthlyTable({ data }: { data: MonthPoint[] }) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700">
            <th className="py-1">Monat</th><th className="text-right">Einnahmen</th><th className="text-right">Ausgaben</th><th className="text-right">Gespart</th><th className="text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.month} className="border-b border-slate-100 last:border-0 dark:border-slate-700/50">
              <td className="py-1">{monthLabel(m.month)}</td>
              <td className="text-right tabular-nums">{formatEuro(m.incomeCents)}</td>
              <td className="text-right tabular-nums">{formatEuro(m.expenseCents)}</td>
              <td className="text-right tabular-nums">{formatEuro(m.savedCents)}</td>
              <td className="text-right tabular-nums">{formatEuro(m.balanceCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const rows = data.map((m) => ({
    label: monthLabel(m.month, 'short'),
    full: monthLabel(m.month),
    Einnahmen: m.incomeCents,
    Ausgaben: m.expenseCents,
    Saldo: m.balanceCents,
  }));
  return (
    <div>
      <Legend />
      <div className="h-72 text-slate-500" role="img" aria-label="Einnahmen, Ausgaben und Saldo pro Monat; Tabellenansicht verfügbar">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--c-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--c-grid)' }} tick={{ fill: 'var(--c-axis)', fontSize: 11 }} />
            <YAxis tickFormatter={formatEuroShort} tickLine={false} axisLine={false} width={64} tick={{ fill: 'var(--c-axis)', fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'var(--c-grid)' }} content={<ChartTooltip />} />
            <Bar dataKey="Einnahmen" fill="var(--c-income)" radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
            <Bar dataKey="Ausgaben" fill="var(--c-expense)" radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
            <Line dataKey="Saldo" type="linear" stroke="var(--c-balance)" strokeWidth={2} dot={{ r: 4, fill: 'var(--c-balance)', stroke: 'var(--c-surface)', strokeWidth: 2 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-500">Ausgaben ohne Sparen. Saldo = Einnahmen − Ausgaben − Gespartes.</p>
    </div>
  );
}
