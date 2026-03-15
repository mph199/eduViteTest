import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { modules } from '../modules/registry';
import './AdminSidebar.css';

interface NavItem {
  path: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface AdminSidebarProps {
  mobile?: boolean;
  open?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ mobile = false, open = false, onClose }: AdminSidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperadmin = user?.role === 'superadmin';
  const hasTeacherId = Boolean(user?.teacherId);
  const userModules = user?.modules || [];

  const hasModuleAccess = (moduleKey?: string) => {
    if (!moduleKey) return isAdmin;
    return isAdmin || userModules.includes(moduleKey);
  };

  const navGroups = useMemo(() => {
    const groups: NavGroup[] = [];

    // Dashboard (admin/superadmin only)
    if (isAdmin) {
      groups.push({
        label: '',
        items: [{ path: '/admin', label: 'Uebersicht' }],
      });
    }

    // Module groups from registry
    for (const mod of modules) {
      if (!mod.sidebarNav) continue;
      if (!hasModuleAccess(mod.requiredModule)) continue;

      const visibleItems = mod.sidebarNav.items.filter(item => {
        if (!item.roles) return true;
        return user?.role ? item.roles.includes(user.role) : false;
      });

      if (visibleItems.length > 0) {
        groups.push({
          label: mod.sidebarNav.label,
          items: visibleItems,
        });
      }
    }

    // Core admin group (admin/superadmin only)
    if (isAdmin) {
      groups.push({
        label: 'Verwaltung',
        items: [
          { path: '/admin/teachers', label: 'Benutzer & Rechte' },
          { path: '/admin/feedback', label: 'Feedback' },
        ],
      });
    }

    // Teacher section (if user has a teacherId)
    if (hasTeacherId) {
      groups.push({
        label: 'Lehrkraft',
        items: [
          { path: '/teacher', label: 'Uebersicht' },
          { path: '/teacher/requests', label: 'Anfragen' },
          { path: '/teacher/bookings', label: 'Buchungen' },
          { path: '/teacher/password', label: 'Passwort aendern' },
          { path: '/teacher/feedback', label: 'Feedback' },
        ],
      });
    }

    // Superadmin
    if (isSuperadmin) {
      groups.push({
        label: '',
        items: [{ path: '/superadmin', label: 'Superadmin' }],
      });
    }

    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isSuperadmin, hasTeacherId, userModules.join(','), user?.role]);

  const isActive = (path: string) => {
    if (path === '/admin') return pathname === '/admin' || pathname === '/admin/';
    if (path === '/teacher') return pathname === '/teacher' || pathname === '/teacher/';
    return pathname === path || pathname.startsWith(path + '/');
  };

  const handleNav = (path: string) => {
    navigate(path);
    onClose?.();
  };

  const handleLogout = async () => {
    onClose?.();
    await logout();
    navigate('/login');
  };

  const closeIcon = (
    <svg viewBox="0 0 20 20" width="20" height="20" focusable="false" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  const content = (
    <>
      {navGroups.map((group, gi) => (
        <div key={gi} className="adminSidebar__group">
          {gi > 0 && <div className="adminSidebar__divider" role="separator" />}
          {group.label && <div className="adminSidebar__groupLabel">{group.label}</div>}
          {group.items.map(item => (
            <button
              key={item.path}
              type="button"
              className={`adminSidebar__item${isActive(item.path) ? ' adminSidebar__item--active' : ''}`}
              onClick={() => handleNav(item.path)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}

      <div className="adminSidebar__spacer" />

      <div className="adminSidebar__group">
        <div className="adminSidebar__divider" role="separator" />
        <button type="button" className="adminSidebar__item" onClick={() => handleNav('/')}>
          Zur Buchungsseite
        </button>
        <button type="button" className="adminSidebar__item adminSidebar__item--danger" onClick={handleLogout}>
          Abmelden
        </button>
      </div>
    </>
  );

  if (mobile) {
    return (
      <>
        <div
          className={`adminSidebar__overlay${open ? ' adminSidebar__overlay--open' : ''}`}
          onClick={onClose}
        />
        <nav
          className={`adminSidebar--mobile${open ? ' adminSidebar--open' : ''}`}
          aria-label="Navigation"
        >
          <div className="adminSidebar__mobileHeader">
            <span className="adminSidebar__mobileTitle">Navigation</span>
            <button
              type="button"
              className="adminSidebar__mobileClose"
              onClick={onClose}
              aria-label="Schliessen"
            >
              {closeIcon}
            </button>
          </div>
          {content}
        </nav>
      </>
    );
  }

  return (
    <nav className="adminSidebar" aria-label="Navigation">
      {content}
    </nav>
  );
}
