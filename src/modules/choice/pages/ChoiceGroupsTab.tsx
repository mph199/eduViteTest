import { useState } from 'react';
import type { ChoiceGroup, ChoiceGroupStatus } from '../../../types';
import api from '../../../services/api';

const STATUS_LABELS: Record<ChoiceGroupStatus, string> = {
  draft: 'Entwurf',
  open: 'Offen',
  closed: 'Geschlossen',
  archived: 'Archiviert',
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
  onOpenGroup: (id: string) => void;
}

export function ChoiceGroupsOverview({ groups, showFlash, loadGroups, onOpenGroup }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (e: React.MouseEvent, g: ChoiceGroup) => {
    e.stopPropagation();
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

  const handleStatusChange = async (e: React.MouseEvent, id: string, status: string) => {
    e.stopPropagation();
    try {
      await api.choice.changeGroupStatus(id, status);
      showFlash(`Status geändert: ${STATUS_LABELS[status as ChoiceGroupStatus] || status}`);
      await loadGroups();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Statuswechsel fehlgeschlagen');
    }
  };

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div className="choice-toolbar">
        <button className="btn-primary" onClick={handleNew}>Neues Wahldach</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="choice-form-panel">
          <div className="form-group">
            <label>Titel *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Beschreibung</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="choice-form-row">
            <div className="form-group">
              <label>Min. Wahlen</label>
              <input type="number" min={1} max={20} value={form.min_choices} onChange={(e) => setForm({ ...form, min_choices: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Max. Wahlen</label>
              <input type="number" min={1} max={20} value={form.max_choices} onChange={(e) => setForm({ ...form, max_choices: Number(e.target.value) })} />
            </div>
          </div>
          <div className="choice-form-row">
            <div className="form-group">
              <label>Ranking</label>
              <select value={form.ranking_mode} onChange={(e) => setForm({ ...form, ranking_mode: e.target.value as 'none' | 'required' })}>
                <option value="none">Keine Priorisierung</option>
                <option value="required">Priorisierung erforderlich</option>
              </select>
            </div>
            <div className="form-group">
              <label>&nbsp;</label>
              <label className="choice-checkbox-label">
                <input type="checkbox" checked={form.allow_edit_after_submit} onChange={(e) => setForm({ ...form, allow_edit_after_submit: e.target.checked })} />
                Bearbeitung nach Abgabe
              </label>
            </div>
          </div>
          <div className="choice-form-row">
            <div className="form-group">
              <label>Öffnet am</label>
              <input type="datetime-local" value={form.opens_at} onChange={(e) => setForm({ ...form, opens_at: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Schliesst am</label>
              <input type="datetime-local" value={form.closes_at} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} />
            </div>
          </div>
          <div className="choice-card__actions">
            <button type="submit" className="btn-primary">{editingId ? 'Speichern' : 'Erstellen'}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
          </div>
        </form>
      )}

      {groups.length === 0 ? (
        <div className="choice-empty">Keine Wahldächer vorhanden</div>
      ) : (
        <div className="choice-cards">
          {groups.map((g) => (
            <div key={g.id} className="choice-card choice-card--clickable" onClick={() => onOpenGroup(g.id)}>
              <div className="choice-card__accent" />
              <div className="choice-card__body">
                <div className="choice-card__header">
                  <h3 className="choice-card__title">{g.title}</h3>
                  <span className={`choice-status choice-status--${g.status}`}>
                    {STATUS_LABELS[g.status]}
                  </span>
                </div>

                <div className="choice-card__meta">
                  <div className="choice-card__meta-item">
                    <span className="choice-card__meta-label">Wahlen</span>
                    <span className="choice-card__meta-value">{g.min_choices}–{g.max_choices}</span>
                  </div>
                  <div className="choice-card__meta-item">
                    <span className="choice-card__meta-label">Ranking</span>
                    <span className="choice-card__meta-value">{g.ranking_mode === 'required' ? 'Ja' : 'Nein'}</span>
                  </div>
                  <div className="choice-card__meta-item">
                    <span className="choice-card__meta-label">Erstellt</span>
                    <span className="choice-card__meta-value">{new Date(g.created_at).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>

                {(g.opens_at || g.closes_at) && (
                  <div className="choice-card__time">
                    {g.opens_at && <span>{formatDate(g.opens_at)}</span>}
                    {g.opens_at && g.closes_at && <span>–</span>}
                    {g.closes_at && <span>{formatDate(g.closes_at)}</span>}
                  </div>
                )}

                <div className="choice-card__actions">
                  <button className="btn-secondary" onClick={(e) => handleEdit(e, g)}>Bearbeiten</button>
                  {g.status === 'draft' && (
                    <button className="btn-secondary" onClick={(e) => handleStatusChange(e, g.id, 'open')}>Öffnen</button>
                  )}
                  {g.status === 'open' && (
                    <button className="btn-secondary" onClick={(e) => handleStatusChange(e, g.id, 'closed')}>Schliessen</button>
                  )}
                  {g.status === 'closed' && (
                    <>
                      <button className="btn-secondary" onClick={(e) => handleStatusChange(e, g.id, 'open')}>Wieder öffnen</button>
                      <button className="btn-secondary" onClick={(e) => handleStatusChange(e, g.id, 'archived')}>Archivieren</button>
                    </>
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
