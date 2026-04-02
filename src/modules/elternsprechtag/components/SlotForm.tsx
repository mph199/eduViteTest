interface SlotFormData {
  time: string;
  date: string;
}

interface SlotFormProps {
  formData: SlotFormData;
  editing: boolean;
  onFormDataChange: (data: SlotFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function SlotForm({ formData, editing, onFormDataChange, onSubmit, onCancel }: SlotFormProps) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3>{editing ? 'Slot bearbeiten' : 'Neuen Slot anlegen'}</h3>
      <form onSubmit={onSubmit} className="teacher-form">
        <div className="form-group">
          <label htmlFor="time">Zeit</label>
          <input
            id="time"
            type="text"
            value={formData.time}
            onChange={(e) => onFormDataChange({ ...formData, time: e.target.value })}
            placeholder="z.B. 16:00 - 16:15"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="date">Datum</label>
          <input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => onFormDataChange({ ...formData, date: e.target.value })}
            required
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editing ? 'Speichern' : 'Anlegen'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
