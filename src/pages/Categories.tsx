import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { Category, TransactionType } from '../../shared/schemas';

const card = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60';

function CategoryForm({ initial, type, onSaved, onCancel }: { initial?: Category; type: TransactionType; onSaved: () => void; onCancel?: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#6366f1');
  const [isSavings, setIsSavings] = useState(initial?.isSavings ?? false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const input = { name, type, color, isSavings, archived: initial?.archived ?? false };
      return initial ? api.updateCategory(initial.id, input) : api.createCategory(input);
    },
    onSuccess: async () => {
      await Promise.all(['categories', 'transactions', 'rules'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      if (!initial) setName('');
      setError(null);
      onSaved();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen'),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Bitte einen Namen angeben.');
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input type="color" aria-label="Farbe" className="h-8 w-10 cursor-pointer rounded border border-slate-300 dark:border-slate-600" value={color} onChange={(e) => setColor(e.target.value)} />
      <input aria-label="Name" className="input !w-48" placeholder="Neue Kategorie" value={name} onChange={(e) => setName(e.target.value)} />
      {type === 'expense' && (
        <label className="flex items-center gap-1 pb-1.5 text-sm">
          <input type="checkbox" checked={isSavings} onChange={(e) => setIsSavings(e.target.checked)} /> ist Sparen
        </label>
      )}
      <button className="btn-primary" disabled={save.isPending}>{initial ? 'Speichern' : 'Hinzufügen'}</button>
      {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Abbrechen</button>}
      {error && <p role="alert" className="basis-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

function DeleteDialog({ category, all, onClose }: { category: Category; all: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const targets = all.filter((c) => c.type === category.type && c.id !== category.id && !c.archived);
  const [target, setTarget] = useState<string>('none');
  const [error, setError] = useState<string | null>(null);
  const del = useMutation({
    mutationFn: () => api.deleteCategory(category.id, category.transactionCount > 0 ? (target === 'none' ? 'none' : Number(target)) : undefined),
    onSuccess: async () => {
      await Promise.all(['categories', 'transactions', 'rules', 'uncategorized'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Löschen fehlgeschlagen'),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="alertdialog" aria-modal="true" aria-label="Kategorie löschen" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800">
        <h2 className="text-lg font-semibold">Kategorie „{category.name}“ löschen?</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Zugehörige Regeln und Budgets werden ebenfalls gelöscht.</p>
        {category.transactionCount > 0 && (
          <div className="mt-3">
            <label className="label" htmlFor="reassign">{category.transactionCount} Buchungen verschieben nach</label>
            <select id="reassign" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="none">— unkategorisiert —</option>
              {targets.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Abbrechen</button>
          <button className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700" onClick={() => del.mutate()}>Löschen</button>
        </div>
      </div>
    </div>
  );
}

export default function Categories() {
  const qc = useQueryClient();
  const { data = [], isError } = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);

  const archive = useMutation({
    mutationFn: (c: Category) => api.updateCategory(c.id, { name: c.name, type: c.type, color: c.color, isSavings: c.isSavings, archived: !c.archived }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Aktion fehlgeschlagen'),
  });

  if (isError) return <p role="alert" className="text-red-600">Kategorien konnten nicht geladen werden.</p>;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {error && <p role="alert" className="text-sm text-red-600 md:col-span-2">{error}</p>}
      {(['expense', 'income'] as const).map((type) => (
        <section key={type} className={card} aria-label={type === 'expense' ? 'Ausgaben-Kategorien' : 'Einnahmen-Kategorien'}>
          <h2 className="mb-3 font-semibold">{type === 'expense' ? 'Ausgaben' : 'Einnahmen'}</h2>
          <ul className="mb-4 divide-y divide-slate-100 dark:divide-slate-700/50">
            {data.filter((c) => c.type === type).map((c) => (
              <li key={c.id} className="py-2">
                {editingId === c.id ? (
                  <CategoryForm initial={c} type={type} onSaved={() => setEditingId(null)} onCancel={() => setEditingId(null)} />
                ) : (
                  <div className={`flex items-center gap-2 text-sm ${c.archived ? 'opacity-50' : ''}`}>
                    <span className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                    <span className="font-medium">{c.name}</span>
                    {c.isSavings && <span className="rounded bg-lime-100 px-1.5 text-xs text-lime-800">Sparen</span>}
                    {c.archived && <span className="rounded bg-slate-200 px-1.5 text-xs text-slate-700">archiviert</span>}
                    <span className="ml-auto text-xs text-slate-500">{c.transactionCount} Buchungen</span>
                    <button className="px-1 text-indigo-600 hover:underline" onClick={() => setEditingId(c.id)}>Bearbeiten</button>
                    <button className="px-1 text-slate-600 hover:underline dark:text-slate-300" onClick={() => archive.mutate(c)}>{c.archived ? 'Aktivieren' : 'Archivieren'}</button>
                    <button className="px-1 text-red-600 hover:underline" onClick={() => setDeleting(c)}>Löschen</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <CategoryForm type={type} onSaved={() => undefined} />
        </section>
      ))}
      {deleting && <DeleteDialog category={deleting} all={data} onClose={() => setDeleting(null)} />}
    </div>
  );
}
