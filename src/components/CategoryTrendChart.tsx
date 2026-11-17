import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthLabel } from '../../shared/period';
import { formatEuro, formatEuroShort } from '../lib/format';
import ChartTooltip from './ChartTooltip';

interface Props {
  name: string;
  color: string;
  data: Array<{ month: string; totalCents: number }>;
}

export function TrendTable({ data }: Pick<Props, 'data'>) {
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full text-sm">
        <tbody>
          {data.map((m) => (
            <tr key={m.month} className="border-b border-slate-100 last:border-0 dark:border-slate-700/50">
              <td className="py-1">{monthLabel(m.month)}</td>
              <td className="text-right tabular-nums">{formatEuro(m.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CategoryTrendChart({ name, color, data }: Props) {
  const rows = data.map((m) => ({ label: monthLabel(m.month, 'short'), full: monthLabel(m.month), [name]: m.totalCents }));
  return (
    <div className="h-64" role="img" aria-label={`Verlauf der Kategorie ${name}; Tabellenansicht verfügbar`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--c-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--c-grid)' }} tick={{ fill: 'var(--c-axis)', fontSize: 11 }} />
          <YAxis tickFormatter={formatEuroShort} tickLine={false} axisLine={false} width={64} tick={{ fill: 'var(--c-axis)', fontSize: 11 }} />
          <Tooltip cursor={{ fill: 'var(--c-grid)' }} content={<ChartTooltip />} />
          <Bar dataKey={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
