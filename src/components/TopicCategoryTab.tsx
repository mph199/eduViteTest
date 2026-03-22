import { useState } from 'react';
import type { CounselorTopic } from '../types';

interface TopicCategoryApi {
  create: (data: { name: string; description?: string; sort_order?: number; [key: string]: unknown }) => Promise<unknown>;
  update: (id: number, data: { name: string; description?: string; sort_order?: number; [key: string]: unknown }) => Promise<unknown>;
}

interface Props {
  items: CounselorTopic[];
  showFlash: (msg: string) => void;
  loadData: () => void;
  api: TopicCategoryApi;
  labels: {
    singular: string;
    plural: string;
    created: string;
    updated: string;
  };
  idPrefix: string;
}

const emptyForm = { name: '', description: '', sort_order: 0 };

export function TopicCategoryTab({ items, showFlash, loadData, api, labels, idPrefix }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showFlash('Name ist Pflicht.'); return; }
    try {
      if (editingId) {
        await api.update(editingId, form);
        showFlash(labels.updated);
      } else {
        await api.create(form);
        showFlash(labels.created);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      loadData();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleEdit = (item: CounselorTopic) => {
    setForm({
      name: item.name,
      description: item.description || '',
      sort_order: item.sort_order || 0,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  return (
    <>
      <div className="admin-section-header">
        <h3>{labels.plural}</h3>
        <button
          className="btn-primary"
          onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
        >
          + {labels.singular}
        </button>
      </div>

      {showForm && (
        <div className="teacher-form-container">
          <h3>{editingId ? `${labels.singular} bearbeiten` : labels.singular}</h3>
          <form className="teacher-form" onSubmit={handleSave}>
            <div className="form-group">
              <label htmlFor={`${idPrefix}-name`}>Name</label>
              <input id={`${idPrefix}-name`} type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label htmlFor={`${idPrefix}-desc`}>Beschreibung</label>
              <input id={`${idPrefix}-desc`} type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor={`${idPrefix}-sort`}>Sortierung</label>
              <input id={`${idPrefix}-sort`} type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
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
            {items.length === 0 ? (
              <tr><td colSpan={4}>Keine {labels.plural.toLowerCase()} vorhanden.</td></tr>
            ) : items.map(item => (
              <tr key={item.id}>
                <td data-label="Name">{item.name}</td>
                <td data-label="Beschreibung">{item.description || '--'}</td>
                <td data-label="Reihenfolge">{item.sort_order}</td>
                <td data-label="Aktionen">
                  <button className="btn-secondary" onClick={() => handleEdit(item)}>Bearbeiten</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
