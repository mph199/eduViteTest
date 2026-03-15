import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../contexts/useAuth';
import { useBranding } from '../contexts/BrandingContext';
import { modules } from '../modules/registry';
import './GlobalTopHeader.css';

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
  const showAreaMenu = Boolean(isAuthenticated && inTeacher);
  const showAdminHeader = Boolean(isAuthenticated && inAdmin);
  const showModuleTitle = !onLogin && !inAdmin && !inTeacher;

  const isPublic = showModuleTitle;
  const isArea = showAreaMenu || showAdminHeader;

  // Find which module the user is currently viewing (public page)
  const activeModule = useMemo(() => {
    if (!showModuleTitle) return null;
    return modules.find((m) => pathname === m.basePath || pathname === m.basePath + '/') ?? null;
  }, [pathname, showModuleTitle]);

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

    return null;
  }, [inTeacher, pathname, isArea]);

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
          {/* Teacher slide-out sidebar (mobile + desktop) */}
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
                  <div className="dropdown__sectionTitle">Lehrkraft</div>
                  {([
                    ['/teacher', 'Uebersicht'],
                    ['/teacher/requests', 'Anfragen einsehen'],
                    ['/teacher/bookings', 'Meine Buchungen'],
                    ['/teacher/password', 'Passwort aendern'],
                    ['/teacher/feedback', 'Feedback senden'],
                  ] as [string, string][]).map(([path, label]) => (
                    <button
                      key={path}
                      type="button"
                      className={pathname === path ? 'dropdown__item dropdown__item--active' : 'dropdown__item'}
                      onClick={() => { navigate(path); close(); }}
                    >
                      <span>{label}</span>
                      {pathname === path && <span className="dropdown__hint">Aktiv</span>}
                    </button>
                  ))}

                  {/* Link back to admin area if user is admin */}
                  {(user?.role === 'admin' || user?.role === 'superadmin') && (
                    <>
                      <div className="dropdown__divider" role="separator" />
                      <button
                        type="button"
                        className="dropdown__item"
                        onClick={() => { navigate('/admin'); close(); }}
                      >
                        <span>Admin-Bereich</span>
                      </button>
                    </>
                  )}

                  <div className="dropdown__divider" role="separator" />
                  <button type="button" className="dropdown__item" onClick={() => { navigate('/'); close(); }}>
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
