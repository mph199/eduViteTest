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
        <ul style={{ margin: '0.75rem 0', paddingLeft: '1.25rem' }}>
          {conflicts.map((c) => (
            <li key={c.key} style={{ marginBottom: '0.5rem' }}>
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
        <p style={{ fontWeight: 600 }}>
          Diese Aktion kann nicht rueckgaengig gemacht werden.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
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
