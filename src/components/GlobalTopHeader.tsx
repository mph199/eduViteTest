import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { SidebarProfile } from './SidebarProfile';
import { NotificationBell } from './NotificationBell';
import { ViewSwitcher } from './ViewSwitcher';
import { CollapsibleNavGroup } from './CollapsibleNavGroup';
import { useAuth } from '../contexts/useAuth';
import { useBranding } from '../contexts/BrandingContext';
import api from '../services/api';
import { getAvatarInitial, getAvatarColor } from '../utils/avatarColor';
import { modules } from '../modules/registry';
import type { SidebarNavItem } from '../modules/registry';
import { useModuleConfig } from '../contexts/ModuleConfigContext';
import type { ActiveView } from '../types';
import './GlobalTopHeader.css';

interface NavGroup {
  label: string;
  accentRgb?: string;
  view?: ActiveView;
  items: { path: string; label: string }[];
}

export function GlobalTopHeader() {
  const headerRef = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, activeView, setActiveView } = useAuth();
  const { branding } = useBranding();
  const { isModuleEnabled } = useModuleConfig();
  const activeModules = useMemo(() => modules.filter((m) => isModuleEnabled(m.id)), [isModuleEnabled]);

  const pathname = location.pathname;
  const onLogin = pathname === '/login' || pathname === '/login/';
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/superadmin' || pathname.startsWith('/superadmin/');
  const inTeacher = pathname === '/teacher' || pathname.startsWith('/teacher/');
  const showAreaMenu = Boolean(isAuthenticated && (inAdmin || inTeacher));
  const showModuleTitle = !onLogin && !inAdmin && !inTeacher;

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperadmin = user?.role === 'superadmin';
  const hasTeacherId = Boolean(user?.teacherId);
  const userModules = user?.modules || [];

  const hasModuleAccess = (moduleKey?: string) => {
    if (!moduleKey) return isAdmin;
    return isAdmin || userModules.includes(moduleKey);
  };

  // View switcher options (only for admin users who are also teachers)
  const viewSwitcherOptions = useMemo(() => {
    if (!user) return null;
    if (isAdmin && hasTeacherId) {
      return [
        { value: 'admin' as ActiveView, label: 'Admin' },
        { value: 'teacher' as ActiveView, label: 'Lehrkraft' },
      ];
    }
    return null;
  }, [user, isAdmin, hasTeacherId]);

  const handleViewChange = useCallback((next: ActiveView) => {
    setActiveView(next);
    if (next === 'admin') navigate('/admin');
    else if (next === 'teacher') navigate('/teacher');
  }, [setActiveView, navigate]);

  // Find which module the user is currently viewing (public page)
  const activeModule = useMemo(() => {
    if (!showModuleTitle) return null;
    return activeModules.find((m) => pathname === m.basePath || pathname === m.basePath + '/') ?? null;
  }, [pathname, showModuleTitle, activeModules]);

  // Build navigation groups for the slide-out sidebar
  const navGroups = useMemo(() => {
    const groups: NavGroup[] = [];

    // Dashboard (admin/superadmin only)
    if (isAdmin) {
      groups.push({
        label: '',
        view: 'admin',
        items: [{ path: '/admin', label: 'Übersicht' }],
      });
    }

    // Module groups from registry
    for (const mod of activeModules) {
      if (!mod.sidebarNav) continue;
      if (!hasModuleAccess(mod.requiredModule)) continue;

      const visibleItems = mod.sidebarNav.items.filter((item: SidebarNavItem) => {
        if (!item.roles) return true;
        return user?.role ? item.roles.includes(user.role) : false;
      });

      if (visibleItems.length > 0) {
        // Modules with requiredModule are visible in all views (no view filter),
        // generic admin modules are restricted to admin view
        groups.push({
          label: mod.sidebarNav.label,
          accentRgb: mod.accentRgb,
          ...(mod.requiredModule ? {} : { view: 'admin' as ActiveView }),
          items: visibleItems,
        });
      }
    }

    // Core admin group (admin/superadmin only)
    if (isAdmin) {
      groups.push({
        label: 'Verwaltung',
        view: 'admin',
        items: [
          { path: '/admin/teachers', label: 'Benutzer & Rechte' },
        ],
      });
    }

    // Teacher section (if user has a teacherId)
    if (hasTeacherId) {
      groups.push({
        label: 'Lehrkraft',
        accentRgb: '26, 127, 122', // Petrol (Elternsprechtag)
        view: 'teacher',
        items: [
          { path: '/teacher', label: 'Übersicht' },
          { path: '/teacher/requests', label: 'Anfragen' },
          { path: '/teacher/bookings', label: 'Buchungen' },
        ],
      });
    }

    // Superadmin (always visible, no view restriction)
    if (isSuperadmin) {
      groups.push({
        label: '',
        items: [{ path: '/superadmin', label: 'Superadmin' }],
      });
    }

    return groups;
  }, [isAdmin, isSuperadmin, hasTeacherId, userModules, user?.role, activeModules]);

  // Filter groups by active view (always applies when activeView is set)
  const filteredGroups = useMemo(() => {
    if (!activeView) return navGroups;
    return navGroups.filter((g) => !g.view || g.view === activeView);
  }, [navGroups, activeView]);

  const isActive = (path: string) => {
    if (path === '/admin') return pathname === '/admin' || pathname === '/admin/';
    if (path === '/teacher') return pathname === '/teacher' || pathname === '/teacher/';
    return pathname === path || pathname.startsWith(path + '/');
  };

  const userLabel = user?.fullName || user?.username;

  const areaLabel = useMemo(() => {
    if (!showAreaMenu) return null;

    if (inTeacher) {
      if (pathname === '/teacher' || pathname === '/teacher/') return 'Lehrkraft · Übersicht';
      if (pathname.includes('/teacher/requests')) return 'Lehrkraft · Anfragen verwalten';
      if (pathname.includes('/teacher/bookings')) return 'Lehrkraft · Meine Buchungen';
      if (pathname.includes('/teacher/password')) return 'Lehrkraft · Passwort ändern';
      if (pathname.startsWith('/teacher/flow')) return 'Flow';
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
  }, [inTeacher, pathname, showAreaMenu, navGroups]);

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
      className={`globalTopHeader${showModuleTitle ? ' globalTopHeader--public' : ''}${showAreaMenu ? ' globalTopHeader--area' : ''}`}
      aria-label={`${branding.school_name} Buchungssystem`}
    >
      <div className="globalTopHeader__inner">
        <div className="globalTopHeader__left">
          {showAreaMenu ? (
            <Sidebar
              label="Menü"
              ariaLabel="Menü"
              variant="icon"
              side="left"
              noWrapper
              buttonClassName="globalTopHeader__menuButton"
              footer={
                user ? (
                  <SidebarProfile
                    user={user}
                    onLogout={() => { void (async () => { await logout(); navigate('/login'); })(); }}
                    onNavigate={(path) => navigate(path)}
                  />
                ) : undefined
              }
            >
              {({ close }) => (
                <>
                  {viewSwitcherOptions && activeView && (
                    <ViewSwitcher
                      options={viewSwitcherOptions}
                      activeValue={activeView}
                      onChange={handleViewChange}
                    />
                  )}

                  {filteredGroups.map((group, gi) => (
                    <div key={group.label || group.items[0]?.path || gi}>
                      {gi > 0 && <div className="dropdown__divider" role="separator" />}
                      <CollapsibleNavGroup
                        label={group.label}
                        accentRgb={group.accentRgb}
                      >
                        {group.items.map(item => (
                          <button
                            key={item.path}
                            type="button"
                            className={isActive(item.path) ? 'dropdown__item dropdown__item--active' : 'dropdown__item'}
                            onClick={() => { navigate(item.path); close(); }}
                          >
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </CollapsibleNavGroup>
                    </div>
                  ))}
                </>
              )}
            </Sidebar>
          ) : null}

          <div className="globalTopHeader__brand" aria-label={`${branding.school_name} Buchungssystem`}>
            {branding.logo_url && (
              <img
                src={api.superadmin.resolveLogoUrl(branding.logo_url)}
                alt=""
                className="globalTopHeader__logo"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div>
              <div className="globalTopHeader__brandTop" style={branding.header_font_color ? { color: branding.header_font_color } : undefined}>{branding.school_name}</div>
              <div className="globalTopHeader__brandBottom">Buchungssystem</div>
            </div>
          </div>

          {showModuleTitle && activeModule ? <div className="globalTopHeader__moduleTitle">{activeModule.title}</div> : null}

          {areaLabel ? <div className="globalTopHeader__areaLabel">{areaLabel}</div> : null}
        </div>

        <div className="globalTopHeader__right">
          {showAreaMenu ? (
            <>
              <NotificationBell />
            </>
          ) : !onLogin ? (
            isAuthenticated ? (
              <Link className="globalTopHeader__loginStatus" to="/teacher" aria-label={`Angemeldet${userLabel ? ` als ${userLabel}` : ''} -- Zum internen Bereich`}>
                <span
                  className="globalTopHeader__avatar"
                  style={{ background: getAvatarColor(user?.username || '') }}
                  aria-hidden="true"
                >
                  {getAvatarInitial(user?.fullName, user?.username)}
                </span>
              </Link>
            ) : (
              <Link className="globalTopHeader__login" to="/login">
                Login
              </Link>
            )
          ) : null}
        </div>
      </div>
    </header>
  );
}
