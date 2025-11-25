import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { api } from '../services/api';
import type { ApiBooking } from '../services/api';
import './AdminDashboard.css';

export function AdminDashboard() {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.admin.getBookings();
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Buchungen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancelBooking = async (slotId: number) => {
    if (!confirm('Möchten Sie diese Buchung wirklich stornieren?')) {
      return;
    }

    try {
      await api.admin.cancelBooking(slotId);
      await loadBookings(); // Reload bookings after cancellation
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Stornieren');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Laden...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <div>
            <h1>BKSB Elternsprechtag Admin</h1>
            <p className="admin-user">Angemeldet als: <strong>{user?.username}</strong></p>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Abmelden
          </button>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-stats">
          <div className="stat-card">
            <div className="stat-value">{bookings.length}</div>
            <div className="stat-label">Gebuchte Termine</div>
          </div>
        </div>

        {error && (
          <div className="admin-error">
            {error}
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="no-bookings">
            <p>Keine Buchungen vorhanden.</p>
            <a href="/" className="back-to-booking">Zur Buchungsseite</a>
          </div>
        ) : (
          <div className="bookings-table-container">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Lehrkraft</th>
                  <th>Fach</th>
                  <th>Datum</th>
                  <th>Zeit</th>
                  <th>Eltern</th>
                  <th>Schüler/in</th>
                  <th>Klasse</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="teacher-name">{booking.teacherName}</td>
                    <td>{booking.teacherSubject}</td>
                    <td>{booking.date}</td>
                    <td>{booking.time}</td>
                    <td>{booking.parentName}</td>
                    <td>{booking.studentName}</td>
                    <td>{booking.className}</td>
                    <td>
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        className="cancel-button"
                      >
                        Stornieren
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
