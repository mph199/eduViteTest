import { useCallback, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import { AuthContext } from './AuthContextBase.ts';
import type { User, ActiveView } from './AuthContextBase.ts';
import { teacherPersonName } from '../utils/teacherDisplayName.ts';

// AuthContext wird in `AuthContextBase.ts` definiert

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveViewState] = useState<ActiveView | null>(null);

  const VIEW_KEY = 'active_view';

  const readStoredView = useCallback((): ActiveView | null => {
    const raw = localStorage.getItem(VIEW_KEY);
    if (raw === 'admin' || raw === 'teacher' || raw === 'beratungslehrer') return raw;
    return null;
  }, []);

  const isAdminLike = (role: string) => role === 'admin' || role === 'superadmin' || role === 'ssw';

  const hasModule = (u: User, key: string) =>
    u.role === 'admin' || u.role === 'superadmin' || (Array.isArray(u.modules) && u.modules.includes(key));

  const computeInitialView = useCallback((u: User): ActiveView => {
    if (u.role === 'teacher') {
      const stored = readStoredView();
      // Teacher with BL module access: respect stored view
      if (stored && hasModule(u, 'beratungslehrer') && stored === 'beratungslehrer') return stored;
      return 'teacher';
    }
    if (isAdminLike(u.role) && u.teacherId) {
      return readStoredView() ?? 'admin';
    }
    return 'admin';
  }, [readStoredView]);

  const setActiveView = (next: ActiveView) => {
    if (user) {
      const canTeacher = Boolean(user.teacherId) && (user.role === 'teacher' || isAdminLike(user.role));
      if (next === 'teacher' && !canTeacher) return;
      if (next === 'admin' && !isAdminLike(user.role)) return;
      if (next === 'beratungslehrer' && !hasModule(user, 'beratungslehrer')) return;
    }

    setActiveViewState(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  // Check authentication status on mount
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const response = await api.auth.verify();
        if (response.authenticated && response.user) {
          let nextUser = response.user as User;

          if (nextUser.teacherId) {
            try {
              const teacher = await api.teacher.getInfo();
              if (teacher?.name) {
                const fullName = teacherPersonName(teacher);
                if (fullName) nextUser = { ...nextUser, fullName };
              }
            } catch {
              // ignore (not all roles/tokens can access teacher info)
            }
          }

          setIsAuthenticated(true);
          setUser(nextUser);
          setActiveViewState(computeInitialView(nextUser));
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setActiveViewState(null);
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        setIsAuthenticated(false);
        setUser(null);
        setActiveViewState(null);
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, [computeInitialView]);

  // Sofortige Reaktion auf 401-Events aus dem API-Client
  useEffect(() => {
    const onForcedLogout = () => {
      setIsAuthenticated(false);
      setUser(null);
      setActiveViewState(null);
    };
    window.addEventListener('auth:logout', onForcedLogout);
    return () => window.removeEventListener('auth:logout', onForcedLogout);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await api.auth.login(username, password);
      if (response.success && response.user) {
        let nextUser = response.user as User;

        if (nextUser.teacherId) {
          try {
            const teacher = await api.teacher.getInfo();
            if (teacher?.name) {
              const fullName = teacherPersonName(teacher);
              if (fullName) nextUser = { ...nextUser, fullName };
            }
          } catch {
            // ignore
          }
        }

        setIsAuthenticated(true);
        setUser(nextUser);
        setActiveViewState(computeInitialView(nextUser));
        return nextUser;
      }
      throw new Error('Login fehlgeschlagen');
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      setActiveViewState(null);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      setActiveViewState(null);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, activeView, setActiveView, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook ausgelagert in separate Datei `useAuth.ts` für besseres Fast Refresh
