import { useState, useEffect, useCallback } from 'react';
import { useActiveView } from '../../../hooks/useActiveView';
import { useBgStyle } from '../../../hooks/useBgStyle';
import { useFlash } from '../../../hooks/useFlash';
import api from '../../../services/api';
import type { TimeSlot as ApiSlot, Teacher as ApiTeacher, GenerateSlotsResponse } from '../../../types';
import { AdminPageWrapper } from '../../../shared/components/AdminPageWrapper';
import { exportTeacherSlotsToICal } from '../../../utils/icalExport';
import { teacherDisplayName } from '../../../utils/teacherDisplayName';
import { TeacherSelect } from '../components/TeacherSelect';
import { SlotForm } from '../components/SlotForm';
import '../../../pages/AdminDashboard.css';

export function AdminSlots() {
  const [teachers, setTeachers] = useState<ApiTeacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [slots, setSlots] = useState<ApiSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ApiSlot | null>(null);
  const [formData, setFormData] = useState({ time: '', date: '' });
  const [bulkCreating, setBulkCreating] = useState(false);
  const [flash, showFlash] = useFlash();
  useActiveView('admin');
  const adminBgStyle = useBgStyle('admin', '--page-bg');

  const loadTeachers = useCallback(async () => {
    try {
      const data = await api.getTeachers();
      setTeachers(data);
      if (data.length > 0 && !selectedTeacherId) {
        setSelectedTeacherId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Lehrkräfte');
    }
  }, [selectedTeacherId]);

  const loadSlots = async (teacherId: number) => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getSlots(teacherId);
      setSlots(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Slots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    if (selectedTeacherId) {
      loadSlots(selectedTeacherId);
    }
  }, [selectedTeacherId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.time.trim() || !formData.date) {
      showFlash('Bitte alle Felder ausfuellen');
      return;
    }

    if (!selectedTeacherId) {
      showFlash('Bitte wählen Sie eine Lehrkraft aus');
      return;
    }

    try {
      if (editingSlot) {
        await api.admin.updateSlot(editingSlot.id, formData);
      } else {
        await api.admin.createSlot({
          teacher_id: selectedTeacherId,
          ...formData,
        });
      }
      await loadSlots(selectedTeacherId);
      setShowForm(false);
      setEditingSlot(null);
      setFormData({ time: '', date: '' });
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleEdit = (slot: ApiSlot) => {
    setEditingSlot(slot);
    setFormData({
      time: slot.time,
      date: slot.date,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number, time: string) => {
    if (!confirm(`Möchten Sie den Slot "${time}" wirklich löschen?`)) {
      return;
    }

    try {
      await api.admin.deleteSlot(id);
      if (selectedTeacherId) {
        await loadSlots(selectedTeacherId);
      }
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingSlot(null);
    setFormData({ time: '', date: '' });
  };

  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);

  return (
    <AdminPageWrapper style={adminBgStyle}>
        {flash && <div className="admin-success">{flash}</div>}
        <div className="teacher-form-container">
          <div className="admin-section-header">
            <h3>Sprechzeiten verwalten</h3>
            {selectedTeacherId && !showForm && (
              <div className="action-buttons action-buttons--compact">
                <button 
                  onClick={() => setShowForm(true)} 
                  className="btn-primary"
                >
                  + Neue Sprechzeit
                </button>
                <button
                  onClick={async () => {
                    if (!selectedTeacherId) return;
                    const name = selectedTeacher ? teacherDisplayName(selectedTeacher) : 'diese Lehrkraft';
                    if (!confirm(`Alle Sprechzeiten für ${name} anlegen?`)) return;
                    try {
                      setBulkCreating(true);
                      const res = await api.admin.generateTeacherSlots(selectedTeacherId);
                      const parsed = res as unknown as GenerateSlotsResponse;
                      const created = parsed?.created ?? 0;
                      const skipped = parsed?.skipped ?? 0;
                      const eventDate = parsed?.eventDate ?? null;
                      await loadSlots(selectedTeacherId);
                      showFlash(`Sprechzeiten angelegt${eventDate ? ` (${eventDate})` : ''}: ${created} | Bereits vorhanden: ${skipped}`);
                    } catch (err) {
                      showFlash(err instanceof Error ? err.message : 'Fehler beim Anlegen der Sprechzeiten');
                    } finally {
                      setBulkCreating(false);
                    }
                  }}
                  className="btn-secondary"
                  disabled={bulkCreating}
                >
                  {bulkCreating ? 'Anlegen…' : 'Alle Sprechzeiten anlegen'}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="admin-error">
              {error}
            </div>
          )}

          <TeacherSelect
            teachers={teachers}
            selectedTeacherId={selectedTeacherId}
            onSelect={setSelectedTeacherId}
          />

          {showForm && (
            <SlotForm
              formData={formData}
              editing={!!editingSlot}
              onFormDataChange={setFormData}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          )}

          {loading ? (
            <div className="admin-loading" style={{ minHeight: 'auto', padding: '1.5rem 0' }}>
              <div className="spinner"></div>
              <p>Laden...</p>
            </div>
          ) : (
            <>
              {selectedTeacher && (
                <div className="settings-info" style={{ marginBottom: '1.5rem' }}>
                  <div className="admin-actions-row admin-actions-row--between">
                    <div>
                      <h3>Sprechzeiten für {teacherDisplayName(selectedTeacher)}</h3>
                      <p>Sprechzeiten: {selectedTeacher.available_from || '16:00'} – {selectedTeacher.available_until || '19:00'}</p>
                      <p>Anzahl Sprechzeiten: {slots.length} ({slots.filter(s => s.booked).length} gebucht)</p>
                    </div>
                    {slots.filter(s => s.booked).length > 0 && (
                      <button
                        onClick={() => exportTeacherSlotsToICal(slots, teacherDisplayName(selectedTeacher))}
                        className="btn-primary"
                      >
                        Termine exportieren
                      </button>
                    )}
                  </div>
                </div>
              )}

              {slots.length === 0 ? (
                <div className="no-teachers">
                  <p>Keine Sprechzeiten vorhanden.</p>
                </div>
              ) : (
                <div className="admin-resp-table-container">
                  <table className="admin-resp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>Termin</th>
                      <th style={{ width: '14%' }}>Status</th>
                      <th style={{ width: '36%' }}>Gebucht von</th>
                      <th className="admin-actions-header" style={{ width: '30%' }}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => (
                      <tr key={slot.id}>
                        <td data-label="Termin">
                          <div className="admin-cell-main">{slot.date}</div>
                          <div className="admin-cell-meta">{slot.time}</div>
                          <div className="admin-cell-id">#{slot.id}</div>
                        </td>
                        <td data-label="Status">
                          <span className={`admin-status-pill ${slot.booked ? 'admin-status-pill--warning' : 'admin-status-pill--success'}`}>
                            {slot.booked ? 'Gebucht' : 'Verfügbar'}
                          </span>
                        </td>
                        <td data-label="Gebucht von">
                          {slot.booked ? (
                            <>
                              <div className="admin-cell-main">
                                {slot.visitorType === 'parent' ? slot.parentName : slot.companyName}
                              </div>
                              <div className="admin-cell-meta">
                                {slot.visitorType === 'parent'
                                  ? `${slot.studentName || '—'} (${slot.className || '—'})`
                                  : `${slot.traineeName || '—'} (${slot.className || '—'})`}
                              </div>
                              {slot.visitorType === 'company' && slot.representativeName && (
                                <div className="admin-cell-meta">Vertreter*in: {slot.representativeName}</div>
                              )}
                            </>
                          ) : (
                            <span style={{ color: 'var(--color-gray-400)' }}>—</span>
                          )}
                        </td>
                        <td data-label="Aktionen" className="admin-actions-cell">
                          <div className="action-buttons">
                            <button
                              onClick={() => handleEdit(slot)}
                              className="edit-button"
                              disabled={slot.booked}
                            >
                              <span aria-hidden="true">✎</span> Bearbeiten
                            </button>
                            <button
                              onClick={() => handleDelete(slot.id, slot.time)}
                              className="cancel-button"
                              disabled={slot.booked}
                            >
                              <span aria-hidden="true">✕</span> Löschen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </>
          )}
        </div>
    </AdminPageWrapper>
  );
}
