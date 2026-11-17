import { z } from 'zod';
import { isoDate, matchField, matchType, transactionType } from './schemas';

export const BACKUP_VERSION = 1;

const id = z.number().int().positive();

export const backupSchema = z.object({
  app: z.literal('finanz-dashboard'),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  categories: z.array(
    z.object({
      id,
      name: z.string().min(1).max(50),
      type: transactionType,
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      isSavings: z.boolean(),
      sortOrder: z.number().int(),
      archived: z.boolean(),
    }),
  ),
  transactions: z.array(
    z.object({
      id,
      date: isoDate,
      amountCents: z.number().int().positive(),
      type: transactionType,
      categoryId: id.nullable(),
      payee: z.string().min(1).max(200),
      note: z.string().max(1000),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  rules: z.array(
    z.object({
      id,
      matchField,
      matchType,
      pattern: z.string().min(1).max(200),
      categoryId: id,
      priority: z.number().int(),
      enabled: z.boolean(),
    }),
  ),
  budgets: z.array(z.object({ categoryId: id, monthlyCents: z.number().int().positive() })),
});
export type Backup = z.infer<typeof backupSchema>;

/** Prüft, was das Schema nicht ausdrücken kann: eindeutige IDs und gültige Verweise. */
export function checkBackupIntegrity(b: Backup): string | null {
  const catType = new Map<number, string>();
  for (const c of b.categories) {
    if (catType.has(c.id)) return `Kategorie-ID ${c.id} kommt doppelt vor`;
    catType.set(c.id, c.type);
  }
  const txIds = new Set<number>();
  for (const t of b.transactions) {
    if (txIds.has(t.id)) return `Buchungs-ID ${t.id} kommt doppelt vor`;
    txIds.add(t.id);
    if (t.categoryId !== null) {
      const type = catType.get(t.categoryId);
      if (type === undefined) return `Buchung ${t.id} verweist auf eine unbekannte Kategorie`;
      if (type !== t.type) return `Buchung ${t.id}: Kategorie passt nicht zum Typ`;
    }
  }
  const ruleIds = new Set<number>();
  for (const r of b.rules) {
    if (ruleIds.has(r.id)) return `Regel-ID ${r.id} kommt doppelt vor`;
    ruleIds.add(r.id);
    if (!catType.has(r.categoryId)) return `Regel ${r.id} verweist auf eine unbekannte Kategorie`;
  }
  const budgetCats = new Set<number>();
  for (const bu of b.budgets) {
    if (!catType.has(bu.categoryId)) return 'Ein Budget verweist auf eine unbekannte Kategorie';
    if (budgetCats.has(bu.categoryId)) return 'Eine Kategorie hat mehrere Budgets';
    budgetCats.add(bu.categoryId);
  }
  return null;
}
