import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  chart: ReactNode;
  /** Tabellenansicht desselben Inhalts (Barrierefreiheit). */
  table?: ReactNode;
}

export default function ChartCard({ title, subtitle, actions, chart, table }: Props) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {table && (
            <button className="btn-secondary !px-2 !py-1 text-xs" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>
              {showTable ? 'Diagramm' : 'Tabelle'}
            </button>
          )}
        </div>
      </div>
      {showTable && table ? table : chart}
    </section>
  );
}

export function EmptyChart({ children }: { children: ReactNode }) {
  return <p className="flex h-40 items-center justify-center text-center text-sm text-slate-500">{children}</p>;
}
