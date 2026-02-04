import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import api from '../../services/api';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { teacherPersonName } from '../../utils/teacherDisplayName';
import '../AdminDashboard.css';

export type TeacherInfo = {
  id: number;
  name: string;
  subject: string;
  system?: string;
  room?: string;
};

export type TeacherOutletContext = {
  teacher: TeacherInfo | null;
  refreshTeacher: () => Promise<void>;
};

function sectionLabelFromPath(pathname: string): string {
  if (pathname.includes('/teacher/password')) return 'Lehrkraft · Passwort ändern';
  if (pathname.includes('/teacher/room')) return 'Lehrkraft · Raum ändern';
  if (pathname.includes('/teacher/feedback')) return 'Lehrkraft · Feedback senden';
  return 'Lehrkraft · Meine Buchungen';
}

export function TeacherLayout() {
  const { user, logout, activeView, setActiveView } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);

  const canSwitchView = Boolean(user?.role === 'admin' && user.teacherId);

  useEffect(() => {
    if (!canSwitchView) return;
    queueMicrotask(() => setActiveView('teacher'));
  }, [canSwitchView, setActiveView]);

  const refreshTeacher = async () => {
    try {
      const t = await api.teacher.getInfo().catch(() => null);
      setTeacher((t as TeacherInfo) || null);
    } catch {
      setTeacher(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await api.teacher.getInfo().catch(() => null);
        if (!cancelled) setTeacher((t as TeacherInfo) || null);
      } catch {
        if (!cancelled) setTeacher(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sectionLabel = useMemo(() => sectionLabelFromPath(location.pathname), [location.pathname]);
  const userLabel = (teacher && teacherPersonName(teacher)) || user?.fullName || user?.username;

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const outletContext: TeacherOutletContext = {
    teacher,
    refreshTeacher,
  };

  return (
    <div className="admin-dashboard admin-dashboard--teacher">
      <Header
        sectionLabel={sectionLabel}
        userLabel={userLabel}
        hint={canSwitchView ? undefined : null}
        menu={
          <Sidebar
            label="Menü"
            ariaLabel="Menü"
            variant="icon"
            side="left"
            noWrapper
            buttonClassName="expHeader__menuLines"
            footer={
              <div className="dropdown__note" role="note">
                Bei technischen Anliegen wendet euch gerne an HUM (
                <a href="mailto:marc.huhn@bksb.nrw">marc.huhn@bksb.nrw</a>)
              </div>
            }
          >
            {({ close }) => (
              <>
                <div className="dropdown__sectionTitle">Aktionen</div>
                <button
                  type="button"
                  className={isActive('/teacher/bookings') ? 'dropdown__item dropdown__item--active' : 'dropdown__item'}
                  onClick={() => {
                    navigate('/teacher/bookings');
                    close();
                  }}
                >
                  <span>Meine Buchungen</span>
                  {isActive('/teacher/bookings') && <span className="dropdown__hint">Aktiv</span>}
                </button>
                <button
                  type="button"
                  className={isActive('/teacher/room') ? 'dropdown__item dropdown__item--active' : 'dropdown__item'}
                  onClick={() => {
                    navigate('/teacher/room');
                    close();
                  }}
                >
                  <span>Raum ändern</span>
                  {isActive('/teacher/room') && <span className="dropdown__hint">Aktiv</span>}
                </button>
                <button
                  type="button"
                  className={isActive('/teacher/password') ? 'dropdown__item dropdown__item--active' : 'dropdown__item'}
                  onClick={() => {
                    navigate('/teacher/password');
                    close();
                  }}
                >
                  <span>Passwort ändern</span>
                  {isActive('/teacher/password') && <span className="dropdown__hint">Aktiv</span>}
                </button>
                <button
                  type="button"
                  className={isActive('/teacher/feedback') ? 'dropdown__item dropdown__item--active' : 'dropdown__item'}
                  onClick={() => {
                    navigate('/teacher/feedback');
                    close();
                  }}
                >
                  <span>Feedback senden</span>
                  {isActive('/teacher/feedback') && <span className="dropdown__hint">Aktiv</span>}
                </button>

                {canSwitchView && (
                  <>
                    <div className="dropdown__divider" role="separator" />
                    <div className="dropdown__sectionTitle">Ansicht</div>
                    <button
                      type="button"
                      className={(activeView ?? 'teacher') === 'teacher' ? 'dropdown__item dropdown__item--active' : 'dropdown__item'}
                      onClick={() => {
                        setActiveView('teacher');
                        navigate('/teacher/bookings', { replace: true });
                        close();
                      }}
                    >
                      <span>Lehrkraft</span>
                      {(activeView ?? 'teacher') === 'teacher' && <span className="dropdown__hint">Aktiv</span>}
                    </button>
                    <button
                      type="button"
                      className={(activeView ?? 'teacher') === 'admin' ? 'dropdown__item dropdown__item--active' : 'dropdown__item'}
                      onClick={() => {
                        setActiveView('admin');
                        navigate('/admin', { replace: true });
                        close();
                      }}
                    >
                      <span>Admin</span>
                      {(activeView ?? 'teacher') === 'admin' && <span className="dropdown__hint">Aktiv</span>}
                    </button>
                  </>
                )}

                <div className="dropdown__divider" role="separator" />
                <button
                  type="button"
                  className="dropdown__item"
                  onClick={() => {
                    navigate('/');
                    close();
                  }}
                >
                  <span>Zur Buchungsseite</span>
                </button>
                <button
                  type="button"
                  className="dropdown__item dropdown__item--danger"
                  onClick={() => {
                    close();
                    handleLogout();
                  }}
                >
                  <span>Abmelden</span>
                </button>
              </>
            )}
          </Sidebar>
        }
      />

      <main className="admin-main">
        <Outlet context={outletContext} />
      </main>
    </div>
  );
}
