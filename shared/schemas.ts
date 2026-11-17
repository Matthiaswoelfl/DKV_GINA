import { z } from 'zod';

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format JJJJ-MM-TT vorliegen')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Ungültiges Datum');

export const transactionType = z.enum(['income', 'expense']);
export type TransactionType = z.infer<typeof transactionType>;

export const transactionInput = z.object({
  date: isoDate,
  amountCents: z.number().int().positive().max(100_000_000_000),
  type: transactionType,
  categoryId: z.number().int().positive().nullable(),
  payee: z.string().trim().min(1, 'Empfänger/Beschreibung fehlt').max(200),
  note: z.string().trim().max(1000).default(''),
});
export type TransactionInput = z.infer<typeof transactionInput>;

export interface Transaction extends TransactionInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
  color: string;
  isSavings: boolean;
  sortOrder: number;
  archived: boolean;
  transactionCount: number;
}

export const transactionFilter = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  categoryId: z.coerce.number().int().optional(),
  uncategorized: z.enum(['1']).optional(),
  type: transactionType.optional(),
  minCents: z.coerce.number().int().nonnegative().optional(),
  maxCents: z.coerce.number().int().nonnegative().optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['date', 'amount', 'payee', 'category']).default('date'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});
export type TransactionFilter = z.infer<typeof transactionFilter>;

// ---- Kategorien -------------------------------------------------------------

export const categoryInput = z
  .object({
    name: z.string().trim().min(1, 'Name fehlt').max(50, 'Name ist zu lang'),
    type: transactionType,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Farbe muss wie #1a2b3c angegeben werden'),
    isSavings: z.boolean().default(false),
    archived: z.boolean().default(false),
  })
  .refine((c) => !c.isSavings || c.type === 'expense', {
    message: 'Nur Ausgabe-Kategorien können als „Sparen“ markiert werden',
    path: ['isSavings'],
  });
export type CategoryInput = z.infer<typeof categoryInput>;

// ---- Regeln -----------------------------------------------------------------

export const matchField = z.enum(['payee', 'note']);
export const matchType = z.enum(['contains', 'equals', 'starts_with']);
export type MatchField = z.infer<typeof matchField>;
export type MatchType = z.infer<typeof matchType>;

export const ruleInput = z.object({
  matchField: matchField.default('payee'),
  matchType: matchType.default('contains'),
  pattern: z.string().trim().min(1, 'Suchtext fehlt').max(200),
  categoryId: z.number().int().positive(),
  priority: z.number().int().min(-1000).max(1000).default(0),
  enabled: z.boolean().default(true),
});
export type RuleInput = z.infer<typeof ruleInput>;

export interface Rule extends RuleInput {
  id: number;
  categoryType: TransactionType;
}
