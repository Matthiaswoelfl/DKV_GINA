import type { Rule, TransactionType } from './schemas';

const norm = (s: string): string => s.trim().toLocaleLowerCase('de-DE');

const SPECIFICITY = { equals: 3, starts_with: 2, contains: 1 } as const;

export interface Categorizable {
  payee: string;
  note: string;
  type: TransactionType;
}

export function ruleMatches(rule: Pick<Rule, 'matchField' | 'matchType' | 'pattern'>, tx: Pick<Categorizable, 'payee' | 'note'>): boolean {
  const pattern = norm(rule.pattern);
  if (pattern === '') return false;
  const value = norm(rule.matchField === 'payee' ? tx.payee : tx.note);
  switch (rule.matchType) {
    case 'equals':
      return value === pattern;
    case 'starts_with':
      return value.startsWith(pattern);
    case 'contains':
      return value.includes(pattern);
  }
}

/**
 * Liefert die Kategorie-ID der besten passenden Regel oder null.
 * Vorrang: höhere Priorität, dann spezifischerer Vergleich (gleich > beginnt mit > enthält),
 * dann längerer Suchtext, dann ältere Regel. Regeln, deren Kategorie nicht zum Typ der
 * Buchung passt, und deaktivierte Regeln werden ignoriert.
 */
export function categorize(tx: Categorizable, rules: readonly Rule[]): number | null {
  const candidates = rules.filter((r) => r.enabled && r.categoryType === tx.type && ruleMatches(r, tx));
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      b.priority - a.priority ||
      SPECIFICITY[b.matchType] - SPECIFICITY[a.matchType] ||
      norm(b.pattern).length - norm(a.pattern).length ||
      a.id - b.id,
  );
  return candidates[0]?.categoryId ?? null;
}
