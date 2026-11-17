import type { RecurringInterval, RecurringPayment, RecurringResult } from '../../shared/stats';
import type { AggCategory, AggTx } from './aggregate';

const CLASSES: Array<{ interval: RecurringInterval; min: number; max: number; months: number; minCount: number }> = [
  { interval: 'monthly', min: 26, max: 35, months: 1, minCount: 3 },
  { interval: 'quarterly', min: 84, max: 98, months: 3, minCount: 3 },
  { interval: 'yearly', min: 350, max: 380, months: 12, minCount: 2 },
];

/** Betragstoleranz: ±10 % oder mindestens ±0,50 € */
const amountTolerance = (cents: number) => Math.max(cents * 0.1, 50);
/** Anteil der Abstände, die zum Rhythmus passen müssen (ein ausgelassener Termin ist erlaubt). */
const MIN_REGULAR_SHARE = 0.7;
/** Tage Kulanz nach Ablauf des Rhythmus, bevor eine Zahlung als beendet gilt. */
const GRACE_DAYS = 10;

const normPayee = (s: string) => s.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');

function toUtc(date: string): number {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / 86_400_000);

/** Kalendermonate addieren; der Tag wird auf das Monatsende begrenzt (31.01. + 1 Monat = 28./29.02.). */
export function addMonths(date: string, months: number): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
};

/**
 * Erkennt regelmäßige Abbuchungen (monatlich, vierteljährlich, jährlich).
 * Je Empfänger zählt der Betrags-Cluster um den Median; Einmalkäufe beim selben Empfänger
 * stören nicht. Zahlungen, deren letzter Termin zu lange zurückliegt, gelten als beendet und
 * zählen nicht zur Monatssumme. Einnahmen und Sparen-Kategorien werden ignoriert.
 */
export function detectRecurring(txs: readonly AggTx[], cats: readonly AggCategory[], today: string): RecurringResult {
  const savings = new Set(cats.filter((c) => c.isSavings).map((c) => c.id));
  const groups = new Map<string, AggTx[]>();
  for (const t of txs) {
    if (t.type !== 'expense' || (t.categoryId !== null && savings.has(t.categoryId))) continue;
    const key = normPayee(t.payee);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const payments: RecurringPayment[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const med = median(sorted.map((t) => t.amountCents));
    const cluster = sorted.filter((t) => Math.abs(t.amountCents - med) <= amountTolerance(med));
    if (cluster.length < 2) continue;

    const intervals = cluster.slice(1).map((t, i) => daysBetween(cluster[i]?.date ?? t.date, t.date));
    const typical = median(intervals);
    const cls = CLASSES.find((c) => typical >= c.min && typical <= c.max);
    if (!cls || cluster.length < cls.minCount) continue;

    // Ein ausgelassener Termin (doppelter Abstand) ist noch regelmäßig.
    const regular = intervals.filter(
      (d) => (d >= cls.min && d <= cls.max) || (d >= cls.min * 2 && d <= cls.max * 2),
    ).length;
    if (regular / intervals.length < MIN_REGULAR_SHARE) continue;

    const last = cluster[cluster.length - 1];
    if (!last) continue;
    const active = daysBetween(last.date, today) <= cls.max + GRACE_DAYS;
    payments.push({
      payee: mostCommonName(cluster),
      categoryId: last.categoryId,
      amountCents: last.amountCents,
      interval: cls.interval,
      monthlyCents: Math.round(last.amountCents / cls.months),
      count: cluster.length,
      lastDate: last.date,
      nextDate: active ? addMonths(last.date, cls.months) : null,
      active,
    });
  }

  payments.sort((a, b) => Number(b.active) - Number(a.active) || b.monthlyCents - a.monthlyCents || a.payee.localeCompare(b.payee, 'de'));
  return {
    payments,
    monthlyTotalCents: payments.filter((p) => p.active).reduce((s, p) => s + p.monthlyCents, 0),
  };
}

function mostCommonName(txs: readonly AggTx[]): string {
  const counts = new Map<string, number>();
  for (const t of txs) counts.set(t.payee.trim(), (counts.get(t.payee.trim()) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}
