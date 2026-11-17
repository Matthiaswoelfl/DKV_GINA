import { useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate } from '../lib/format';

const card = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60';

interface Pending {
  json: unknown;
  fileName: string;
  transactions: number;
  categories: number;
  rules: number;
  budgets: number;
  exportedAt: string;
}

export default function Data() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Aktion fehlgeschlagen');

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setError(null);
    setDone(null);
    if (!file) return;
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      return setError('Die Datei ist kein gültiges JSON.');
    }
    try {
      const s = await api.importBackup(json, true);
      setPending({ json, fileName: file.name, ...s });
    } catch (err) {
      fail(err);
    }
  }

  const restore = useMutation({
    mutationFn: (json: unknown) => api.importBackup(json, false),
    onSuccess: async (r) => {
      setPending(null);
      setDone(`Wiederhergestellt: ${r.transactions} Buchungen, ${r.categories} Kategorien, ${r.rules} Regeln, ${r.budgets} Budgets.${r.safetyBackup ? ` Der vorherige Stand liegt als ${r.safetyBackup} im Ordner data/backups.` : ''}`);
      await qc.invalidateQueries();
    },
    onError: (e) => { setPending(null); fail(e); },
  });

  return (
    <div className="space-y-5">
      <section className={card} aria-label="Export">
        <h2 className="text-sm font-semibold">Export und Backup</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Das JSON-Backup enthält alles (Buchungen, Kategorien, Regeln, Budgets) und kann hier wiederhergestellt werden. Die CSV-Datei enthält nur die Buchungen für Excel (Semikolon, UTF-8).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn-primary" href="/api/export/json" download>JSON-Backup herunterladen</a>
          <a className="btn-secondary" href="/api/export/csv" download>Buchungen als CSV</a>
        </div>
      </section>

      <section className={card} aria-label="Wiederherstellung">
        <h2 className="text-sm font-semibold">Aus JSON-Backup wiederherstellen</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Ersetzt alle aktuellen Daten durch den Inhalt des Backups. Vorher legt die App automatisch eine Sicherung des jetzigen Stands in <code>data/backups</code> ab.
        </p>
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Backup-Datei wählen" onChange={onFile} />
        <button className="btn-secondary mt-3" onClick={() => fileRef.current?.click()}>Backup-Datei wählen …</button>
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        {done && <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-400">{done}</p>}
      </section>

      {pending && (
        <ConfirmDialog
          title="Daten ersetzen?"
          message={`„${pending.fileName}“ (erstellt am ${formatDate(pending.exportedAt.slice(0, 10))}) enthält ${pending.transactions} Buchungen, ${pending.categories} Kategorien, ${pending.rules} Regeln und ${pending.budgets} Budgets. Alle aktuellen Daten werden dadurch ersetzt.`}
          confirmLabel="Ersetzen"
          onConfirm={() => restore.mutate(pending.json)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
