import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
import './NotificationBell.css';

type Notification = {
  id: string;
  type: 'requests' | 'confirmed' | 'info';
  text: string;
  path: string;
  dot: 'red' | 'green' | 'blue';
  count?: number;
};

export function NotificationBell() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('notifBell_read');
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const isTeacher = Boolean(
    user && (user.role === 'teacher' || ((user.role === 'admin' || user.role === 'superadmin') && user.teacherId))
  );

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !isTeacher) {
      setNotifications([]);
      return;
    }
    try {
      const [requests, bookings] = await Promise.all([
        api.teacher.getRequests(),
        api.teacher.getBookings(),
      ]);
      const openCount = (requests || []).length;
      const confirmedCount = (bookings || []).filter(
        (b: { status?: string }) => b.status === 'confirmed'
      ).length;

      const items: Notification[] = [];

      if (openCount > 0) {
        items.push({
          id: `open-requests-${openCount}`,
          type: 'requests',
          text: `${openCount} ${openCount === 1 ? 'Anfrage wartet' : 'Anfragen warten'} auf Terminzuweisung`,
          path: '/teacher/requests',
          dot: 'red',
          count: openCount,
        });
      }

      if (confirmedCount > 0) {
        items.push({
          id: `confirmed-${confirmedCount}`,
          type: 'confirmed',
          text: `${confirmedCount} ${confirmedCount === 1 ? 'Termin' : 'Termine'} bestätigt`,
          path: '/teacher/bookings',
          dot: 'green',
          count: confirmedCount,
        });
      }

      if (items.length === 0) {
        items.push({
          id: 'no-notifications',
          type: 'info',
          text: 'Keine neuen Benachrichtigungen',
          path: '',
          dot: 'blue',
        });
      }

      setNotifications(items);
    } catch {
      setNotifications([]);
    }
  }, [isAuthenticated, isTeacher]);

  // Fetch on mount and when panel opens
  useEffect(() => {
    if (!isAuthenticated || !isTeacher) return;
    fetchNotifications();
  }, [fetchNotifications, isAuthenticated, isTeacher]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  if (!isAuthenticated || !isTeacher) return null;

  const markRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem('notifBell_read', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const badgeCount = notifications.reduce((sum, n) => sum + (n.type === 'requests' && !readIds.has(n.id) ? (n.count || 0) : 0), 0);

  return (
    <div className="notifBell">
      <button
        ref={buttonRef}
        type="button"
        className={`notifBell__button${open ? ' is-open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Benachrichtigungen"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg className="notifBell__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 17H9M18 17V11C18 7.68629 15.3137 5 12 5C8.68629 5 6 7.68629 6 11V17L4 19H20L18 17Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 19C10 20.1046 10.8954 21 12 21C13.1046 21 14 20.1046 14 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {badgeCount > 0 && (
          <span className="notifBell__badge" aria-label={`${badgeCount} offene Anfragen`}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      <div
        ref={panelRef}
        className={`notifBell__panel${open ? ' is-open' : ''}`}
        role="dialog"
        aria-label="Benachrichtigungen"
      >
        <div className="notifBell__panelHeader">
          <span className="notifBell__panelTitle">Benachrichtigungen</span>
        </div>
        <ul className="notifBell__list" role="list">
          {notifications.map((n) => (
            <li key={n.id} className="notifBell__item">
              {n.path ? (
                <button
                  type="button"
                  className={`notifBell__itemButton${readIds.has(n.id) ? ' is-read' : ''}`}
                  onClick={() => {
                    markRead(n.id);
                    navigate(n.path);
                    setOpen(false);
                  }}
                >
                  <span className={`notifBell__dot notifBell__dot--${readIds.has(n.id) ? 'muted' : n.dot}`} aria-hidden="true" />
                  <span className="notifBell__itemText">{n.text}</span>
                  <span className="notifBell__itemArrow" aria-hidden="true">›</span>
                </button>
              ) : (
                <div className="notifBell__itemStatic">
                  <span className={`notifBell__dot notifBell__dot--${n.dot}`} aria-hidden="true" />
                  <span className="notifBell__itemText">{n.text}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
