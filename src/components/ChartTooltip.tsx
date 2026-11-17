import { formatEuro } from '../lib/format';

interface Entry {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: { fill?: string; full?: string };
}

interface Props {
  active?: boolean;
  payload?: Entry[];
  title?: string;
}

/** Einheitlicher Tooltip mit exakten Euro-Beträgen (Werte in Cent). */
export default function ChartTooltip({ active, payload, title }: Props) {
  if (!active || !payload || payload.length === 0) return null;
  const heading = title ?? payload[0]?.payload?.full;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-600 dark:bg-slate-800">
      {heading && <p className="mb-1 font-semibold">{heading}</p>}
      <ul className="space-y-0.5">
        {payload.map((e, i) => (
          <li key={`${e.name}-${i}`} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: e.color ?? e.payload?.fill }} aria-hidden />
            <span className="text-slate-600 dark:text-slate-300">{e.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums">{formatEuro(Number(e.value ?? 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
