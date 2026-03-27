import { useState, useEffect, useCallback } from 'react';
import type { CounselorAppointment as Appointment } from '../../types';
import { BookingCard, type BookingCardAccent } from './BookingCard';
import './BookingCard.css';

interface CounselorAnfragenConfig {
  getAppointments: (params: { status: string }) => Promise<{ appointments?: Appointment[] }>;
  confirmAppointment: (id: number) => Promise<unknown>;
  cancelAppointment: (id: number) => Promise<unknown>;
  accent?: BookingCardAccent;
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
        <div className="booking-card-grid">
          {requests.map(a => {
            const displayName = [a.first_name, a.last_name].filter(Boolean).join(' ') || '--';
            return (
              <BookingCard
                key={a.id}
                date={a.date}
                time={a.time}
                durationMinutes={a.duration_minutes || 30}
                visitorName={displayName}
                studentInfo={a.student_class ? `Klasse: ${a.student_class}` : undefined}
                status={a.status}
                accent={config.accent || 'default'}
                onConfirm={a.status === 'requested' ? () => handleConfirm(a.id) : undefined}
                onCancel={(a.status === 'requested' || a.status === 'confirmed') ? () => handleCancel(a.id) : undefined}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
