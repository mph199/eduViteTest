import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { useActiveView } from '../hooks/useActiveView';
import { useBgStyle } from '../hooks/useBgStyle';
import api from '../services/api';
import type { FeedbackItem } from '../types';
import { formatDateTime } from '../utils/formatters';
import './AdminDashboard.css';

export function AdminFeedback() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { user } = useAuth();
  useActiveView('admin');
  const adminBgStyle = useBgStyle('admin', '--page-bg');

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

  return (
    <div className="admin-dashboard admin-dashboard--admin page-bg-overlay page-bg-overlay--subtle" style={adminBgStyle}>
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
            <div style={{ color: 'var(--color-gray-600)' }}>Lade Feedback…</div>
          </div>
        ) : feedback.length === 0 ? (
          <div className="teacher-form-container">
            <div style={{ color: 'var(--color-gray-600)' }}>Noch kein Feedback vorhanden.</div>
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
                  {feedback.map((f) => (
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
