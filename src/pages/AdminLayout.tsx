import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import './AdminDashboard.css';

export function AdminLayout() {
  const { user, setActiveView } = useAuth();

  const canSwitchView = Boolean(user?.role === 'admin' && user.teacherId);

  useEffect(() => {
    if (canSwitchView) setActiveView('admin');
  }, [canSwitchView, setActiveView]);

  return (
    <div className="admin-dashboard admin-dashboard--admin">
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
