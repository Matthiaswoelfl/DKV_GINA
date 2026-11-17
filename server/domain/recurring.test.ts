import { describe, expect, it } from 'vitest';
import type { AggCategory, AggTx } from './aggregate';
import { addMonths, detectRecurring } from './recurring';

const cats: AggCategory[] = [
  { id: 1, isSavings: false },
  { id: 2, isSavings: true },
];
const tx = (date: string, amountCents: number, payee: string, o: { type?: 'income' | 'expense'; categoryId?: number | null } = {}): AggTx => ({
  date,
  amountCents,
  payee,
  type: o.type ?? 'expense',
  categoryId: o.categoryId === undefined ? 1 : o.categoryId,
});
const monthly = (payee: string, cents: number, months: string[], day = '05') => months.map((m) => tx(`${m}-${day}`, cents, payee));
const TODAY = '2026-11-17';

describe('addMonths', () => {
  it('begrenzt auf das Monatsende', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-11-05', 3)).toBe('2027-02-05');
    expect(addMonths('2026-03-15', 12)).toBe('2027-03-15');
  });
});

describe('detectRecurring', () => {
  it('erkennt monatliche Zahlungen und berechnet die nächste Abbuchung', () => {
    const r = detectRecurring(monthly('Netflix', 1299, ['2026-08', '2026-09', '2026-10', '2026-11']), cats, TODAY);
    expect(r.payments).toHaveLength(1);
    expect(r.payments[0]).toMatchObject({
      payee: 'Netflix',
      interval: 'monthly',
      amountCents: 1299,
      monthlyCents: 1299,
      count: 4,
      lastDate: '2026-11-05',
      nextDate: '2026-12-05',
      active: true,
    });
    expect(r.monthlyTotalCents).toBe(1299);
  });

  it('toleriert leichte Betragsschwankungen und Schreibweisen', () => {
    const r = detectRecurring(
      [tx('2026-08-03', 4990, 'Stadtwerke'), tx('2026-09-02', 5120, 'STADTWERKE '), tx('2026-10-04', 5050, 'Stadtwerke'), tx('2026-11-03', 5300, 'Stadtwerke')],
      cats,
      TODAY,
    );
    expect(r.payments).toHaveLength(1);
    expect(r.payments[0]?.count).toBe(4);
  });

  it('erkennt Abo trotz Einmalkäufen beim selben Empfänger', () => {
    const r = detectRecurring(
      [...monthly('Amazon', 899, ['2026-08', '2026-09', '2026-10', '2026-11']), tx('2026-09-17', 12950, 'Amazon'), tx('2026-10-28', 3499, 'Amazon')],
      cats,
      TODAY,
    );
    expect(r.payments).toHaveLength(1);
    expect(r.payments[0]).toMatchObject({ amountCents: 899, count: 4 });
  });

  it('rechnet vierteljährliche und jährliche Zahlungen auf den Monat um', () => {
    const r = detectRecurring(
      [
        tx('2026-02-10', 30000, 'Haftpflicht Quartal'),
        tx('2026-05-10', 30000, 'Haftpflicht Quartal'),
        tx('2026-08-10', 30000, 'Haftpflicht Quartal'),
        tx('2025-10-01', 12000, 'KFZ-Versicherung'),
        tx('2026-10-01', 12000, 'KFZ-Versicherung'),
      ],
      cats,
      TODAY,
    );
    const byName = Object.fromEntries(r.payments.map((p) => [p.payee, p]));
    expect(byName['Haftpflicht Quartal']).toMatchObject({ interval: 'quarterly', monthlyCents: 10000, nextDate: '2026-11-10', active: true });
    expect(byName['KFZ-Versicherung']).toMatchObject({ interval: 'yearly', monthlyCents: 1000, nextDate: '2027-10-01' });
    expect(r.monthlyTotalCents).toBe(11000);
  });

  it('ignoriert unregelmäßige, zu seltene und zu häufige Buchungen', () => {
    const r = detectRecurring(
      [
        tx('2026-08-01', 2000, 'Zufall'),
        tx('2026-08-20', 2000, 'Zufall'),
        tx('2026-10-30', 2000, 'Zufall'),
        tx('2026-10-01', 5000, 'Einmal'),
        tx('2026-10-05', 5000, 'Einmal'),
        ...['01', '08', '15', '22', '29'].map((d) => tx(`2026-10-${d}`, 350, 'Kaffee')),
      ],
      cats,
      TODAY,
    );
    expect(r.payments).toEqual([]);
  });

  it('erlaubt einen ausgelassenen Monat', () => {
    const r = detectRecurring(monthly('Verein', 1500, ['2026-05', '2026-06', '2026-08', '2026-09', '2026-10', '2026-11']), cats, TODAY);
    expect(r.payments).toHaveLength(1);
  });

  it('markiert gekündigte Zahlungen als beendet und zählt sie nicht zur Summe', () => {
    const r = detectRecurring(
      [...monthly('Altes Abo', 999, ['2026-03', '2026-04', '2026-05', '2026-06']), ...monthly('Aktiv', 500, ['2026-09', '2026-10', '2026-11'])],
      cats,
      TODAY,
    );
    const old = r.payments.find((p) => p.payee === 'Altes Abo');
    expect(old).toMatchObject({ active: false, nextDate: null });
    expect(r.payments[0]?.payee).toBe('Aktiv'); // aktive zuerst
    expect(r.monthlyTotalCents).toBe(500);
  });

  it('ignoriert Einnahmen und Sparen-Kategorien', () => {
    const months = ['2026-08', '2026-09', '2026-10', '2026-11'];
    const r = detectRecurring(
      [
        ...months.map((m) => tx(`${m}-01`, 300000, 'Arbeitgeber', { type: 'income' })),
        ...months.map((m) => tx(`${m}-03`, 30000, 'Sparplan', { categoryId: 2 })),
      ],
      cats,
      TODAY,
    );
    expect(r.payments).toEqual([]);
  });

  it('leere Eingabe', () => {
    expect(detectRecurring([], cats, TODAY)).toEqual({ payments: [], monthlyTotalCents: 0 });
  });
});
