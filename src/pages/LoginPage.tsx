import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useBgStyle } from '../hooks/useBgStyle';
import api from '../services/api';
import { API_BASE } from '../services/apiBase';
import type { OAuthProvider } from '../types';
import './LoginPage.css';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  provider_not_found: 'Anmeldedienst nicht gefunden.',
  oauth_state_mismatch: 'Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen.',
  oauth_denied: 'Anmeldung beim Anbieter abgelehnt.',
  oauth_no_account: 'Kein Konto gefunden. Bitte wenden Sie sich an die Administration.',
  oauth_domain_blocked: 'Ihre E-Mail-Domain ist nicht freigeschaltet.',
  oauth_error: 'Fehler bei der Anmeldung. Bitte erneut versuchen.',
  oauth_missing_params: 'Unvollstaendige Anmeldedaten. Bitte erneut versuchen.',
  oauth_state_invalid: 'Sitzung abgelaufen. Bitte erneut versuchen.',
  account_locked: 'Konto gesperrt. Bitte spaeter erneut versuchen.',
};

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginBgStyle = useBgStyle('login', '--page-bg');

  // Load OAuth providers and handle error from callback redirect
  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError && OAUTH_ERROR_MESSAGES[oauthError]) {
      setError(OAUTH_ERROR_MESSAGES[oauthError]);
    }
    api.auth.getProviders().then((p) => setProviders(p));
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const u = await login(username, password);
      // Alle Rollen landen nach Login in der Lehrkräfte-Übersicht
      if (u) {
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
    <div className="login-page page-bg-overlay" style={loginBgStyle}>
      <div className="login-container" role="main" aria-label="Login">
        <div className="login-header">
          <h1 className="login-title">Login für Beschäftigte der Schule</h1>
          <div className="login-subtitle">Für Lehrkräfte und Administration</div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">E-Mail oder Benutzername</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="name@schule.de oder Benutzername"
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

        {providers.length > 0 && (
          <div className="login-oauth">
            <div className="login-oauth__divider">
              <span>oder</span>
            </div>
            {providers.map((p) => (
              <a
                key={p.providerKey}
                href={`${API_BASE}/auth/oauth/${p.providerKey}`}
                className="login-oauth__button"
              >
                {p.displayName}
              </a>
            ))}
          </div>
        )}

        <div className="login-footer">
          <Link to="/" className="back-link">← Zurück zur Buchungsseite</Link>
        </div>
      </div>
    </div>
  );
}
