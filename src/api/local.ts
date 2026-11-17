/**
 * Browser-interne Variante der API für die Einzeldatei-Version (finanz-dashboard.html).
 * Gleiche Schnittstelle und gleiche Fachlogik wie der Server, aber die Daten liegen als
 * JSON (Backup-Format) im localStorage des Browsers.
 */
import { ZodError } from 'zod';
import { categorize } from '../../shared/categorize';
import { backupSchema, BACKUP_VERSION, checkBackupIntegrity, type Backup } from '../../shared/backup';
import { DEFAULT_CATEGORIES } from '../../shared/defaults';
import { lastDayOfMonth, monthsEndingAt } from '../../shared/period';
import {
  categoryInput,
  ruleInput,
  transactionInput,
  type Category,
  type Rule,
  type Transaction,
} from '../../shared/schemas';
import { categoryTrend, expensesByCategory, monthlySeries, summarize, topPayees, type AggCategory } from '../../server/domain/aggregate';
import { budgetProgress } from '../../server/domain/budget';
import { detectRecurring } from '../../server/domain/recurring';
import { centsToCsv, dateToCsv, text, toCsv } from '../../server/csv';
import { downloadText, fileStamp } from '../lib/download';
import type { api as RemoteApi } from './client';

export class ApiError extends Error {}
export type { TxQuery } from './client';
type TxQuery = Parameters<(typeof RemoteApi)['transactions']>[0];

// ---- Speicher -----------------------------------------------------------------

const KEY = 'finanz-dashboard-v1';
let cachedRaw: string | null = null;
let cached: Backup | null = null;
let storageBroken = false;

function emptyData(): Backup {
  return {
    app: 'finanz-dashboard',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories: DEFAULT_CATEGORIES.map(([name, type, color, savings], i) => ({
      id: i + 1,
      name,
      type,
      color,
      isSavings: savings === 1,
      sortOrder: i,
      archived: false,
    })),
    transactions: [],
    rules: [],
    budgets: [],
  };
}

function write(data: Backup): void {
  cached = data;
  if (storageBroken) return;
  const raw = JSON.stringify(data);
  try {
    localStorage.setItem(KEY, raw);
    cachedRaw = raw;
  } catch {
    storageBroken = true; // Daten bleiben bis zum Schließen der Seite im Speicher
    cachedRaw = null;
  }
}

function read(): Backup {
  if (storageBroken && cached) return cached;
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    storageBroken = true;
    cached ??= emptyData();
    return cached;
  }
  if (raw === null) {
    const fresh = cached && storageBroken ? cached : emptyData();
    write(fresh);
    return fresh;
  }
  if (raw === cachedRaw && cached) return cached;
  let parsed: ReturnType<typeof backupSchema.safeParse>;
  try {
    parsed = backupSchema.safeParse(JSON.parse(raw));
  } catch {
    parsed = backupSchema.safeParse(null);
  }
  if (!parsed.success) {
    // Nichts überschreiben: die Rohdaten bleiben für eine manuelle Rettung erhalten.
    throw new ApiError('Die gespeicherten Daten sind beschädigt. Stelle ein JSON-Backup wieder her (Seite „Daten“).');
  }
  cachedRaw = raw;
  cached = parsed.data;
  return parsed.data;
}

const nextId = (items: ReadonlyArray<{ id: number }>) => items.reduce((m, x) => Math.max(m, x.id), 0) + 1;
const now = () => new Date().toISOString();

/** ZodError in verständliche Meldungen übersetzen, wie es der Server tut. */
async function run<T>(fn: () => T): Promise<T> {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ZodError) throw new ApiError(e.issues.map((i) => i.message).join('; '));
    throw e;
  }
}

const lower = (s: string) => s.trim().toLocaleLowerCase('de-DE');

function categoryView(b: Backup, c: Backup['categories'][number]): Category {
  return { ...c, transactionCount: b.transactions.filter((t) => t.categoryId === c.id).length };
}

function rulesView(b: Backup): Rule[] {
  const type = new Map(b.categories.map((c) => [c.id, c.type]));
  return b.rules
    .flatMap((r) => {
      const categoryType = type.get(r.categoryId);
      return categoryType ? [{ ...r, categoryType }] : [];
    })
    .sort((a, c) => c.priority - a.priority || a.id - c.id);
}

const aggCats = (b: Backup): AggCategory[] => b.categories.map((c) => ({ id: c.id, isSavings: c.isSavings }));
const inRange = (b: Backup, from: string, to: string) => b.transactions.filter((t) => t.date >= from && t.date <= to);

function categoryTypeOk(b: Backup, categoryId: number | null, type: string): boolean {
  if (categoryId === null) return true;
  return b.categories.find((c) => c.id === categoryId)?.type === type;
}

function applyRulesTo(b: Backup): number {
  const rules = rulesView(b);
  let updated = 0;
  for (const t of b.transactions) {
    if (t.categoryId !== null) continue;
    const cat = categorize(t, rules);
    if (cat !== null) {
      t.categoryId = cat;
      t.updatedAt = now();
      updated++;
    }
  }
  return updated;
}

function csvOf(b: Backup): string {
  const catName = new Map(b.categories.map((c) => [c.id, c.name]));
  const rows = [...b.transactions].sort((a, c) => a.date.localeCompare(c.date) || a.id - c.id);
  return toCsv([
    ['Datum', 'Typ', 'Betrag', 'Kategorie', 'Empfänger', 'Notiz'],
    ...rows.map((t) => [
      dateToCsv(t.date),
      t.type === 'income' ? 'Einnahme' : 'Ausgabe',
      centsToCsv(t.type === 'income' ? t.amountCents : -t.amountCents),
      text(t.categoryId === null ? '' : (catName.get(t.categoryId) ?? '')),
      text(t.payee),
      text(t.note),
    ]),
  ]);
}

// ---- API ----------------------------------------------------------------------

export const api: typeof RemoteApi = {
  categories: () => run(() => read().categories.map((c) => categoryView(read(), c)).sort((a, b) => b.type.localeCompare(a.type) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'de'))),

  createCategory: (input) =>
    run(() => {
      const i = categoryInput.parse(input);
      const b = read();
      if (b.categories.some((c) => c.type === i.type && lower(c.name) === lower(i.name))) {
        throw new ApiError(`Es gibt bereits eine Kategorie „${i.name}“`);
      }
      const c = { id: nextId(b.categories), ...i, sortOrder: b.categories.reduce((m, x) => Math.max(m, x.sortOrder), -1) + 1 };
      b.categories.push(c);
      write(b);
      return categoryView(b, c);
    }),

  updateCategory: (id, input) =>
    run(() => {
      const i = categoryInput.parse(input);
      const b = read();
      const c = b.categories.find((x) => x.id === id);
      if (!c) throw new ApiError('Kategorie nicht gefunden');
      if (c.type !== i.type) throw new ApiError('Der Typ einer Kategorie kann nicht geändert werden');
      if (b.categories.some((x) => x.id !== id && x.type === i.type && lower(x.name) === lower(i.name))) {
        throw new ApiError(`Es gibt bereits eine Kategorie „${i.name}“`);
      }
      Object.assign(c, { name: i.name, color: i.color, isSavings: i.isSavings, archived: i.archived });
      write(b);
      return categoryView(b, c);
    }),

  deleteCategory: (id, reassignTo) =>
    run(() => {
      const b = read();
      const c = b.categories.find((x) => x.id === id);
      if (!c) throw new ApiError('Kategorie nicht gefunden');
      const count = b.transactions.filter((t) => t.categoryId === id).length;
      if (count > 0 && reassignTo === undefined) throw new ApiError(`Die Kategorie hat ${count} Buchungen. Bitte Ziel angeben.`);
      let target: number | null = null;
      if (typeof reassignTo === 'number') {
        const t = b.categories.find((x) => x.id === reassignTo);
        if (!t || t.type !== c.type || t.id === id) throw new ApiError('Ungültige Ziel-Kategorie');
        target = t.id;
      }
      for (const t of b.transactions) if (t.categoryId === id) t.categoryId = target;
      b.categories = b.categories.filter((x) => x.id !== id);
      b.rules = b.rules.filter((r) => r.categoryId !== id);
      b.budgets = b.budgets.filter((x) => x.categoryId !== id);
      write(b);
      return undefined;
    }),

  rules: () => run(() => rulesView(read())),

  createRule: (input) =>
    run(() => {
      const i = ruleInput.parse(input);
      const b = read();
      if (!b.categories.some((c) => c.id === i.categoryId)) throw new ApiError('Kategorie existiert nicht');
      b.rules.push({ id: nextId(b.rules), ...i });
      write(b);
      const created = rulesView(b).find((r) => r.id === nextId(b.rules) - 1);
      if (!created) throw new ApiError('Regel konnte nicht angelegt werden');
      return created;
    }),

  updateRule: (id, input) =>
    run(() => {
      const i = ruleInput.parse(input);
      const b = read();
      const r = b.rules.find((x) => x.id === id);
      if (!r) throw new ApiError('Regel nicht gefunden');
      if (!b.categories.some((c) => c.id === i.categoryId)) throw new ApiError('Kategorie existiert nicht');
      Object.assign(r, i);
      write(b);
      const updated = rulesView(b).find((x) => x.id === id);
      if (!updated) throw new ApiError('Regel nicht gefunden');
      return updated;
    }),

  deleteRule: (id) =>
    run(() => {
      const b = read();
      if (!b.rules.some((r) => r.id === id)) throw new ApiError('Regel nicht gefunden');
      b.rules = b.rules.filter((r) => r.id !== id);
      write(b);
      return undefined;
    }),

  applyRules: () =>
    run(() => {
      const b = read();
      const updated = applyRulesTo(b);
      if (updated > 0) write(b);
      return { updated };
    }),

  transactionCount: () => run(() => ({ count: read().transactions.length })),
  uncategorizedCount: () => run(() => ({ count: read().transactions.filter((t) => t.categoryId === null).length })),

  transactions: (q: TxQuery) =>
    run(() => {
      const b = read();
      const catName = new Map(b.categories.map((c) => [c.id, c.name]));
      const needle = q.q ? lower(q.q) : null;
      const list = b.transactions.filter(
        (t) =>
          (!q.from || t.date >= q.from) &&
          (!q.to || t.date <= q.to) &&
          (q.uncategorized ? t.categoryId === null : q.categoryId === undefined || t.categoryId === q.categoryId) &&
          (!q.type || t.type === q.type) &&
          (q.minCents === undefined || t.amountCents >= q.minCents) &&
          (q.maxCents === undefined || t.amountCents <= q.maxCents) &&
          (needle === null || lower(t.payee).includes(needle) || lower(t.note).includes(needle)),
      );
      const key = (t: Transaction): string | number =>
        q.sort === 'amount' ? t.amountCents : q.sort === 'payee' ? t.payee : q.sort === 'category' ? (t.categoryId === null ? '' : (catName.get(t.categoryId) ?? '')) : t.date;
      const sign = q.dir === 'asc' ? 1 : -1;
      return list
        .map((t): Transaction => ({ ...t }))
        .sort((a, c) => {
          const x = key(a);
          const y = key(c);
          const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'de', { sensitivity: 'base' });
          return r * sign || c.id - a.id;
        });
    }),

  createTransaction: (input) =>
    run(() => {
      const i = transactionInput.parse(input);
      const b = read();
      if (!categoryTypeOk(b, i.categoryId, i.type)) throw new ApiError('Kategorie passt nicht zum Typ der Buchung');
      const t: Transaction = {
        id: nextId(b.transactions),
        ...i,
        categoryId: i.categoryId ?? categorize(i, rulesView(b)),
        createdAt: now(),
        updatedAt: now(),
      };
      b.transactions.push(t);
      write(b);
      return { ...t };
    }),

  updateTransaction: (id, input) =>
    run(() => {
      const i = transactionInput.parse(input);
      const b = read();
      const t = b.transactions.find((x) => x.id === id);
      if (!t) throw new ApiError('Buchung nicht gefunden');
      if (!categoryTypeOk(b, i.categoryId, i.type)) throw new ApiError('Kategorie passt nicht zum Typ der Buchung');
      Object.assign(t, i, { updatedAt: now() });
      write(b);
      return { ...t };
    }),

  setCategory: (id, categoryId) =>
    run(() => {
      const b = read();
      const t = b.transactions.find((x) => x.id === id);
      if (!t) throw new ApiError('Buchung nicht gefunden');
      if (!categoryTypeOk(b, categoryId, t.type)) throw new ApiError('Kategorie passt nicht zum Typ der Buchung');
      t.categoryId = categoryId;
      t.updatedAt = now();
      write(b);
      return { ...t };
    }),

  deleteTransaction: (id) =>
    run(() => {
      const b = read();
      if (!b.transactions.some((t) => t.id === id)) throw new ApiError('Buchung nicht gefunden');
      b.transactions = b.transactions.filter((t) => t.id !== id);
      write(b);
      return undefined;
    }),

  payees: (q) =>
    run(() => {
      const prefix = lower(q);
      const counts = new Map<string, number>();
      for (const t of read().transactions) if (lower(t.payee).startsWith(prefix)) counts.set(t.payee, (counts.get(t.payee) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de')).slice(0, 8).map(([p]) => p);
    }),

  budgets: () => run(() => read().budgets.map((x) => ({ ...x }))),

  setBudget: (categoryId, monthlyCents) =>
    run(() => {
      if (!Number.isInteger(monthlyCents) || monthlyCents <= 0) throw new ApiError('Bitte einen Betrag größer 0 eingeben');
      const b = read();
      const c = b.categories.find((x) => x.id === categoryId);
      if (!c) throw new ApiError('Kategorie nicht gefunden');
      if (c.type !== 'expense' || c.isSavings) throw new ApiError('Budgets gibt es nur für Ausgaben-Kategorien ohne „Sparen“');
      const existing = b.budgets.find((x) => x.categoryId === categoryId);
      if (existing) existing.monthlyCents = monthlyCents;
      else b.budgets.push({ categoryId, monthlyCents });
      write(b);
      return { categoryId, monthlyCents };
    }),

  deleteBudget: (categoryId) =>
    run(() => {
      const b = read();
      if (!b.budgets.some((x) => x.categoryId === categoryId)) throw new ApiError('Kein Budget für diese Kategorie');
      b.budgets = b.budgets.filter((x) => x.categoryId !== categoryId);
      write(b);
      return undefined;
    }),

  summary: (from, to) => run(() => summarize(inRange(read(), from, to), aggCats(read()))),
  byCategory: (from, to) => run(() => expensesByCategory(inRange(read(), from, to), aggCats(read()))),
  topPayees: (from, to, limit = 10) => run(() => topPayees(inRange(read(), from, to), aggCats(read()), limit)),
  budgetProgress: (from, to, scale = 1) =>
    run(() => budgetProgress(read().budgets, expensesByCategory(inRange(read(), from, to), aggCats(read())), scale)),
  monthly: (end, months = 12) =>
    run(() => {
      const list = monthsEndingAt(end, months);
      return monthlySeries(inRange(read(), `${list[0] ?? end}-01`, lastDayOfMonth(end)), aggCats(read()), list);
    }),
  categoryTrend: (categoryId, end, months = 12) =>
    run(() => {
      const list = monthsEndingAt(end, months);
      return categoryTrend(inRange(read(), `${list[0] ?? end}-01`, lastDayOfMonth(end)), categoryId, list);
    }),
  recurring: (today) => run(() => detectRecurring(read().transactions.filter((t) => t.type === 'expense'), aggCats(read()), today)),

  exportJson: () => run(() => JSON.stringify({ ...read(), exportedAt: now() }, null, 2)),
  exportCsv: () => run(() => csvOf(read())),

  importBackup: (json, dryRun) =>
    run(() => {
      const parsed = backupSchema.safeParse(json);
      if (!parsed.success) throw new ApiError('Das ist keine gültige Backup-Datei dieser App.');
      const problem = checkBackupIntegrity(parsed.data);
      if (problem) throw new ApiError(`Backup ist inkonsistent: ${problem}`);
      const b = parsed.data;
      const summary = { categories: b.categories.length, transactions: b.transactions.length, rules: b.rules.length, budgets: b.budgets.length, exportedAt: b.exportedAt };
      if (dryRun) return summary;
      // Vor dem Ersetzen den bisherigen Stand als Datei sichern (Download-Ordner).
      const safetyBackup = (() => {
        try {
          const name = `vor-wiederherstellung-${fileStamp()}.json`;
          downloadText(name, 'application/json', JSON.stringify({ ...read(), exportedAt: now() }, null, 2));
          return name;
        } catch {
          return null; // beschädigter Bestand: Wiederherstellung trotzdem erlauben
        }
      })();
      write(b);
      return { ...summary, safetyBackup };
    }),

  loadDemo: () =>
    run(() => {
      const b = read();
      if (b.transactions.length > 0) throw new ApiError('Beispieldaten lassen sich nur in einer leeren Datenbank laden.');
      const id = (name: string, type: 'income' | 'expense') => b.categories.find((c) => c.name === name && c.type === type)?.id ?? null;
      const monthly: Array<[string, 'income' | 'expense', number, string | null, number]> = [
        ['Arbeitgeber GmbH', 'income', 320000, 'Gehalt', 1],
        ['Vermieter Müller', 'expense', 95000, 'Wohnen', 2],
        ['Sparplan ETF', 'expense', 30000, 'Sparen', 3],
        ['Netflix', 'expense', 1299, 'Abos', 5],
        ['Spotify', 'expense', 1099, 'Abos', 7],
        ['REWE', 'expense', 6420, 'Lebensmittel', 9],
        ['Tankstelle Aral', 'expense', 7200, 'Mobilität', 12],
        ['Aldi', 'expense', 3270, 'Lebensmittel', 14],
        ['Pizzeria Roma', 'expense', 3850, 'Restaurants', 16],
        ['REWE', 'expense', 4815, 'Lebensmittel', 19],
        ['Amazon', 'expense', 2990, null, 21],
      ];
      const today = new Date();
      let n = 1;
      for (let back = 5; back >= 0; back--) {
        const d = new Date(today.getFullYear(), today.getMonth() - back, 1);
        for (const [payee, type, amountCents, cat, day] of monthly) {
          const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          b.transactions.push({ id: n++, date, amountCents, type, categoryId: cat ? id(cat, type) : null, payee, note: '', createdAt: now(), updatedAt: now() });
        }
      }
      for (const [name, cents] of [['Lebensmittel', 14000], ['Mobilität', 8500], ['Restaurants', 20000]] as const) {
        const cid = id(name, 'expense');
        if (cid !== null) b.budgets.push({ categoryId: cid, monthlyCents: cents });
      }
      write(b);
    }),

  storageProblem: () => storageBroken,
};
