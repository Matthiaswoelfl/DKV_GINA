import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { MatchField, MatchType, Rule } from '../../shared/schemas';
import ConfirmDialog from '../components/ConfirmDialog';

const card = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60';
const FIELD: Record<MatchField, string> = { payee: 'Empfänger', note: 'Notiz' };
const TYPE: Record<MatchType, string> = { contains: 'enthält', starts_with: 'beginnt mit', equals: 'ist genau' };

export default function Rules() {
  const qc = useQueryClient();
  const rules = useQuery({ queryKey: ['rules'], queryFn: api.rules });
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const cats = categories.data ?? [];

  const [matchField, setMatchField] = useState<MatchField>('payee');
  const [matchType, setMatchType] = useState<MatchType>('contains');
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);

  const refresh = () => Promise.all(['rules', 'transactions', 'uncategorized'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const onError = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Aktion fehlgeschlagen');

  const create = useMutation({
    mutationFn: () => api.createRule({ matchField, matchType, pattern, categoryId: Number(categoryId), priority: Number(priority) || 0, enabled: true }),
    onSuccess: async () => { setPattern(''); setError(null); await refresh(); },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (r: Rule) => api.updateRule(r.id, { ...r, enabled: !r.enabled }),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteRule(id),
    onSuccess: async () => { setDeleting(null); await refresh(); },
    onError: (e) => { setDeleting(null); onError(e); },
  });
  const apply = useMutation({
    mutationFn: api.applyRules,
    onSuccess: async (r) => {
      setError(null);
      setInfo(r.updated === 0 ? 'Keine unkategorisierte Buchung passte zu einer Regel.' : `${r.updated} Buchungen kategorisiert.`);
      await refresh();
    },
    onError,
  });

  const catName = (id: number) => cats.find((c) => c.id === id);
  const eligible = cats.filter((c) => !c.archived);

  function submit(e: FormEvent) {
    e.preventDefault();
    setInfo(null);
    if (!pattern.trim()) return setError('Bitte einen Suchtext angeben.');
    if (!categoryId) return setError('Bitte eine Kategorie wählen.');
    create.mutate();
  }

  return (
    <div className="space-y-5">
      <section className={card} aria-label="Neue Regel">
        <h2 className="mb-3 text-sm font-semibold">Neue Regel</h2>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <select aria-label="Feld" className="input !w-auto" value={matchField} onChange={(e) => setMatchField(e.target.value as MatchField)}>
            {Object.entries(FIELD).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select aria-label="Vergleich" className="input !w-auto" value={matchType} onChange={(e) => setMatchType(e.target.value as MatchType)}>
            {Object.entries(TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input aria-label="Suchtext" className="input !w-56" placeholder="z. B. REWE" value={pattern} onChange={(e) => setPattern(e.target.value)} />
          <span className="pb-1.5 text-sm">→</span>
          <select aria-label="Kategorie" className="input !w-auto" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Kategorie wählen …</option>
            {(['expense', 'income'] as const).map((t) => (
              <optgroup key={t} label={t === 'expense' ? 'Ausgaben' : 'Einnahmen'}>
                {eligible.filter((c) => c.type === t).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
          <div>
            <label className="label" htmlFor="prio">Priorität</label>
            <input id="prio" className="input !w-20" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={create.isPending}>Regel hinzufügen</button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Bei mehreren Treffern gewinnt die höhere Priorität, dann der genauere Vergleich, dann der längere Suchtext.</p>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      <section className={`${card} overflow-x-auto`} aria-label="Regeln">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Regeln ({rules.data?.length ?? 0})</h2>
          <button className="btn-secondary" onClick={() => apply.mutate()} disabled={apply.isPending}>Auf unkategorisierte Buchungen anwenden</button>
        </div>
        {info && <p role="status" className="mb-2 text-sm text-green-700 dark:text-green-400">{info}</p>}
        {rules.isError ? (
          <p role="alert" className="text-sm text-red-600">Regeln konnten nicht geladen werden.</p>
        ) : (rules.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Noch keine Regeln. Lege oben eine an oder kategorisiere eine Buchung manuell, dann wird dir eine Regel angeboten.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700">
                <th className="py-2">Aktiv</th><th>Bedingung</th><th>Kategorie</th><th className="text-right">Priorität</th><th className="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {(rules.data ?? []).map((r) => {
                const c = catName(r.categoryId);
                return (
                  <tr key={r.id} className={`border-b border-slate-100 last:border-0 dark:border-slate-700/50 ${r.enabled ? '' : 'opacity-50'}`}>
                    <td className="py-2"><input type="checkbox" aria-label={`Regel ${r.pattern} aktiv`} checked={r.enabled} onChange={() => toggle.mutate(r)} /></td>
                    <td>{FIELD[r.matchField]} {TYPE[r.matchType]} <strong>„{r.pattern}“</strong></td>
                    <td>
                      <span className="mr-1.5 inline-block h-3 w-3 rounded-full align-middle" style={{ backgroundColor: c?.color }} aria-hidden />
                      {c?.name} <span className="text-xs text-slate-500">({r.categoryType === 'income' ? 'Einnahme' : 'Ausgabe'})</span>
                    </td>
                    <td className="text-right tabular-nums">{r.priority}</td>
                    <td className="text-right"><button className="px-2 text-red-600 hover:underline" onClick={() => setDeleting(r)}>Löschen</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      {deleting && (
        <ConfirmDialog title="Regel löschen?" message={`Die Regel „${FIELD[deleting.matchField]} ${TYPE[deleting.matchType]} ${deleting.pattern}“ wird gelöscht. Bereits kategorisierte Buchungen bleiben unverändert.`} onConfirm={() => remove.mutate(deleting.id)} onCancel={() => setDeleting(null)} />
      )}
    </div>
  );
}
