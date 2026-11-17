import { describe, expect, it } from 'vitest';
import { parseAmountToCents } from './money';

describe('parseAmountToCents', () => {
  it.each([
    ['12,50', 1250],
    ['12.50', 1250],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1234', 123400],
    ['0,05', 5],
    ['12,5', 1250],
    ['1.234', 123400],
    ['12 €', 1200],
  ])('%s -> %i', (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1,2,3', '12,345', '1..2'])('lehnt "%s" ab', (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });
});
