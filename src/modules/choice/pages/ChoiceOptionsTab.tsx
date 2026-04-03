import { useState } from 'react';
import type { ChoiceOption } from '../../../types';
import api from '../../../services/api';
import { IconPicker, DynamicIcon } from '../../../shared/components/IconPicker';

const emptyForm = {
  title: '',
  description: '',
  icon: null as string | null,
  sort_order: 0,
};

interface Props {
  groupId: string;
  options: ChoiceOption[];
  showFlash: (msg: string) => void;
  loadOptions: () => Promise<void>;
}

export function ChoiceOptionsTab({ groupId, options, showFlash, loadOptions }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (o: ChoiceOption) => {
    setEditingId(o.id);
    setForm({
      title: o.title,
      description: o.description || '',
      icon: o.icon || null,
      sort_order: o.sort_order,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showFlash('Titel ist ein Pflichtfeld.');
      return;
    }
    try {
      if (editingId) {
        await api.choice.updateOption(editingId, form);
        showFlash('Option aktualisiert.');
      } else {
        await api.choice.createOption(groupId, form);
        showFlash('Option erstellt.');
      }
      setShowForm(false);
      await loadOptions();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Option wirklich deaktivieren?')) return;
    try {
      await api.choice.deactivateOption(id);
      showFlash('Option deaktiviert.');
      await loadOptions();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Deaktivieren');
    }
  };

  return (
    <div>
      <div className="choice-toolbar">
        <button className="btn-primary" onClick={handleNew}>Neue Option</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="choice-form-panel">
          <div className="form-group">
            <label>Titel *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Beschreibung</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="form-group">
            <label>Icon</label>
            <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
          </div>
          <div className="form-group">
            <label>Sortierung</label>
            <input type="number" min={0} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </div>
          <div className="choice-card__actions">
            <button type="submit" className="btn-primary">{editingId ? 'Speichern' : 'Erstellen'}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
          </div>
        </form>
      )}

      {options.length === 0 ? (
        <div className="choice-empty">Keine Optionen vorhanden</div>
      ) : (
        <div className="choice-cards">
          {options.map((o) => (
            <div key={o.id} className={`choice-card choice-card--compact${o.is_active ? '' : ' choice-row--inactive'}`}>
              <div className="choice-card__accent" />
              <div className="choice-card__body">
                <div className="choice-card__header">
                  {o.icon && <DynamicIcon name={o.icon} size={24} className="choice-card__icon choice-card__icon--option" />}
                  <h3 className="choice-card__title">{o.title}</h3>
                  <span className={`choice-status choice-status--${o.is_active ? 'active' : 'inactive'}`}>
                    {o.is_active ? 'Aktiv' : 'Deaktiviert'}
                  </span>
                </div>
                {o.description && (
                  <div className="choice-card__desc">{o.description}</div>
                )}
                <div className="choice-card__meta">
                  <div className="choice-card__meta-item">
                    <span className="choice-card__meta-label">Sortierung</span>
                    <span className="choice-card__meta-value">{o.sort_order}</span>
                  </div>
                  <div className="choice-card__meta-item">
                    <span className="choice-card__meta-label">Erstellt</span>
                    <span className="choice-card__meta-value">{new Date(o.created_at).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>
                <div className="choice-card__actions">
                  <button className="btn-secondary" onClick={() => handleEdit(o)}>Bearbeiten</button>
                  {o.is_active && (
                    <button className="btn-secondary btn--danger" onClick={() => handleDeactivate(o.id)}>Deaktivieren</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
