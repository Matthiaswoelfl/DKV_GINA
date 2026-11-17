import { useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { downloadText, fileStamp } from '../lib/download';
import { STANDALONE } from '../lib/env';
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

  async function download(kind: 'json' | 'csv') {
    setError(null);
    try {
      if (kind === 'json') downloadText(`finanz-backup-${fileStamp()}.json`, 'application/json', await api.exportJson());
      else downloadText(`finanz-buchungen-${fileStamp()}.csv`, 'text/csv', await api.exportCsv());
    } catch (e) {
      fail(e);
    }
  }

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
      setDone(`Wiederhergestellt: ${r.transactions} Buchungen, ${r.categories} Kategorien, ${r.rules} Regeln, ${r.budgets} Budgets.${r.safetyBackup ? ` Der vorherige Stand wurde als ${r.safetyBackup} gesichert (${STANDALONE ? 'Download-Ordner' : 'Ordner data/backups'}).` : ''}`);
      await qc.invalidateQueries();
    },
    onError: (e) => { setPending(null); fail(e); },
  });

  return (
    <div className="space-y-5">
      {STANDALONE && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" aria-label="Hinweis zum Speicher">
          <h2 className="font-semibold">So werden deine Daten gespeichert</h2>
          <p className="mt-1">
            Diese Einzeldatei speichert alles im Speicher deines Browsers, nur auf diesem Gerät und nur in diesem Browser-Profil. Wenn du den Website-Speicher löschst, ein anderes Profil oder eine andere Datei-Adresse nutzt, sind die Daten dort nicht sichtbar. Lade deshalb regelmäßig ein JSON-Backup herunter und bewahre es sicher auf.
          </p>
        </section>
      )}

      <section className={card} aria-label="Export">
        <h2 className="text-sm font-semibold">Export und Backup</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Das JSON-Backup enthält alles (Buchungen, Kategorien, Regeln, Budgets) und kann hier wiederhergestellt werden. Die CSV-Datei enthält nur die Buchungen für Excel (Semikolon, UTF-8).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => void download('json')}>JSON-Backup herunterladen</button>
          <button className="btn-secondary" onClick={() => void download('csv')}>Buchungen als CSV</button>
        </div>
      </section>

      <section className={card} aria-label="Wiederherstellung">
        <h2 className="text-sm font-semibold">Aus JSON-Backup wiederherstellen</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Ersetzt alle aktuellen Daten durch den Inhalt des Backups. Vorher legt die App automatisch eine Sicherung des jetzigen Stands ab ({STANDALONE ? 'als Download' : <>in <code>data/backups</code></>}).
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
