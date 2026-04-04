/**
 * useAdminNavGroups — Extrahierte Navigationslogik für Admin/Teacher/Superadmin-Sidebar.
 *
 * Wird sowohl von der permanenten AdminTeacherSidebar (Desktop)
 * als auch vom Hamburger-Drawer (Mobile) konsumiert.
 */

import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { modules } from '../modules/registry';
import type { SidebarNavItem } from '../modules/registry';
import { useAuth } from '../contexts/useAuth';
import { useModuleConfig } from '../contexts/ModuleConfigContext';
import type { ActiveView, NavGroup, SuperadminNavItem } from '../types';

// Re-export types for consumers
export type { NavGroup, NavItem, SuperadminNavItem } from '../types';

/** Superadmin tab config — used by sidebar to render lucide icons */
export const SUPERADMIN_TABS: SuperadminNavItem[] = [
  { path: '/superadmin?tab=modules', label: 'Module', tabId: 'modules', iconName: 'Blocks' },
  { path: '/superadmin?tab=branding', label: 'Erscheinungsbild', tabId: 'branding', iconName: 'Palette' },
  { path: '/superadmin?tab=backgrounds', label: 'Hintergrundbilder', tabId: 'backgrounds', iconName: 'Image' },
  { path: '/superadmin?tab=email', label: 'E-Mail-Vorlage', tabId: 'email', iconName: 'Mail' },
  { path: '/superadmin?tab=texts', label: 'Buchungsseiten-Texte', tabId: 'texts', iconName: 'FileText' },
  { path: '/superadmin?tab=datenschutz', label: 'Datenschutz & DSGVO', tabId: 'datenschutz', iconName: 'Shield' },
  { path: '/superadmin?tab=oauth', label: 'SSO / OAuth', tabId: 'oauth', iconName: 'Key' },
];

export function useAdminNavGroups() {
  const { user, activeView, setActiveView } = useAuth();
  const navigate = useNavigate();
  const { isModuleEnabled } = useModuleConfig();
  const location = useLocation();
  const pathname = location.pathname;

  const activeModules = useMemo(
    () => modules.filter((m) => isModuleEnabled(m.id)),
    [isModuleEnabled],
  );

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperadmin = user?.role === 'superadmin';
  const hasAdminModules = Array.isArray(user?.adminModules) && user.adminModules.length > 0;
  const isAdminOrModuleAdmin = isAdmin || hasAdminModules;
  const hasTeacherId = Boolean(user?.teacherId);
  const userModules = user?.modules || [];

  const navGroups = useMemo(() => {
    const groups: NavGroup[] = [];

    // Inline module-access check (avoids stale closure from external function)
    const checkModuleAccess = (moduleKey?: string) => {
      if (!moduleKey) return isAdminOrModuleAdmin;
      return isAdmin || userModules.includes(moduleKey) || (user?.adminModules?.includes(moduleKey) ?? false);
    };

    // Dashboard (only full admin/superadmin)
    if (isAdmin) {
      groups.push({
        label: '',
        view: 'admin',
        items: [{ path: '/admin', label: 'Übersicht', iconName: 'LayoutDashboard' }],
      });
    }

    // Module groups from registry
    for (const mod of activeModules) {
      if (!mod.sidebarNav) continue;
      if (!checkModuleAccess(mod.requiredModule)) continue;

      const visibleItems = mod.sidebarNav.items.filter((item: SidebarNavItem) => {
        const roleMatch = !item.roles || (user?.role ? item.roles.includes(user.role) : false);
        const moduleMatch = item.allowedModules?.some(
          (m) => user?.modules?.includes(m) || user?.adminModules?.includes(m),
        );
        return roleMatch || moduleMatch;
      });

      if (visibleItems.length > 0) {
        // Determine if this user has special module access (not a full admin).
        const hasAdminModuleAccess = !isAdmin && mod.requiredModule &&
          (user?.adminModules?.includes(mod.requiredModule) ?? false);
        const isCounselorAccess = !isAdmin && mod.requiredModule &&
          !hasAdminModuleAccess && userModules.includes(mod.requiredModule);

        let groupView: ActiveView | undefined;
        if (isCounselorAccess || hasAdminModuleAccess) {
          // Counselors and module-admins: group visible in both views;
          // individual items are filtered by item.view in filteredGroups.
          groupView = undefined;
        } else {
          const itemViews = visibleItems
            .map((item: SidebarNavItem) => item.view)
            .filter((v): v is NonNullable<typeof v> => !!v);
          groupView =
            itemViews.length > 0 && itemViews.every((v) => v === itemViews[0])
              ? (itemViews[0] as ActiveView)
              : mod.requiredModule
                ? undefined
                : ('admin' as ActiveView);
        }

        groups.push({
          label: mod.sidebarNav.label,
          accentRgb: mod.accentRgb,
          ...(groupView ? { view: groupView } : {}),
          items: visibleItems,
        });
      }
    }

    // Core admin group
    if (isAdmin) {
      groups.push({
        label: 'Verwaltung',
        view: 'admin',
        items: [{ path: '/admin/teachers', label: 'Benutzer & Rechte', iconName: 'Users' }],
      });
    }

    // Teacher section (visible for all teacher-role users, including counselors without teacherId)
    if (hasTeacherId || user?.role === 'teacher') {
      groups.push({
        label: 'Lehrkraft',
        accentRgb: '26, 127, 122',
        view: 'teacher',
        items: [
          { path: '/teacher', label: 'Übersicht', iconName: 'Home' },
          { path: '/teacher/requests', label: 'Anfragen', iconName: 'Inbox' },
          { path: '/teacher/bookings', label: 'Buchungen', iconName: 'CalendarCheck' },
        ],
      });
    }

    // Superadmin section
    if (isSuperadmin) {
      groups.push({
        label: 'Konfiguration',
        items: SUPERADMIN_TABS,
      });
    }

    return groups;
  }, [isAdmin, isAdminOrModuleAdmin, isSuperadmin, hasTeacherId, userModules, user?.adminModules, user?.role, activeModules]);

  const filteredGroups = useMemo(() => {
    if (!activeView) return navGroups;
    return navGroups
      .filter((g) => !g.view || g.view === activeView)
      .map((g) => {
        // Filter individual items by their view property
        const items = g.items.filter((item) => !item.view || item.view === activeView);
        return items.length === g.items.length ? g : { ...g, items };
      })
      .filter((g) => g.items.length > 0);
  }, [navGroups, activeView]);

  const isActive = (path: string) => {
    if (path === '/admin') return pathname === '/admin' || pathname === '/admin/';
    if (path === '/teacher') return pathname === '/teacher' || pathname === '/teacher/';
    if (path.startsWith('/superadmin?tab=')) {
      const tabId = path.split('tab=')[1];
      const search = location.search;
      return pathname.startsWith('/superadmin') && search.includes(`tab=${tabId}`);
    }
    return pathname === path || pathname.startsWith(path + '/');
  };

  /** Get the best navigation target when switching views.
   *  Full admins go to /admin or /teacher.
   *  Module-admins go to their first visible admin-module route. */
  const getViewChangeTarget = (next: ActiveView): string => {
    if (next === 'teacher') return '/teacher';
    // For 'admin': full admins → /admin dashboard; module-admins → first admin-module item
    if (isAdmin) return '/admin';
    // Module-admin without full admin: find first admin-view item
    const adminGroups = navGroups.filter((g) => !g.view || g.view === 'admin');
    for (const g of adminGroups) {
      if (g.items.length > 0) return g.items[0].path;
    }
    return '/admin';
  };

  // ViewSwitcher: only for admin/module-admin users who are also teachers
  const viewSwitcherOptions = useMemo(() => {
    if (!user) return null;
    if (isAdminOrModuleAdmin && (hasTeacherId || user?.role === 'teacher')) {
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

  return {
    navGroups,
    filteredGroups,
    isActive,
    isAdmin,
    isSuperadmin,
    isAdminOrModuleAdmin,
    hasTeacherId,
    activeModules,
    activeView,
    getViewChangeTarget,
    viewSwitcherOptions,
    handleViewChange,
  };
}
