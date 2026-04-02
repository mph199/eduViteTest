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
      <div className="action-btns" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn-secondary" onClick={handleNew}>Teilnehmer hinzufügen</button>
        <input type="file" accept=".csv" ref={fileRef} style={{ display: 'none' }} onChange={handleCSVImport} />
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>CSV-Import</button>
        {group?.status === 'open' && (
          <button className="btn-secondary" onClick={handleInvite} disabled={inviting || activeCount === 0}>
            {inviting ? 'Sende...' : 'Einladungen senden'}
          </button>
        )}
        <span style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>
          {activeCount} aktiv / {participants.length} gesamt
        </span>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="teacher-form-container" style={{ marginBottom: '1.5rem' }}>
          <div className="teacher-form">
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Vorname *</label>
                <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Nachname *</label>
                <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label>E-Mail *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Klasse / Gruppe</label>
              <input type="text" value={form.audience_label} onChange={(e) => setForm({ ...form, audience_label: e.target.value })} />
            </div>
            <div className="action-btns">
              <button type="submit" className="btn-secondary">{editingId ? 'Speichern' : 'Hinzufügen'}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
            </div>
          </div>
        </form>
      )}

      <div className="admin-resp-table-container">
        <table className="admin-resp-table">
          <thead>
            <tr>
              <th>Nachname</th>
              <th>Vorname</th>
              <th>E-Mail</th>
              <th>Klasse</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Keine Teilnehmer vorhanden</td></tr>
            )}
            {participants.map((p) => (
              <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                <td>{p.last_name}</td>
                <td>{p.first_name}</td>
                <td>{p.email}</td>
                <td>{p.audience_label || '–'}</td>
                <td>{p.is_active ? 'Aktiv' : 'Deaktiviert'}</td>
                <td>
                  <div className="action-btns">
                    <button className="btn-secondary" onClick={() => handleEdit(p)}>Bearbeiten</button>
                    {p.is_active && (
                      <button className="btn-secondary btn--danger" onClick={() => handleDeactivate(p.id)}>Deaktivieren</button>
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
