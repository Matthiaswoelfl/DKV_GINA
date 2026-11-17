/** Schützt vor Formel-Injektion in Excel & Co.: Textzellen, die mit = + - @ beginnen, bekommen ein Hochkomma. */
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const text = (v: string): string => cell(safeText(v));

/** Cent als deutsche Dezimalzahl ohne Tausenderpunkt: -123456 -> "-1234,56" */
export function centsToCsv(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

export const dateToCsv = (iso: string): string => iso.split('-').reverse().join('.');

const BOM = String.fromCharCode(0xfeff);

/** Semikolon-getrennt mit BOM, damit deutsches Excel Umlaute und Spalten richtig öffnet. */
export function toCsv(rows: string[][]): string {
  return `${BOM}${rows.map((r) => r.join(';')).join('\r\n')}\r\n`;
}
