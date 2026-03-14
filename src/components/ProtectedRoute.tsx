import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#2d5016'
      }}>
        Lädt...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role-based gating: redirect SSW users to their area
  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    if (user.role === 'ssw') {
      return <Navigate to="/admin/ssw" replace />;
    }
    if (user.role === 'beratungslehrer') {
      return <Navigate to="/admin/beratungslehrer" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
