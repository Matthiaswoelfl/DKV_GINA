import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Category } from '../../shared/schemas';
import type { CategoryTotal } from '../../shared/stats';
import { formatEuro, formatPercent } from '../lib/format';
import ChartTooltip from './ChartTooltip';
import { EmptyChart } from './ChartCard';

export const UNCATEGORIZED_KEY = 'none';

interface Props {
  data: CategoryTotal[];
  categories: Category[];
  /** Ausgewählte Kategorie: Kategorie-ID als String, "none" oder null. */
  selected: string | null;
  onSelect: (key: string | null) => void;
}

interface Slice {
  key: string;
  name: string;
  color: string;
  value: number;
}

export function toSlices(data: CategoryTotal[], categories: Category[]): Slice[] {
  return data.map((d) => {
    const c = d.categoryId === null ? undefined : categories.find((x) => x.id === d.categoryId);
    return {
      key: d.categoryId === null ? UNCATEGORIZED_KEY : String(d.categoryId),
      name: c?.name ?? 'Unkategorisiert',
      color: c?.color ?? 'var(--c-uncategorized)',
      value: d.totalCents,
    };
  });
}

export default function CategoryDonut({ data, categories, selected, onSelect }: Props) {
  const slices = toSlices(data, categories);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (slices.length === 0) return <EmptyChart>Keine Ausgaben im Zeitraum.</EmptyChart>;

  const toggle = (key: string) => onSelect(selected === key ? null : key);
  const dim = (key: string) => (selected !== null && selected !== key ? 0.3 : 1);

  return (
    <div className="grid items-center gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
      <div className="relative h-60" role="img" aria-label={`Ausgaben nach Kategorie, gesamt ${formatEuro(total)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" paddingAngle={2} stroke="var(--c-surface)" strokeWidth={2} onClick={(_slice, i) => {
                const s = slices[i];
                if (s) toggle(s.key);
              }} cursor="pointer" isAnimationActive={false}>
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} fillOpacity={dim(s.key)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-500">Ausgaben</span>
          <span className="text-lg font-semibold tabular-nums">{formatEuro(total)}</span>
        </div>
      </div>
      <ul className="space-y-0.5" aria-label="Kategorien">
        {slices.map((s) => (
          <li key={s.key}>
            <button
              aria-pressed={selected === s.key}
              onClick={() => toggle(s.key)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${selected === s.key ? 'bg-slate-100 font-semibold dark:bg-slate-700' : ''}`}
              style={{ opacity: dim(s.key) === 1 ? 1 : 0.6 }}
            >
              <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
              <span className="truncate">{s.name}</span>
              <span className="ml-auto pl-2 tabular-nums">{formatEuro(s.value)}</span>
              <span className="w-14 text-right text-xs tabular-nums text-slate-500">{formatPercent(s.value / total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
