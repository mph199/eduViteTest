import { useCallback, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import { AuthContext } from './AuthContextBase.ts';
import type { User, ActiveView } from '../types';
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
    if (raw === 'admin' || raw === 'teacher') return raw;
    return null;
  }, []);

  const isAdminLike = (u: User | { role: string; modules?: string[]; adminModules?: string[] }) =>
    u.role === 'admin' || u.role === 'superadmin' ||
    (Array.isArray(u.adminModules) && u.adminModules.length > 0) ||
    (Array.isArray(u.modules) && (u.modules.includes('schulsozialarbeit') || u.modules.includes('beratungslehrer')));

  const computeInitialView = useCallback((u: User): ActiveView => {
    if (u.role === 'teacher' && !isAdminLike(u)) {
      return 'teacher';
    }
    if (isAdminLike(u) && u.teacherId) {
      return readStoredView() ?? 'admin';
    }
    if (isAdminLike(u)) return 'admin';
    return 'teacher';
  }, [readStoredView]);

  const setActiveView = (next: ActiveView) => {
    if (user) {
      const canTeacher = Boolean(user.teacherId) || user.role === 'teacher';
      if (next === 'teacher' && !canTeacher) return;
      if (next === 'admin' && !isAdminLike(user)) return;
    }

    setActiveViewState(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  async function enrichWithTeacherName(baseUser: User): Promise<User> {
    if (!baseUser.teacherId) return baseUser;
    try {
      const teacher = await api.teacher.getInfo();
      if (teacher?.name) {
        const fullName = teacherPersonName(teacher);
        if (fullName) return { ...baseUser, fullName };
      }
    } catch {
      // ignore (not all roles/tokens can access teacher info)
    }
    return baseUser;
  }

  // Check authentication status on mount
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const response = await api.auth.verify();
        if (response.authenticated && response.user) {
          const nextUser = await enrichWithTeacherName(response.user as User);
          setIsAuthenticated(true);
          setUser(nextUser);
          setActiveViewState(computeInitialView(nextUser));
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setActiveViewState(null);
        }
      } catch {
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
        const nextUser = await enrichWithTeacherName(response.user as User);
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

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Logout failure is non-critical – state is reset in finally
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      setActiveViewState(null);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, activeView, setActiveView, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook ausgelagert in separate Datei `useAuth.ts` für besseres Fast Refresh
