import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
import type { FeedbackItem } from '../types';
import './AdminDashboard.css';

export function AdminFeedback() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { user, setActiveView } = useAuth();

  const canSwitchView = Boolean(user?.role === 'admin' && user.teacherId);

  useEffect(() => {
    if (canSwitchView) setActiveView('admin');
  }, [canSwitchView, setActiveView]);

  const formatDateTime = useCallback((iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }, []);

  const loadFeedback = useCallback(async () => {
    if (user?.role !== 'admin') {
      setFeedback([]);
      setError('');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const items = await api.admin.listFeedback();
      setFeedback((items || []) as FeedbackItem[]);
    } catch (e) {
      setFeedback([]);
      setError(e instanceof Error ? e.message : 'Fehler beim Laden des Feedbacks');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleDelete = async (id: number) => {
    if (user?.role !== 'admin') return;
    if (deletingId) return;

    const item = feedback.find((f) => f.id === id);
    const preview = (item?.message || '').trim().slice(0, 120);

    const ok = confirm(
      `Feedback wirklich löschen?${preview ? `\n\n„${preview}${item?.message && item.message.length > 120 ? '…' : ''}“` : ''}`
    );
    if (!ok) return;

    try {
      setDeletingId(id);
      setError('');
      await api.admin.deleteFeedback(id);
      setFeedback((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen des Feedbacks');
    } finally {
      setDeletingId(null);
    }
  };

  const visibleRows = useMemo(() => feedback, [feedback]);

  return (
    <div className="admin-dashboard">
      <main className="admin-main">
        <div className="admin-section-header">
          <h2>Feedback (anonym)</h2>
          <div className="admin-feedback-actions">
            <button type="button" className="btn-secondary btn-secondary--sm" onClick={loadFeedback} disabled={loading}>
              {loading ? 'Laden…' : 'Aktualisieren'}
            </button>
          </div>
        </div>

        {user?.role !== 'admin' ? (
          <div className="admin-error">Nur Admins können Feedback einsehen.</div>
        ) : error ? (
          <div className="admin-error">{error}</div>
        ) : loading ? (
          <div className="teacher-form-container">
            <div style={{ color: '#4b5563' }}>Lade Feedback…</div>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="teacher-form-container">
            <div style={{ color: '#4b5563' }}>Noch kein Feedback vorhanden.</div>
          </div>
        ) : (
          <div className="teacher-form-container">
            <div className="bookings-table-container" style={{ marginTop: 10 }}>
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Nachricht</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((f) => (
                    <tr key={f.id}>
                      <td>{formatDateTime(f.created_at) || f.created_at}</td>
                      <td className="message-cell">{f.message}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() => handleDelete(f.id)}
                          disabled={deletingId === f.id}
                          title="Feedback löschen"
                        >
                          {deletingId === f.id ? 'Löschen…' : 'Löschen'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
