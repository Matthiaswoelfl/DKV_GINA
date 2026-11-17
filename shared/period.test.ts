import { describe, expect, it } from 'vitest';
import { lastDayOfMonth, monthsEndingAt, periodContaining, periodLabel, previousPeriod, shiftPeriod } from './period';

describe('periodContaining', () => {
  it('Monat inkl. Schaltjahr', () => {
    expect(periodContaining('month', '2024-02-10')).toEqual({ kind: 'month', from: '2024-02-01', to: '2024-02-29' });
    expect(periodContaining('month', '2026-11-17')).toEqual({ kind: 'month', from: '2026-11-01', to: '2026-11-30' });
  });
  it('Quartal', () => {
    expect(periodContaining('quarter', '2026-11-17')).toMatchObject({ from: '2026-10-01', to: '2026-12-31' });
    expect(periodContaining('quarter', '2026-03-31')).toMatchObject({ from: '2026-01-01', to: '2026-03-31' });
  });
  it('Jahr', () => {
    expect(periodContaining('year', '2026-06-01')).toMatchObject({ from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('shiftPeriod', () => {
  it('Monat über Jahresgrenze', () => {
    const jan = periodContaining('month', '2026-01-15');
    expect(previousPeriod(jan)).toMatchObject({ from: '2025-12-01', to: '2025-12-31' });
    expect(shiftPeriod(periodContaining('month', '2026-12-01'), 1)).toMatchObject({ from: '2027-01-01', to: '2027-01-31' });
  });
  it('Quartal und Jahr', () => {
    expect(previousPeriod(periodContaining('quarter', '2026-02-01'))).toMatchObject({ from: '2025-10-01', to: '2025-12-31' });
    expect(shiftPeriod(periodContaining('year', '2026-02-01'), 1)).toMatchObject({ from: '2027-01-01', to: '2027-12-31' });
  });
  it('benutzerdefiniert rückt um die eigene Länge', () => {
    const p = { kind: 'custom' as const, from: '2026-03-10', to: '2026-03-19' };
    expect(previousPeriod(p)).toEqual({ kind: 'custom', from: '2026-02-28', to: '2026-03-09' });
    expect(shiftPeriod(p, 1)).toEqual({ kind: 'custom', from: '2026-03-20', to: '2026-03-29' });
  });
});

describe('Labels & Monate', () => {
  it('Beschriftung', () => {
    expect(periodLabel(periodContaining('month', '2026-11-17'))).toBe('November 2026');
    expect(periodLabel(periodContaining('quarter', '2026-11-17'))).toBe('Q4 2026');
    expect(periodLabel(periodContaining('year', '2026-11-17'))).toBe('2026');
    expect(periodLabel({ kind: 'custom', from: '2026-03-10', to: '2026-03-19' })).toBe('10.03.2026 – 19.03.2026');
  });
  it('monthsEndingAt', () => {
    expect(monthsEndingAt('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthsEndingAt('2026-02', 1)).toEqual(['2026-02']);
  });
  it('lastDayOfMonth', () => {
    expect(lastDayOfMonth('2024-02')).toBe('2024-02-29');
  });
});
