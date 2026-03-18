import { useState } from 'react';
import type { CounselorTopic as Topic } from '../../../types';
import api from '../../../services/api';

const emptyTopic = { name: '', description: '', sort_order: 0 };

interface Props {
  topics: Topic[];
  showFlash: (msg: string) => void;
  loadAdminData: () => void;
}

export function BLTopicsTab({ topics, showFlash, loadAdminData }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyTopic);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { alert('Name ist Pflicht.'); return; }
    try {
      if (editingId) {
        await api.bl.updateTopic(editingId, form);
        showFlash('Thema aktualisiert.');
      } else {
        await api.bl.createTopic(form);
        showFlash('Thema erstellt.');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyTopic);
      loadAdminData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleEdit = (t: Topic) => {
    setForm({
      name: t.name,
      description: t.description || '',
      sort_order: t.sort_order || 0,
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  return (
    <>
      <div className="admin-section-header">
        <h3>Themen</h3>
        <button
          className="btn-primary"
          onClick={() => { setForm(emptyTopic); setEditingId(null); setShowForm(true); }}
        >
          + Neues Thema
        </button>
      </div>

      {showForm && (
        <div className="teacher-form-container">
          <h3>{editingId ? 'Thema bearbeiten' : 'Neues Thema'}</h3>
          <form className="teacher-form" onSubmit={handleSave}>
            <div className="form-group">
              <label htmlFor="bl-topic-name">Name</label>
              <input id="bl-topic-name" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label htmlFor="bl-topic-desc">Beschreibung</label>
              <input id="bl-topic-desc" type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="bl-topic-sort">Sortierung</label>
              <input id="bl-topic-sort" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
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
            {topics.length === 0 ? (
              <tr><td colSpan={4}>Keine Themen vorhanden.</td></tr>
            ) : topics.map(t => (
              <tr key={t.id}>
                <td data-label="Name">{t.name}</td>
                <td data-label="Beschreibung">{t.description || '--'}</td>
                <td data-label="Reihenfolge">{t.sort_order}</td>
                <td data-label="Aktionen">
                  <button className="btn-secondary" onClick={() => handleEdit(t)}>Bearbeiten</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
