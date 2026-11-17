const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/** 123456 -> "1.234,56 €" */
export function formatEuro(cents: number): string {
  return euro.format(cents / 100).replace(/\u00a0/g, ' ');
}

/** "2026-11-03" -> "03.11.2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** Lokales Datum (nicht UTC!) als "JJJJ-MM-TT". */
export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const todayIso = (): string => toIso(new Date());

/** Betrag in Cent -> Eingabestring "12,50" */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
