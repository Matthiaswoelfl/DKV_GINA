import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type Db = Database.Database;

interface Migration {
  version: number;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income','expense')),
        color TEXT NOT NULL,
        is_savings INTEGER NOT NULL DEFAULT 0 CHECK (is_savings IN (0,1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
        UNIQUE (name, type)
      );
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
        type TEXT NOT NULL CHECK (type IN ('income','expense')),
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        payee TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_tx_date ON transactions(date);
      CREATE INDEX idx_tx_category ON transactions(category_id);
      CREATE INDEX idx_tx_payee ON transactions(payee);
      CREATE TABLE rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_field TEXT NOT NULL CHECK (match_field IN ('payee','note')),
        match_type TEXT NOT NULL CHECK (match_type IN ('contains','equals','starts_with')),
        pattern TEXT NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        priority INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
        monthly_cents INTEGER NOT NULL CHECK (monthly_cents > 0)
      );
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `,
  },
];

const DEFAULT_CATEGORIES: Array<[string, 'income' | 'expense', string, number]> = [
  ['Wohnen', 'expense', '#2a78d6', 0],
  ['Lebensmittel', 'expense', '#1baf7a', 0],
  ['Mobilität', 'expense', '#eb6834', 0],
  ['Versicherungen', 'expense', '#6250d6', 0],
  ['Abos', 'expense', '#e87ba4', 0],
  ['Freizeit', 'expense', '#eda100', 0],
  ['Restaurants', 'expense', '#e34948', 0],
  ['Gesundheit', 'expense', '#008300', 0],
  ['Sparen', 'expense', '#9aa83c', 1],
  ['Sonstiges', 'expense', '#8b8a85', 0],
  ['Gehalt', 'income', '#2a78d6', 0],
  ['Nebeneinkünfte', 'income', '#1baf7a', 0],
  ['Sonstiges', 'income', '#8b8a85', 0],
];

export function migrate(db: Db): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (const m of MIGRATIONS.filter((x) => x.version > current)) {
    db.transaction(() => {
      db.exec(m.sql);
      if (m.version === 1) {
        const ins = db.prepare(
          'INSERT INTO categories (name, type, color, is_savings, sort_order) VALUES (?,?,?,?,?)',
        );
        DEFAULT_CATEGORIES.forEach(([n, t, c, s], i) => ins.run(n, t, c, s, i));
      }
      db.pragma(`user_version = ${m.version}`);
    })();
  }
}

export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}
