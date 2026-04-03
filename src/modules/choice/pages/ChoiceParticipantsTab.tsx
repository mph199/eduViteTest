import { useState, useRef } from 'react';
import type { ChoiceGroup, ChoiceParticipant } from '../../../types';
import api from '../../../services/api';

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  audience_label: '',
};

interface Props {
  groupId: string;
  group: ChoiceGroup | null;
  participants: ChoiceParticipant[];
  showFlash: (msg: string) => void;
  loadParticipants: () => Promise<void>;
}

export function ChoiceParticipantsTab({ groupId, group, participants, showFlash, loadParticipants }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [inviting, setInviting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (p: ChoiceParticipant) => {
    setEditingId(p.id);
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      audience_label: p.audience_label || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      showFlash('Vorname, Nachname und E-Mail sind Pflichtfelder.');
      return;
    }
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        audience_label: form.audience_label || undefined,
      };

      if (editingId) {
        await api.choice.updateParticipant(editingId, payload);
        showFlash('Teilnehmer aktualisiert.');
      } else {
        await api.choice.createParticipant(groupId, payload);
        showFlash('Teilnehmer hinzugefügt.');
      }
      setShowForm(false);
      await loadParticipants();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Teilnehmer wirklich deaktivieren?')) return;
    try {
      await api.choice.deactivateParticipant(id);
      showFlash('Teilnehmer deaktiviert.');
      await loadParticipants();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Deaktivieren');
    }
  };

  const handleCSVImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    try {
      const result = await api.choice.importParticipantsCSV(groupId, file);
      showFlash(`CSV-Import: ${result.imported || 0} importiert, ${result.skipped || 0} übersprungen.`);
      if (fileRef.current) fileRef.current.value = '';
      await loadParticipants();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'CSV-Import fehlgeschlagen');
    }
  };

  const handleInvite = async () => {
    if (!confirm('Einladungsmails an alle aktiven Teilnehmer senden?')) return;
    setInviting(true);
    try {
      const result = await api.choice.sendInvites(groupId);
      showFlash(`Einladungen: ${result.sent || 0} gesendet, ${result.failed || 0} fehlgeschlagen.`);
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Versenden');
    } finally {
      setInviting(false);
    }
  };

  const activeCount = participants.filter((p) => p.is_active).length;

  return (
    <div>
      <div className="choice-toolbar">
        <button className="btn-primary" onClick={handleNew}>Teilnehmer hinzufügen</button>
        <input type="file" accept=".csv" ref={fileRef} style={{ display: 'none' }} onChange={handleCSVImport} />
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>CSV-Import</button>
        {group?.status === 'open' && (
          <button className="btn-secondary" onClick={handleInvite} disabled={inviting || activeCount === 0}>
            {inviting ? 'Sende...' : 'Einladungen senden'}
          </button>
        )}
        <span className="choice-toolbar__info">
          {activeCount} aktiv / {participants.length} gesamt
        </span>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="choice-form-panel">
          <div className="choice-form-row">
            <div className="form-group">
              <label>Vorname *</label>
              <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Nachname *</label>
              <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
            </div>
          </div>
          <div className="choice-form-row">
            <div className="form-group">
              <label>E-Mail *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Klasse / Gruppe</label>
              <input type="text" value={form.audience_label} onChange={(e) => setForm({ ...form, audience_label: e.target.value })} />
            </div>
          </div>
          <div className="choice-card__actions">
            <button type="submit" className="btn-primary">{editingId ? 'Speichern' : 'Hinzufügen'}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
          </div>
        </form>
      )}

      {participants.length === 0 ? (
        <div className="choice-empty">Keine Teilnehmer vorhanden</div>
      ) : (
        <div className="choice-cards">
          {participants.map((p) => (
            <div key={p.id} className={`choice-card choice-card--compact${p.is_active ? '' : ' choice-row--inactive'}`}>
              <div className="choice-card__accent" />
              <div className="choice-card__body">
                <div className="choice-card__header">
                  <h3 className="choice-card__title">{p.last_name}, {p.first_name}</h3>
                  <span className={`choice-status choice-status--${p.is_active ? 'active' : 'inactive'}`}>
                    {p.is_active ? 'Aktiv' : 'Deaktiviert'}
                  </span>
                </div>
                <div className="choice-card__email">{p.email}</div>
                <div className="choice-card__meta">
                  <div className="choice-card__meta-item">
                    <span className="choice-card__meta-label">Klasse</span>
                    <span className="choice-card__meta-value">{p.audience_label || '–'}</span>
                  </div>
                  <div className="choice-card__meta-item">
                    <span className="choice-card__meta-label">Hinzugefügt</span>
                    <span className="choice-card__meta-value">{new Date(p.created_at).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>
                <div className="choice-card__actions">
                  <button className="btn-secondary" onClick={() => handleEdit(p)}>Bearbeiten</button>
                  {p.is_active && (
                    <button className="btn-secondary btn--danger" onClick={() => handleDeactivate(p.id)}>Deaktivieren</button>
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
