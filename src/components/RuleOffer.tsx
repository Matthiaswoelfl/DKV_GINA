import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { MatchType } from '../../shared/schemas';

export interface RuleOfferData {
  payee: string;
  categoryId: number;
  categoryName: string;
}

const MATCH_LABELS: Record<MatchType, string> = {
  contains: 'enthält',
  starts_with: 'beginnt mit',
  equals: 'ist genau',
};

/** Angebot nach manueller Kategorisierung: daraus eine Regel erstellen. */
export default function RuleOffer({ offer, onClose }: { offer: RuleOfferData; onClose: () => void }) {
  const qc = useQueryClient();
  const [pattern, setPattern] = useState(offer.payee);
  const [matchType, setMatchType] = useState<MatchType>('contains');
  const [applyExisting, setApplyExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      await api.createRule({ matchField: 'payee', matchType, pattern, categoryId: offer.categoryId, priority: 0, enabled: true });
      if (applyExisting) await api.applyRules();
    },
    onSuccess: async () => {
      await Promise.all(['rules', 'transactions', 'uncategorized'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Regel konnte nicht erstellt werden'),
  });

  return (
    <div role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm dark:border-indigo-900 dark:bg-indigo-950/50">
      <p className="mb-2 font-medium">Regel erstellen? Künftige Buchungen werden automatisch „{offer.categoryName}“ zugeordnet.</p>
      <div className="flex flex-wrap items-end gap-2">
        <span className="pb-1.5">Empfänger</span>
        <select aria-label="Vergleich" className="input !w-auto" value={matchType} onChange={(e) => setMatchType(e.target.value as MatchType)}>
          {Object.entries(MATCH_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input aria-label="Suchtext" className="input !w-56" value={pattern} onChange={(e) => setPattern(e.target.value)} />
        <span className="pb-1.5">→ {offer.categoryName}</span>
        <label className="flex items-center gap-1 pb-1.5">
          <input type="checkbox" checked={applyExisting} onChange={(e) => setApplyExisting(e.target.checked)} />
          auch auf vorhandene unkategorisierte Buchungen anwenden
        </label>
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary" onClick={onClose}>Nein danke</button>
          <button className="btn-primary" disabled={create.isPending || !pattern.trim()} onClick={() => create.mutate()}>Regel erstellen</button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    </div>
  );
}
