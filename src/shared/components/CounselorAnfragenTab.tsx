import { useState, useEffect, useCallback } from 'react';
import type { CounselorAppointment as Appointment } from '../../types';
import { normalizeDate } from '../utils/appointmentDate';
import { statusLabel } from '../utils/statusLabel';

interface CounselorAnfragenConfig {
  getAppointments: (params: { status: string }) => Promise<{ appointments?: Appointment[] }>;
  confirmAppointment: (id: number) => Promise<unknown>;
  cancelAppointment: (id: number) => Promise<unknown>;
}

interface Props {
  config: CounselorAnfragenConfig;
  showFlash: (msg: string) => void;
}

export function CounselorAnfragenTab({ config, showFlash }: Props) {
  const [requests, setRequests] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await config.getAppointments({ status: 'requested,confirmed' });
      setRequests(Array.isArray(data?.appointments) ? data.appointments : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleConfirm = async (id: number) => {
    try {
      await config.confirmAppointment(id);
      showFlash('Termin bestätigt.');
      loadRequests();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Termin wirklich absagen?')) return;
    try {
      await config.cancelAppointment(id);
      showFlash('Termin abgesagt.');
      loadRequests();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Fehler');
    }
  };

  return (
    <>
      <div className="admin-section-header">
        <h3>Buchungsanfragen</h3>
      </div>

      {loading ? (
        <p>Lade Anfragen...</p>
      ) : requests.length === 0 ? (
        <div className="info-banner">
          <p>Keine offenen Anfragen vorhanden.</p>
        </div>
      ) : (
        <div className="admin-resp-table-container">
          <table className="admin-resp-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Uhrzeit</th>
                <th>Status</th>
                <th>Name</th>
                <th>Klasse</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(a => {
                const dateStr = normalizeDate(a.date);
                const displayName = [a.first_name, a.last_name].filter(Boolean).join(' ') || '--';
                return (
                  <tr key={a.id}>
                    <td data-label="Datum">{new Date(dateStr + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td data-label="Uhrzeit" className="cell-bold">{a.time?.toString().slice(0, 5)}</td>
                    <td data-label="Status">
                      <span className={`status-pill ${a.status === 'requested' ? 'status-pill--requested' : 'status-pill--confirmed'}`}>
                        {statusLabel(a.status)}
                      </span>
                    </td>
                    <td data-label="Name">{displayName}</td>
                    <td data-label="Klasse">{a.student_class || '--'}</td>
                    <td data-label="Aktionen">
                      <div className="action-btns action-btns--sm">
                        {a.status === 'requested' && (
                          <button className="btn-primary btn--sm"
                            onClick={() => handleConfirm(a.id)}>
                            Bestätigen
                          </button>
                        )}
                        {(a.status === 'requested' || a.status === 'confirmed') && (
                          <button className="btn-secondary btn--sm btn--danger"
                            onClick={() => handleCancel(a.id)}>
                            Absagen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
