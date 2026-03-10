import { useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';

/**
 * Sets the active view ('admin' | 'teacher') for users that can switch
 * between admin and teacher perspectives (i.e. admins with a teacherId).
 */
export function useActiveView(view: 'admin' | 'teacher') {
  const { user, setActiveView } = useAuth();
  const canSwitchView = Boolean(
    (user?.role === 'admin' || user?.role === 'superadmin') && user.teacherId,
  );

  useEffect(() => {
    if (!canSwitchView) return;
    queueMicrotask(() => setActiveView(view));
  }, [canSwitchView, setActiveView, view]);
}
