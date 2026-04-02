import { useState } from 'react';
import type { ChoiceGroup, ChoiceGroupStatus } from '../../../types';
import api from '../../../services/api';

const STATUS_LABELS: Record<ChoiceGroupStatus, string> = {
  draft: 'Entwurf',
  open: 'Offen',
  closed: 'Geschlossen',
  archived: 'Archiviert',
};

const STATUS_COLORS: Record<ChoiceGroupStatus, string> = {
  draft: 'var(--color-gray-500)',
  open: 'var(--brand-primary)',
  closed: 'var(--color-gray-600)',
  archived: 'var(--color-gray-400)',
};

const emptyForm = {
  title: '',
  description: '',
  min_choices: 1,
  max_choices: 1,
  ranking_mode: 'none' as 'none' | 'required',
  allow_edit_after_submit: true,
  opens_at: '',
  closes_at: '',
};

interface Props {
  groups: ChoiceGroup[];
  showFlash: (msg: string) => void;
  loadGroups: () => Promise<void>;
  onSelectGroup: (id: string) => void;
}

export function ChoiceGroupsTab({ groups, showFlash, loadGroups, onSelectGroup }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (g: ChoiceGroup) => {
    setEditingId(g.id);
    setForm({
      title: g.title,
      description: g.description || '',
      min_choices: g.min_choices,
      max_choices: g.max_choices,
      ranking_mode: g.ranking_mode,
      allow_edit_after_submit: g.allow_edit_after_submit,
      opens_at: g.opens_at ? g.opens_at.slice(0, 16) : '',
      closes_at: g.closes_at ? g.closes_at.slice(0, 16) : '',
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
      const payload = {
        title: form.title,
        description: form.description || undefined,
        min_choices: form.min_choices,
        max_choices: form.max_choices,
        ranking_mode: form.ranking_mode,
        allow_edit_after_submit: form.allow_edit_after_submit,
        opens_at: form.opens_at ? new Date(form.opens_at).toISOString() : null,
        closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null,
      };

      if (editingId) {
        await api.choice.updateGroup(editingId, payload);
        showFlash('Wahldach aktualisiert.');
      } else {
        await api.choice.createGroup(payload);
        showFlash('Wahldach erstellt.');
      }
      setShowForm(false);
      await loadGroups();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.choice.changeGroupStatus(id, status);
      showFlash(`Status geändert: ${STATUS_LABELS[status as ChoiceGroupStatus] || status}`);
      await loadGroups();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Statuswechsel fehlgeschlagen');
    }
  };

  return (
    <div>
      <div className="action-btns" style={{ marginBottom: '1rem' }}>
        <button className="btn-secondary" onClick={handleNew}>Neues Wahldach</button>
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
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Min. Wahlen</label>
                <input type="number" min={1} max={20} value={form.min_choices} onChange={(e) => setForm({ ...form, min_choices: Number(e.target.value) })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Max. Wahlen</label>
                <input type="number" min={1} max={20} value={form.max_choices} onChange={(e) => setForm({ ...form, max_choices: Number(e.target.value) })} />
              </div>
            </div>
            <div className="form-group">
              <label>Ranking</label>
              <select value={form.ranking_mode} onChange={(e) => setForm({ ...form, ranking_mode: e.target.value as 'none' | 'required' })}>
                <option value="none">Keine Priorisierung</option>
                <option value="required">Priorisierung erforderlich</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" checked={form.allow_edit_after_submit} onChange={(e) => setForm({ ...form, allow_edit_after_submit: e.target.checked })} />
                {' '}Bearbeitung nach Abgabe erlauben
              </label>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Öffnet am</label>
                <input type="datetime-local" value={form.opens_at} onChange={(e) => setForm({ ...form, opens_at: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Schliesst am</label>
                <input type="datetime-local" value={form.closes_at} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} />
              </div>
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
              <th>Status</th>
              <th>Wahlen</th>
              <th>Ranking</th>
              <th>Erstellt</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Keine Wahldächer vorhanden</td></tr>
            )}
            {groups.map((g) => (
              <tr key={g.id}>
                <td>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontWeight: 500 }}
                    onClick={() => onSelectGroup(g.id)}
                  >
                    {g.title}
                  </button>
                </td>
                <td>
                  <span style={{ color: STATUS_COLORS[g.status], fontWeight: 500 }}>
                    {STATUS_LABELS[g.status]}
                  </span>
                </td>
                <td>{g.min_choices}–{g.max_choices}</td>
                <td>{g.ranking_mode === 'required' ? 'Ja' : 'Nein'}</td>
                <td>{new Date(g.created_at).toLocaleDateString('de-DE')}</td>
                <td>
                  <div className="action-btns">
                    <button className="btn-secondary" onClick={() => handleEdit(g)}>Bearbeiten</button>
                    {g.status === 'draft' && (
                      <button className="btn-secondary" onClick={() => handleStatusChange(g.id, 'open')}>Öffnen</button>
                    )}
                    {g.status === 'open' && (
                      <button className="btn-secondary" onClick={() => handleStatusChange(g.id, 'closed')}>Schliessen</button>
                    )}
                    {g.status === 'closed' && (
                      <>
                        <button className="btn-secondary" onClick={() => handleStatusChange(g.id, 'open')}>Wieder öffnen</button>
                        <button className="btn-secondary" onClick={() => handleStatusChange(g.id, 'archived')}>Archivieren</button>
                      </>
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
