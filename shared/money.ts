/**
 * Parst eine Betragseingabe ("12,50", "12.50", "1.234,56", "1234") in Cent.
 * Gibt null zurück bei ungültiger Eingabe. Negative Werte sind nicht erlaubt.
 */
export function parseAmountToCents(input: string): number | null {
  let s = input.trim().replace(/\s|€/g, '');
  if (s === '') return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // Das spätere Zeichen ist das Dezimaltrennzeichen, das andere Tausendertrenner.
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    s = s.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (lastComma !== -1) {
    if (s.split(',').length > 2) return null;
    s = s.replace(',', '.');
  } else if (lastDot !== -1) {
    const parts = s.split('.');
    const last = parts[parts.length - 1] ?? '';
    // "1.234" (Gruppen mit 3 Ziffern, mehrere Punkte oder 3 Nachkommastellen) = Tausender
    const grouped = parts.slice(1).every((p) => p.length === 3);
    if (parts.length > 2 && !grouped) return null;
    if (grouped && (parts.length > 2 || last.length === 3)) s = parts.join('');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [intPart = '0', frac = ''] = s.split('.');
  const cents = Number(intPart) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
