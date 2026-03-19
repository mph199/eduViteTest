import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  allowedModules?: string[];
}

export function ProtectedRoute({ children, allowedRoles, allowedModules }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: 'var(--brand-primary)'
      }}>
        Lädt...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Force password change: alle Rollen werden redirected
  const isPasswordPage = location.pathname === '/teacher/password';
  if (user?.forcePasswordChange && !isPasswordPage) {
    return <Navigate to="/teacher/password" replace />;
  }

  const role = user?.role;
  const modules = user?.modules || [];

  // Admin/Superadmin bypass all role/module checks (incl. /teacher routes).
  // Admins with a teacherId can switch to teacher view via AuthContext.
  if (role === 'admin' || role === 'superadmin') {
    return <>{children}</>;
  }

  // Check module-based access
  if (allowedModules && allowedModules.length > 0) {
    const hasModuleAccess = allowedModules.some(m => modules.includes(m));
    if (hasModuleAccess) return <>{children}</>;
    // Module required but not granted → deny
    if (!allowedRoles) {
      return <Navigate to="/" replace />;
    }
  }

  // Check role-based access
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === 'ssw') {
      return <Navigate to="/admin/ssw" replace />;
    }
    if (role === 'teacher') {
      return <Navigate to="/teacher" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
