interface Props {
  eventId: number;
  idPrefix?: string;
  slotMinutes: number;
  setSlotMinutes: (v: number) => void;
  replaceExisting: boolean;
  setReplaceExisting: (v: boolean) => void;
  generating: boolean;
  onGenerate: (eventId: number) => void;
}

export function SlotControls({ eventId, idPrefix = '', slotMinutes, setSlotMinutes, replaceExisting, setReplaceExisting, generating, onGenerate }: Props) {
  return (
    <div className="ev-detail-section">
      <h4 className="ev-detail-section__title">
        <span className="ev-workflow__num" style={{ fontSize: '0.7rem', width: 20, height: 20 }}>2</span>
        Sprechzeiten generieren
      </h4>
      <div className="ev-slot-controls">
        <div className="form-group" style={{ flex: '0 0 auto', minWidth: 120 }}>
          <label htmlFor={`slotMin_${idPrefix}${eventId}`}>Dauer</label>
          <select
            id={`slotMin_${idPrefix}${eventId}`}
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
          >
            <option value={10}>10 Min.</option>
            <option value={15}>15 Min.</option>
            <option value={20}>20 Min.</option>
            <option value={30}>30 Min.</option>
          </select>
        </div>
        <label className="ev-checkbox-label">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
          />
          Vorhandene Sprechzeiten ersetzen
        </label>
        <button
          type="button"
          className="btn-primary"
          onClick={() => onGenerate(eventId)}
          disabled={generating}
        >
          {generating ? 'Generiere…' : 'Sprechzeiten generieren'}
        </button>
      </div>
    </div>
  );
}
