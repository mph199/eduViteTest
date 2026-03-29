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
import { useAdminNavGroups } from '../hooks/useAdminNavGroups';
import type { ActiveView } from '../types';
import './GlobalTopHeader.css';

export function GlobalTopHeader() {
  const headerRef = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, activeView, setActiveView } = useAuth();
  const { branding } = useBranding();

  // Shared navigation logic (same source for sidebar + drawer)
  const { filteredGroups, isActive, isAdminOrModuleAdmin, hasTeacherId, activeModules, getViewChangeTarget } = useAdminNavGroups();

  const pathname = location.pathname;
  const onLogin = pathname === '/login' || pathname === '/login/';
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/superadmin' || pathname.startsWith('/superadmin/');
  const inTeacher = pathname === '/teacher' || pathname.startsWith('/teacher/');
  const showAreaMenu = Boolean(isAuthenticated && (inAdmin || inTeacher));
  const showModuleTitle = !onLogin && !inAdmin && !inTeacher;

  // View switcher options (admin/module-admin users who are also teachers)
  const viewSwitcherOptions = useMemo(() => {
    if (!user) return null;
    if (isAdminOrModuleAdmin && hasTeacherId) {
      return [
        { value: 'admin' as ActiveView, label: 'Admin' },
        { value: 'teacher' as ActiveView, label: 'Lehrkraft' },
      ];
    }
    return null;
  }, [user, isAdminOrModuleAdmin, hasTeacherId]);

  const handleViewChange = useCallback((next: ActiveView) => {
    setActiveView(next);
    navigate(getViewChangeTarget(next));
  }, [setActiveView, navigate, getViewChangeTarget]);

  // Find which module the user is currently viewing (public page)
  const activeModule = useMemo(() => {
    if (!showModuleTitle) return null;
    return activeModules.find((m) => pathname === m.basePath || pathname === m.basePath + '/') ?? null;
  }, [pathname, showModuleTitle, activeModules]);

  // areaLabel for mobile (hidden on desktop via CSS)
  const navGroups = filteredGroups;
  const areaLabel = useMemo(() => {
    if (!showAreaMenu) return null;

    if (inTeacher) {
      if (pathname === '/teacher' || pathname === '/teacher/') return 'Lehrkraft';
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
  }, [inTeacher, pathname, showAreaMenu, navGroups, isActive]);

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
              <Link className="globalTopHeader__loginStatus" to="/teacher" aria-label={`Angemeldet${user?.fullName || user?.username ? ` als ${user?.fullName || user?.username}` : ''} -- Zum internen Bereich`}>
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
