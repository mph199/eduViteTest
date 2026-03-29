/**
 * AdminTeacherSidebar — Permanente Sidebar für den Admin/Teacher/Superadmin-Bereich.
 *
 * Sichtbar ab >1024px. Auf Mobile übernimmt der Hamburger-Drawer.
 * Nutzt dieselbe Nav-Logik wie der Drawer (useAdminNavGroups).
 */

import { useNavigate } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import {
  Blocks, Palette, Image, Mail, FileText, Shield, Key,
  LayoutDashboard, Users, Home, Inbox, CalendarCheck,
  Calendar, Clock, HeartHandshake, GraduationCap,
  LayoutGrid, CheckSquare, Settings, Building2,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useAdminNavGroups } from '../hooks/useAdminNavGroups';
import { useAuth } from '../contexts/useAuth';
import { ViewSwitcher } from './ViewSwitcher';
import { SidebarProfile } from './SidebarProfile';
import type { ActiveView, NavGroup, NavItem } from '../types';
import './AdminTeacherSidebar.css';

/** Map iconName string → lucide component */
const ICON_MAP: Record<string, ComponentType<{ size?: number }>> = {
  // Superadmin
  Blocks, Palette, Image, Mail, FileText, Shield, Key,
  // Admin core
  LayoutDashboard, Users,
  // Teacher
  Home, Inbox, CalendarCheck,
  // Elternsprechtag
  Calendar, Clock,
  // SSW / BL
  HeartHandshake, GraduationCap,
  // Flow
  LayoutGrid, CheckSquare, Settings, Building2,
};

export function AdminTeacherSidebar() {
  const { filteredGroups, isActive, isAdminOrModuleAdmin, hasTeacherId, getViewChangeTarget } = useAdminNavGroups();
  const { user, logout, activeView, setActiveView } = useAuth();
  const navigate = useNavigate();

  const handleClick = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  const handleLogout = useCallback(() => {
    void (async () => { await logout(); navigate('/login'); })();
  }, [logout, navigate]);

  // View switcher: only for admin/module-admin users who are also teachers
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

  return (
    <aside className="ats" aria-label="Navigation">
      <nav className="ats__nav">
        {viewSwitcherOptions && activeView && (
          <div className="ats__viewSwitcher">
            <ViewSwitcher
              options={viewSwitcherOptions}
              activeValue={activeView}
              onChange={handleViewChange}
            />
          </div>
        )}
        {filteredGroups.map((group: NavGroup, gi: number) => (
          <div
            key={group.label || group.items[0]?.path || gi}
            className="ats__section"
            {...(group.accentRgb ? { 'data-accent': true, style: { '--section-accent-rgb': group.accentRgb } as React.CSSProperties } : {})}
          >
            {group.label && (
              <div className="ats__sectionLabel">{group.label}</div>
            )}
            {group.items.map((item: NavItem) => {
              const active = isActive(item.path);
              const Icon = item.iconName ? ICON_MAP[item.iconName] : null;

              return (
                <button
                  key={item.path}
                  type="button"
                  className={active ? 'ats__item ats__item--active' : 'ats__item'}
                  onClick={() => handleClick(item.path)}
                  aria-current={active ? 'page' : undefined}
                >
                  {Icon && <Icon size={16} aria-hidden="true" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      {user && (
        <div className="ats__footer">
          <SidebarProfile
            user={user}
            onLogout={handleLogout}
            onNavigate={(path) => navigate(path)}
          />
        </div>
      )}
    </aside>
  );
}
