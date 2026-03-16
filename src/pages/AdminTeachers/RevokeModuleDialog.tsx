import type { RevokedModuleConflict } from '../../types';

interface Props {
  conflicts: RevokedModuleConflict[];
  targetName: string;
  onConfirm: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export function RevokeModuleDialog({ conflicts, targetName, onConfirm, onCancel, saving }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Modul-Zugang entziehen</h3>
        <p>
          Beim Entfernen des Modul-Zugangs fuer <strong>{targetName}</strong> werden
          folgende Daten unwiderruflich geloescht:
        </p>
        <ul className="modal-content__list">
          {conflicts.map((c) => (
            <li key={c.key}>
              <strong>{c.label}</strong>
              {c.appointmentCount > 0 && (
                <span> — {c.appointmentCount} aktive Termine</span>
              )}
              {c.scheduleCount > 0 && (
                <span> — {c.scheduleCount} Sprechzeiten</span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-bold">
          Diese Aktion kann nicht rueckgaengig gemacht werden.
        </p>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            Abbrechen
          </button>
          <button type="button" className="cancel-button" onClick={onConfirm} disabled={saving}>
            {saving ? 'Entferne...' : 'Trotzdem entfernen'}
          </button>
        </div>
      </div>
    </div>
  );
}
