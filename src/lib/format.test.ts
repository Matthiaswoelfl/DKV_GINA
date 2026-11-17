import { describe, expect, it } from 'vitest';
import { centsToInput, formatDate, formatEuro, toIso } from './format';

describe('format', () => {
  it('formatiert Euro', () => {
    expect(formatEuro(123456)).toBe('1.234,56 €');
    expect(formatEuro(5)).toBe('0,05 €');
    expect(formatEuro(-1050)).toBe('-10,50 €');
  });
  it('formatiert Datum', () => {
    expect(formatDate('2026-11-03')).toBe('03.11.2026');
  });
  it('toIso nutzt lokale Zeit', () => {
    expect(toIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('centsToInput', () => {
    expect(centsToInput(1250)).toBe('12,50');
  });
});
