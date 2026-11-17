export type PeriodKind = 'month' | 'quarter' | 'year' | 'custom';

export interface Period {
  kind: PeriodKind;
  /** Erster Tag, "JJJJ-MM-TT" */
  from: string;
  /** Letzter Tag (einschließlich), "JJJJ-MM-TT" */
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function parse(date: string): { y: number; m: number; d: number } {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  return { y, m, d };
}

function addDays(date: string, days: number): string {
  const { y, m, d } = parse(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

/** Der Zeitraum der gewünschten Art, der das Datum enthält. Für "custom" der einzelne Tag. */
export function periodContaining(kind: PeriodKind, date: string): Period {
  const { y, m } = parse(date);
  switch (kind) {
    case 'month':
      return { kind, from: iso(y, m, 1), to: iso(y, m, lastDayOf(y, m)) };
    case 'quarter': {
      const startMonth = Math.floor((m - 1) / 3) * 3 + 1;
      return { kind, from: iso(y, startMonth, 1), to: iso(y, startMonth + 2, lastDayOf(y, startMonth + 2)) };
    }
    case 'year':
      return { kind, from: iso(y, 1, 1), to: iso(y, 12, 31) };
    case 'custom':
      return { kind, from: date, to: date };
  }
}

/** Einen Zeitraum vor (-1) oder zurück (+1). Benutzerdefinierte Zeiträume rücken um ihre Länge. */
export function shiftPeriod(p: Period, direction: 1 | -1): Period {
  if (p.kind === 'custom') {
    const length = dayDiff(p.from, p.to) + 1;
    return { kind: 'custom', from: addDays(p.from, direction * length), to: addDays(p.to, direction * length) };
  }
  const { y, m } = parse(p.from);
  const step = p.kind === 'month' ? 1 : p.kind === 'quarter' ? 3 : 12;
  const total = y * 12 + (m - 1) + direction * step;
  return periodContaining(p.kind, iso(Math.floor(total / 12), (total % 12) + 1, 1));
}

export const previousPeriod = (p: Period): Period => shiftPeriod(p, -1);

const de = (iso: string) => iso.split('-').reverse().join('.');

export function monthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  const { y, m } = parse(`${month}-01`);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('de-DE', {
    month: style,
    year: style === 'long' ? 'numeric' : '2-digit',
    timeZone: 'UTC',
  });
}

export function periodLabel(p: Period): string {
  const { y, m } = parse(p.from);
  switch (p.kind) {
    case 'month':
      return monthLabel(p.from.slice(0, 7));
    case 'quarter':
      return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
    case 'year':
      return String(y);
    case 'custom':
      return p.from === p.to ? de(p.from) : `${de(p.from)} – ${de(p.to)}`;
  }
}

/** Die letzten `count` Monate bis einschließlich `endMonth` ("JJJJ-MM"), älteste zuerst. */
export function monthsEndingAt(endMonth: string, count: number): string[] {
  const { y, m } = parse(`${endMonth}-01`);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    out.push(`${Math.floor(total / 12)}-${pad((total % 12) + 1)}`);
  }
  return out;
}

export const lastDayOfMonth = (month: string): string => {
  const { y, m } = parse(`${month}-01`);
  return iso(y, m, lastDayOf(y, m));
};
