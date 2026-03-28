/**
 * ConfirmDialog — Wiederverwendbarer Bestätigungsdialog für destruktive Aktionen.
 */

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, confirmVariant = 'default', onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="confirm-dialog__overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-dialog__title">{title}</h3>
        <p className="confirm-dialog__desc">{description}</p>
        <div className="confirm-dialog__actions">
          <button type="button" className="confirm-dialog__btn" onClick={onCancel}>
            Abbrechen
          </button>
          <button
            type="button"
            className={`confirm-dialog__btn confirm-dialog__btn--${confirmVariant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
