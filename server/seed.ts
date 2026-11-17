import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db';

// Optionale Beispieldaten zum Ausprobieren: npm run seed
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = openDb(process.env.DB_FILE ?? path.join(root, 'data', 'finanzen.db'));

const count = (db.prepare('SELECT COUNT(*) n FROM transactions').get() as { n: number }).n;
if (count > 0) {
  console.log(`Abbruch: Datenbank enthält bereits ${count} Buchungen.`);
  process.exit(1);
}

const cat = (name: string, type: string) =>
  (db.prepare('SELECT id FROM categories WHERE name=? AND type=?').get(name, type) as { id: number }).id;

const monthly: Array<[string, string, number, string | null, number]> = [
  // [Empfänger, Typ, Cent, Kategorie, Tag]
  ['Arbeitgeber GmbH', 'income', 320000, 'Gehalt', 1],
  ['Vermieter Müller', 'expense', 95000, 'Wohnen', 2],
  ['Netflix', 'expense', 1299, 'Abos', 5],
  ['Spotify', 'expense', 1099, 'Abos', 7],
  ['REWE', 'expense', 6420, 'Lebensmittel', 9],
  ['REWE', 'expense', 4815, 'Lebensmittel', 19],
  ['Aldi', 'expense', 3270, 'Lebensmittel', 14],
  ['Tankstelle Aral', 'expense', 7200, 'Mobilität', 12],
  ['Pizzeria Roma', 'expense', 3850, 'Restaurants', 16],
  ['Sparplan ETF', 'expense', 30000, 'Sparen', 3],
  ['Amazon', 'expense', 2990, null, 21],
];

const ins = db.prepare(
  'INSERT INTO transactions (date, amount_cents, type, category_id, payee) VALUES (?,?,?,?,?)',
);
const now = new Date();
db.transaction(() => {
  for (let back = 0; back < 6; back++) {
    const y = new Date(now.getFullYear(), now.getMonth() - back, 1);
    for (const [payee, type, cents, c, day] of monthly) {
      const date = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      ins.run(date, cents, type, c ? cat(c, type) : null, payee);
    }
  }
})();
console.log('Beispieldaten für 6 Monate angelegt.');
