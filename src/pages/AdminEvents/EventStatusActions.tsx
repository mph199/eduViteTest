type EventStatus = 'draft' | 'published' | 'closed';

interface Props {
  eventId: number;
  status: EventStatus;
  onSetStatus: (id: number, status: EventStatus) => void;
  onDelete: (id: number) => void;
}

export function EventStatusActions({ eventId, status, onSetStatus, onDelete }: Props) {
  return (
    <div className="ev-detail-section">
      <h4 className="ev-detail-section__title">
        <span className="ev-workflow__num" style={{ fontSize: '0.7rem', width: 20, height: 20 }}>3</span>
        Status & Aktionen
      </h4>
      <div className="ev-detail-actions">
        {status !== 'published' && (
          <button type="button" className="btn-primary" onClick={() => onSetStatus(eventId, 'published')}>
            ✓ Veröffentlichen
          </button>
        )}
        {status === 'published' && (
          <button type="button" className="btn-secondary" onClick={() => onSetStatus(eventId, 'closed')}>
            Event schließen
          </button>
        )}
        {status !== 'draft' && (
          <button type="button" className="btn-secondary" onClick={() => onSetStatus(eventId, 'draft')}>
            Zurück auf Entwurf
          </button>
        )}
        <button type="button" className="cancel-button" onClick={() => onDelete(eventId)}>
          <span aria-hidden="true">✕</span> Event löschen
        </button>
      </div>
    </div>
  );
}
