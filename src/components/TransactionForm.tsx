import { useId, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { parseAmountToCents } from '../../shared/money';
import type { Category, Transaction, TransactionType } from '../../shared/schemas';
import { centsToInput, todayIso } from '../lib/format';

interface Props {
  categories: Category[];
  /** Zum Bearbeiten übergeben; ohne = neue Buchung. */
  editing?: Transaction;
  onDone?: () => void;
}

export default function TransactionForm({ categories, editing, onDone }: Props) {
  const qc = useQueryClient();
  const listId = useId();
  const amountRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(editing?.date ?? todayIso());
  const [type, setType] = useState<TransactionType>(editing?.type ?? 'expense');
  const [amount, setAmount] = useState(editing ? centsToInput(editing.amountCents) : '');
  const [categoryId, setCategoryId] = useState<number | null>(editing?.categoryId ?? null);
  const [payee, setPayee] = useState(editing?.payee ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['payees', payee],
    queryFn: () => api.payees(payee),
    enabled: payee.length >= 1,
    staleTime: 10_000,
  });

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof api.createTransaction>[0]) =>
      editing ? api.updateTransaction(editing.id, input) : api.createTransaction(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['transactions'] });
      await qc.invalidateQueries({ queryKey: ['payees'] });
      if (editing) {
        onDone?.();
      } else {
        // Schnelle Serieneingabe: Datum, Typ und Kategorie bleiben, Rest wird geleert.
        setAmount('');
        setPayee('');
        setNote('');
        amountRef.current?.focus();
      }
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Speichern fehlgeschlagen'),
  });

  // Beim Typwechsel passt die bisherige Kategorie nicht mehr.
  function changeType(t: TransactionType) {
    setType(t);
    setCategoryId(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) {
      setError('Bitte einen gültigen Betrag eingeben (z. B. 12,50).');
      amountRef.current?.focus();
      return;
    }
    if (!payee.trim()) {
      setError('Bitte Empfänger bzw. Beschreibung angeben.');
      return;
    }
    mutation.mutate({ date, amountCents: cents, type, categoryId, payee, note });
  }

  const options = categories.filter((c) => c.type === type && !c.archived);

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 md:grid-cols-6">
      <div>
        <label className="label" htmlFor={`${listId}-date`}>Datum</label>
        <input id={`${listId}-date`} className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <span className="label">Typ</span>
        <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600" role="radiogroup" aria-label="Typ">
          {(['expense', 'income'] as const).map((t) => (
            <label
              key={t}
              className={`flex-1 cursor-pointer px-2 py-1.5 text-center text-sm ${
                type === t ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800'
              }`}
            >
              <input type="radio" className="sr-only" name={`${listId}-type`} checked={type === t} onChange={() => changeType(t)} />
              {t === 'expense' ? 'Ausgabe' : 'Einnahme'}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${listId}-amount`}>Betrag (€)</label>
        <input
          id={`${listId}-amount`}
          ref={amountRef}
          className="input text-right"
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="col-span-2 md:col-span-2">
        <label className="label" htmlFor={`${listId}-payee`}>Empfänger / Beschreibung</label>
        <input
          id={`${listId}-payee`}
          className="input"
          list={listId}
          autoComplete="off"
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
        />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="label" htmlFor={`${listId}-cat`}>Kategorie</label>
        <select
          id={`${listId}-cat`}
          className="input"
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">— unkategorisiert —</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="col-span-2 md:col-span-5">
        <label className="label" htmlFor={`${listId}-note`}>Notiz (optional)</label>
        <input id={`${listId}-note`} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="col-span-2 flex items-end justify-end gap-2 md:col-span-1">
        {editing && (
          <button type="button" className="btn-secondary" onClick={onDone}>
            Abbrechen
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {editing ? 'Speichern' : 'Hinzufügen'}
        </button>
      </div>
      {error && (
        <p role="alert" className="col-span-2 text-sm text-red-600 md:col-span-6">
          {error}
        </p>
      )}
    </form>
  );
}
