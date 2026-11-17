import { describe, expect, it } from 'vitest';
import { categorize, ruleMatches } from './categorize';
import type { Rule } from './schemas';

let nextId = 1;
const rule = (o: Partial<Rule> & Pick<Rule, 'pattern' | 'categoryId'>): Rule => ({
  id: nextId++,
  matchField: 'payee',
  matchType: 'contains',
  priority: 0,
  enabled: true,
  categoryType: 'expense',
  ...o,
});
const tx = (payee: string, o: { note?: string; type?: 'income' | 'expense' } = {}) => ({
  payee,
  note: o.note ?? '',
  type: o.type ?? 'expense',
});

describe('ruleMatches', () => {
  it('ignoriert Groß-/Kleinschreibung (auch Umlaute)', () => {
    expect(ruleMatches({ matchField: 'payee', matchType: 'contains', pattern: 'rewe' }, tx('REWE Markt'))).toBe(true);
    expect(ruleMatches({ matchField: 'payee', matchType: 'contains', pattern: 'BÄCKER' }, tx('Bäckerei'))).toBe(true);
  });
  it('unterscheidet equals / starts_with / contains', () => {
    const t = tx('REWE Markt');
    expect(ruleMatches({ matchField: 'payee', matchType: 'equals', pattern: 'rewe' }, t)).toBe(false);
    expect(ruleMatches({ matchField: 'payee', matchType: 'equals', pattern: 'rewe markt' }, t)).toBe(true);
    expect(ruleMatches({ matchField: 'payee', matchType: 'starts_with', pattern: 'rewe' }, t)).toBe(true);
    expect(ruleMatches({ matchField: 'payee', matchType: 'starts_with', pattern: 'markt' }, t)).toBe(false);
    expect(ruleMatches({ matchField: 'payee', matchType: 'contains', pattern: 'markt' }, t)).toBe(true);
  });
  it('prüft das gewählte Feld', () => {
    const t = tx('Amazon', { note: 'Buch für Mama' });
    expect(ruleMatches({ matchField: 'note', matchType: 'contains', pattern: 'buch' }, t)).toBe(true);
    expect(ruleMatches({ matchField: 'payee', matchType: 'contains', pattern: 'buch' }, t)).toBe(false);
  });
  it('leerer Suchtext trifft nie', () => {
    expect(ruleMatches({ matchField: 'payee', matchType: 'contains', pattern: '  ' }, tx('x'))).toBe(false);
  });
});

describe('categorize', () => {
  it('gibt null ohne passende Regel zurück', () => {
    expect(categorize(tx('Unbekannt'), [rule({ pattern: 'rewe', categoryId: 1 })])).toBeNull();
    expect(categorize(tx('REWE'), [])).toBeNull();
  });
  it('höhere Priorität gewinnt', () => {
    const rules = [rule({ pattern: 'amazon', categoryId: 1 }), rule({ pattern: 'amazon', categoryId: 2, priority: 5 })];
    expect(categorize(tx('Amazon'), rules)).toBe(2);
  });
  it('bei gleicher Priorität gewinnt der spezifischere Vergleich', () => {
    const rules = [
      rule({ pattern: 'amazon prime', categoryId: 1 }),
      rule({ pattern: 'amazon prime', matchType: 'equals', categoryId: 2 }),
    ];
    expect(categorize(tx('Amazon Prime'), rules)).toBe(2);
  });
  it('bei gleichem Vergleich gewinnt der längere Suchtext', () => {
    const rules = [rule({ pattern: 'amazon', categoryId: 1 }), rule({ pattern: 'amazon prime', categoryId: 2 })];
    expect(categorize(tx('Amazon Prime Video'), rules)).toBe(2);
  });
  it('bei Gleichstand gewinnt die ältere Regel', () => {
    const rules = [rule({ pattern: 'shop', categoryId: 1 }), rule({ pattern: 'shop', categoryId: 2 })];
    expect(categorize(tx('Shop'), rules)).toBe(1);
  });
  it('ignoriert deaktivierte Regeln', () => {
    expect(categorize(tx('REWE'), [rule({ pattern: 'rewe', categoryId: 1, enabled: false })])).toBeNull();
  });
  it('ignoriert Regeln mit Kategorie des falschen Typs', () => {
    const r = rule({ pattern: 'firma', categoryId: 9, categoryType: 'income' });
    expect(categorize(tx('Firma', { type: 'expense' }), [r])).toBeNull();
    expect(categorize(tx('Firma', { type: 'income' }), [r])).toBe(9);
  });
});
