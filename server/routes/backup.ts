import { Router } from 'express';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from '../db';
import { BACKUP_VERSION, backupSchema, checkBackupIntegrity, type Backup } from '../../shared/backup';
import { centsToCsv, dateToCsv, text, toCsv } from '../csv';

interface CatRow { id: number; name: string; type: 'income' | 'expense'; color: string; is_savings: number; sort_order: number; archived: number }
interface TxRow { id: number; date: string; amount_cents: number; type: 'income' | 'expense'; category_id: number | null; payee: string; note: string; created_at: string; updated_at: string }
interface RuleRow { id: number; match_field: 'payee' | 'note'; match_type: 'contains' | 'equals' | 'starts_with'; pattern: string; category_id: number; priority: number; enabled: number }

export function buildBackup(db: Db): Backup {
  return {
    app: 'finanz-dashboard',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories: (db.prepare('SELECT * FROM categories ORDER BY id').all() as CatRow[]).map((c) => ({
      id: c.id, name: c.name, type: c.type, color: c.color, isSavings: c.is_savings === 1, sortOrder: c.sort_order, archived: c.archived === 1,
    })),
    transactions: (db.prepare('SELECT * FROM transactions ORDER BY id').all() as TxRow[]).map((t) => ({
      id: t.id, date: t.date, amountCents: t.amount_cents, type: t.type, categoryId: t.category_id, payee: t.payee, note: t.note, createdAt: t.created_at, updatedAt: t.updated_at,
    })),
    rules: (db.prepare('SELECT * FROM rules ORDER BY id').all() as RuleRow[]).map((r) => ({
      id: r.id, matchField: r.match_field, matchType: r.match_type, pattern: r.pattern, categoryId: r.category_id, priority: r.priority, enabled: r.enabled === 1,
    })),
    budgets: db.prepare('SELECT category_id AS categoryId, monthly_cents AS monthlyCents FROM budgets ORDER BY category_id').all() as Backup['budgets'],
  };
}

/** Ersetzt den gesamten Datenbestand atomar durch das Backup. */
export function restoreBackup(db: Db, b: Backup): void {
  db.transaction(() => {
    db.exec('DELETE FROM budgets; DELETE FROM rules; DELETE FROM transactions; DELETE FROM categories;');
    const insCat = db.prepare('INSERT INTO categories (id, name, type, color, is_savings, sort_order, archived) VALUES (?,?,?,?,?,?,?)');
    for (const c of b.categories) insCat.run(c.id, c.name, c.type, c.color, c.isSavings ? 1 : 0, c.sortOrder, c.archived ? 1 : 0);
    const insTx = db.prepare('INSERT INTO transactions (id, date, amount_cents, type, category_id, payee, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
    for (const t of b.transactions) insTx.run(t.id, t.date, t.amountCents, t.type, t.categoryId, t.payee, t.note, t.createdAt, t.updatedAt);
    const insRule = db.prepare('INSERT INTO rules (id, match_field, match_type, pattern, category_id, priority, enabled) VALUES (?,?,?,?,?,?,?)');
    for (const r of b.rules) insRule.run(r.id, r.matchField, r.matchType, r.pattern, r.categoryId, r.priority, r.enabled ? 1 : 0);
    const insBudget = db.prepare('INSERT INTO budgets (category_id, monthly_cents) VALUES (?,?)');
    for (const bu of b.budgets) insBudget.run(bu.categoryId, bu.monthlyCents);
  })();
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

export function backupRouter(db: Db, opts: { backupDir?: string }): Router {
  const r = Router();

  r.get('/export/json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="finanz-backup-${stamp()}.json"`);
    res.send(JSON.stringify(buildBackup(db), null, 2));
  });

  r.get('/export/csv', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT t.date, t.type, t.amount_cents AS cents, COALESCE(c.name, '') AS category, t.payee, t.note
         FROM transactions t LEFT JOIN categories c ON c.id = t.category_id ORDER BY t.date, t.id`,
      )
      .all() as Array<{ date: string; type: string; cents: number; category: string; payee: string; note: string }>;
    const csv = toCsv([
      ['Datum', 'Typ', 'Betrag', 'Kategorie', 'Empfänger', 'Notiz'],
      ...rows.map((t) => [
        dateToCsv(t.date),
        t.type === 'income' ? 'Einnahme' : 'Ausgabe',
        centsToCsv(t.type === 'income' ? t.cents : -t.cents),
        text(t.category),
        text(t.payee),
        text(t.note),
      ]),
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="finanz-buchungen-${stamp()}.csv"`);
    res.send(csv);
  });

  /**
   * Wiederherstellung. Mit ?dryRun=1 wird nur geprüft und eine Zusammenfassung geliefert.
   * Vor dem Ersetzen wird der aktuelle Bestand als JSON-Datei gesichert (falls ein Backup-Ordner konfiguriert ist).
   */
  r.post('/import/json', express.json({ limit: '100mb' }), (req, res) => {
    const parsed = backupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Das ist keine gültige Backup-Datei dieser App.' });
      return;
    }
    const problem = checkBackupIntegrity(parsed.data);
    if (problem) {
      res.status(400).json({ error: `Backup ist inkonsistent: ${problem}` });
      return;
    }
    const b = parsed.data;
    const summary = {
      categories: b.categories.length,
      transactions: b.transactions.length,
      rules: b.rules.length,
      budgets: b.budgets.length,
      exportedAt: b.exportedAt,
    };
    if (req.query.dryRun === '1') {
      res.json({ ...summary, dryRun: true });
      return;
    }
    let safetyBackup: string | null = null;
    if (opts.backupDir) {
      fs.mkdirSync(opts.backupDir, { recursive: true });
      safetyBackup = path.join(opts.backupDir, `vor-wiederherstellung-${stamp()}.json`);
      fs.writeFileSync(safetyBackup, JSON.stringify(buildBackup(db), null, 2));
    }
    restoreBackup(db, b);
    res.json({ ...summary, safetyBackup: safetyBackup ? path.basename(safetyBackup) : null });
  });

  return r;
}
