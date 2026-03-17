import { useState } from 'react';
import type { CounselorTopic as Category } from '../../../types';
import api from '../../../services/api';

const emptyCategory = {
  name: '',
  description: '',
  icon: '',
  sort_order: 0,
};

interface Props {
  categories: Category[];
  showFlash: (msg: string) => void;
  loadData: () => void;
}

export function SSWCategoriesTab({ categories, showFlash, loadData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyCategory);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { alert('Name ist Pflicht.'); return; }
    try {
      if (editingId) {
        await api.ssw.updateCategory(editingId, form);
        showFlash('Kategorie aktualisiert.');
      } else {
        await api.ssw.createCategory(form);
        showFlash('Kategorie erstellt.');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyCategory);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleEdit = (cat: Category) => {
    setForm({
      name: cat.name,
      description: cat.description || '',
      icon: cat.icon || '',
      sort_order: cat.sort_order || 0,
    });
    setEditingId(cat.id);
    setShowForm(true);
  };

  return (
    <>
      <div className="admin-section-header">
        <h3>Themen</h3>
        <button
          className="btn-primary"
          onClick={() => { setForm(emptyCategory); setEditingId(null); setShowForm(true); }}
        >
          + Neues Thema
        </button>
      </div>

      {showForm && (
        <div className="teacher-form-container">
          <h3>{editingId ? 'Thema bearbeiten' : 'Neues Thema'}</h3>
          <form className="teacher-form" onSubmit={handleSave}>
            <div className="form-group">
              <label htmlFor="ssw-cat-name">Name</label>
              <input id="ssw-cat-name" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label htmlFor="ssw-cat-desc">Beschreibung</label>
              <input id="ssw-cat-desc" type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="ssw-cat-sort">Sortierung</label>
              <input id="ssw-cat-sort" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="form-actions">
              <button className="btn-primary" type="submit">{editingId ? 'Speichern' : 'Erstellen'}</button>
              <button className="btn-secondary" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Abbrechen</button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-resp-table-container">
        <table className="admin-resp-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Beschreibung</th>
              <th>#</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr><td colSpan={4}>Keine Themen vorhanden.</td></tr>
            ) : categories.map(cat => (
              <tr key={cat.id}>
                <td data-label="Name">{cat.name}</td>
                <td data-label="Beschreibung">{cat.description || '–'}</td>
                <td data-label="Reihenfolge">{cat.sort_order}</td>
                <td data-label="Aktionen">
                  <button className="btn-secondary" onClick={() => handleEdit(cat)}>Bearbeiten</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
