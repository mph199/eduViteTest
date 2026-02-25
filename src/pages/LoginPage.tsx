import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import './LoginPage.css';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const u = await login(username, password);
      // Reine Admins (ohne teacherId) → Admin-Dashboard
      // Admins mit teacherId und Teacher → Lehrkräfte-Bereich
      if (u?.role === 'admin' && !u.teacherId) {
        navigate('/admin', { replace: true });
      } else if (u?.role === 'admin' || u?.role === 'teacher') {
        navigate('/teacher', { replace: true });
      } else {
        navigate('/', { replace: true });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container" role="main" aria-label="Login">
        <div className="login-header">
          <h1 className="login-title">Login</h1>
          <div className="login-subtitle">Für Lehrkräfte und Administration</div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Benutzername</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Passwort</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Login läuft...' : 'Login'}
          </button>
        </form>

        <div className="login-footer">
          <Link to="/" className="back-link">← Zurück zur Buchungsseite</Link>
        </div>
      </div>
    </div>
  );
}
