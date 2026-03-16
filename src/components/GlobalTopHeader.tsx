import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../contexts/useAuth';
import { useBranding } from '../contexts/BrandingContext';
import { modules } from '../modules/registry';
import type { SidebarNavItem } from '../modules/registry';
import './GlobalTopHeader.css';

interface NavGroup {
  label: string;
  accentRgb?: string;
  items: { path: string; label: string }[];
}

export function GlobalTopHeader() {
  const headerRef = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { branding } = useBranding();

  const pathname = location.pathname;
  const onLogin = pathname === '/login' || pathname === '/login/';
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/superadmin' || pathname.startsWith('/superadmin/');
  const inTeacher = pathname === '/teacher' || pathname.startsWith('/teacher/');
  const showAreaMenu = Boolean(isAuthenticated && (inAdmin || inTeacher));
  const showModuleTitle = !onLogin && !inAdmin && !inTeacher;

  const isPublic = showModuleTitle;
  const isArea = showAreaMenu;

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperadmin = user?.role === 'superadmin';
  const hasTeacherId = Boolean(user?.teacherId);
  const userModules = user?.modules || [];

  const hasModuleAccess = (moduleKey?: string) => {
    if (!moduleKey) return isAdmin;
    return isAdmin || userModules.includes(moduleKey);
  };

  // Find which module the user is currently viewing (public page)
  const activeModule = useMemo(() => {
    if (!showModuleTitle) return null;
    return modules.find((m) => pathname === m.basePath || pathname === m.basePath + '/') ?? null;
  }, [pathname, showModuleTitle]);

  // Build navigation groups for the slide-out sidebar
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

      const visibleItems = mod.sidebarNav.items.filter((item: SidebarNavItem) => {
        if (!item.roles) return true;
        return user?.role ? item.roles.includes(user.role) : false;
      });

      if (visibleItems.length > 0) {
        groups.push({
          label: mod.sidebarNav.label,
          accentRgb: mod.accentRgb,
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

  const userLabel = user?.fullName || user?.username;

  const areaLabel = useMemo(() => {
    if (!isArea) return null;

    if (inTeacher) {
      if (pathname === '/teacher' || pathname === '/teacher/') return 'Lehrkraft · Uebersicht';
      if (pathname.includes('/teacher/requests')) return 'Lehrkraft · Anfragen verwalten';
      if (pathname.includes('/teacher/bookings')) return 'Lehrkraft · Meine Buchungen';
      if (pathname.includes('/teacher/password')) return 'Lehrkraft · Passwort aendern';
      if (pathname.includes('/teacher/feedback')) return 'Lehrkraft · Feedback senden';
      return 'Lehrkraft';
    }

    // For admin area, derive label from nav groups
    for (const group of navGroups) {
      for (const item of group.items) {
        if (isActive(item.path)) {
          const prefix = group.label || '';
          return prefix ? `${prefix} · ${item.label}` : item.label;
        }
      }
    }

    return null;
  }, [inTeacher, pathname, isArea, navGroups]);

  useEffect(() => {
    const element = headerRef.current;
    if (!element) return;

    const setHeightVar = () => {
      const height = element.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--globalTopHeaderHeight', `${Math.round(height)}px`);
    };

    setHeightVar();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => setHeightVar());
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', setHeightVar);
    return () => window.removeEventListener('resize', setHeightVar);
  }, []);

  return (
    <header
      ref={headerRef}
      className={`globalTopHeader${isPublic ? ' globalTopHeader--public' : ''}${isArea ? ' globalTopHeader--area' : ''}`}
      aria-label={`${branding.school_name} Buchungssystem`}
    >
      <div className="globalTopHeader__inner">
        <div className="globalTopHeader__left">
          {showAreaMenu ? (
            <Sidebar
              label="Menue"
              ariaLabel="Menue"
              variant="icon"
              side="left"
              noWrapper
              buttonClassName="globalTopHeader__menuButton"
              footer={
                inTeacher ? (
                  <div className="dropdown__note" role="note">
                    Bei technischen Anliegen wendet euch gerne an HUM (
                    <a href="mailto:marc.huhn@bksb.nrw">marc.huhn@bksb.nrw</a>)
                  </div>
                ) : undefined
              }
            >
              {({ close }) => (
                <>
                  {navGroups.map((group, gi) => (
                    <div
                      key={gi}
                      style={group.accentRgb ? { '--group-accent-rgb': group.accentRgb } as React.CSSProperties : undefined}
                    >
                      {gi > 0 && <div className="dropdown__divider" role="separator" />}
                      {group.label && <div className="dropdown__sectionTitle">{group.label}</div>}
                      {group.items.map(item => (
                        <button
                          key={item.path}
                          type="button"
                          className={isActive(item.path) ? 'dropdown__item dropdown__item--active' : 'dropdown__item'}
                          onClick={() => { navigate(item.path); close(); }}
                        >
                          <span>{item.label}</span>
                          {isActive(item.path) && <span className="dropdown__hint">Aktiv</span>}
                        </button>
                      ))}
                    </div>
                  ))}

                  <div className="dropdown__divider" role="separator" />
                  <button
                    type="button"
                    className="dropdown__item"
                    onClick={() => { navigate('/'); close(); }}
                  >
                    <span>Zur Buchungsseite</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown__item dropdown__item--danger"
                    onClick={() => { close(); void (async () => { await logout(); navigate('/login'); })(); }}
                  >
                    <span>Abmelden</span>
                  </button>
                </>
              )}
            </Sidebar>
          ) : null}

          <div className="globalTopHeader__brand" aria-label={`${branding.school_name} Buchungssystem`}>
            <div className="globalTopHeader__brandTop" style={branding.header_font_color ? { color: branding.header_font_color } : undefined}>{branding.school_name}</div>
            <div className="globalTopHeader__brandBottom">Buchungssystem</div>
          </div>

          {showModuleTitle && activeModule ? <div className="globalTopHeader__moduleTitle">{activeModule.title}</div> : null}

          {areaLabel ? <div className="globalTopHeader__areaLabel">{areaLabel}</div> : null}
        </div>

        <div className="globalTopHeader__right">
          {isArea ? (
            <>
              <NotificationBell />
              <div className="globalTopHeader__user" aria-label="Angemeldeter Benutzer">
                Angemeldet als{userLabel ? (
                  <>
                    : <strong>{userLabel}</strong>
                  </>
                ) : null}
              </div>
            </>
          ) : !onLogin ? (
            <Link className="globalTopHeader__login" to="/login">
              Login
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
