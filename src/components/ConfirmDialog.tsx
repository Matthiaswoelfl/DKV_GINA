import Modal from './Modal';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Löschen', onConfirm, onCancel }: Props) {
  return (
    <Modal label={title} alert onClose={onCancel} className="max-w-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        {/* Fokus startet bewusst auf „Abbrechen“, damit Enter nichts Destruktives auslöst. */}
        <button data-autofocus className="btn-secondary" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
