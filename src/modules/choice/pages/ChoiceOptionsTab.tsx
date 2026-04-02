import { useState } from 'react';
import type { ChoiceOption } from '../../../types';
import api from '../../../services/api';

const emptyForm = {
  title: '',
  description: '',
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
      <div className="action-btns" style={{ marginBottom: '1rem' }}>
        <button className="btn-secondary" onClick={handleNew}>Neue Option</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="teacher-form-container" style={{ marginBottom: '1.5rem' }}>
          <div className="teacher-form">
            <div className="form-group">
              <label>Titel *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Beschreibung</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="form-group">
              <label>Sortierung</label>
              <input type="number" min={0} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
            <div className="action-btns">
              <button type="submit" className="btn-secondary">{editingId ? 'Speichern' : 'Erstellen'}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
            </div>
          </div>
        </form>
      )}

      <div className="admin-resp-table-container">
        <table className="admin-resp-table">
          <thead>
            <tr>
              <th>Titel</th>
              <th>Beschreibung</th>
              <th>Sortierung</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {options.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Keine Optionen vorhanden</td></tr>
            )}
            {options.map((o) => (
              <tr key={o.id} style={{ opacity: o.is_active ? 1 : 0.5 }}>
                <td>{o.title}</td>
                <td>{o.description || '–'}</td>
                <td>{o.sort_order}</td>
                <td>{o.is_active ? 'Aktiv' : 'Deaktiviert'}</td>
                <td>
                  <div className="action-btns">
                    <button className="btn-secondary" onClick={() => handleEdit(o)}>Bearbeiten</button>
                    {o.is_active && (
                      <button className="btn-secondary btn--danger" onClick={() => handleDeactivate(o.id)}>Deaktivieren</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
