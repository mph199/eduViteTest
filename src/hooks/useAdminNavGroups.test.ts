/**
 * Tests for useAdminNavGroups — routing logic for all 8 user types.
 *
 * Verifies that sidebar groups, item visibility, and view filtering
 * are correct for each user scenario.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────

const mockLocation = { pathname: '/admin', search: '' };
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
}));

const mockSetActiveView = vi.fn();
const mockAuth: Record<string, unknown> = {
  user: null,
  activeView: 'admin',
  setActiveView: mockSetActiveView,
};
vi.mock('../contexts/useAuth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../contexts/ModuleConfigContext', () => ({
  useModuleConfig: () => ({
    isModuleEnabled: () => true,
  }),
}));

vi.mock('../modules/registry', () => ({
  modules: [
    {
      id: 'elternsprechtag',
      basePath: '/elternsprechtag',
      requiredModule: 'elternsprechtag',
      accentRgb: '26, 127, 122',
      sidebarNav: {
        label: 'Elternsprechtag',
        items: [
          { path: '/admin/events', label: 'Sprechtage verwalten', iconName: 'Calendar', roles: ['admin', 'superadmin'], allowedModules: ['elternsprechtag'], view: 'admin' },
          { path: '/admin/slots', label: 'Sprechzeiten', iconName: 'Clock', roles: ['admin', 'superadmin'], allowedModules: ['elternsprechtag'], view: 'admin' },
        ],
      },
    },
    {
      id: 'schulsozialarbeit',
      basePath: '/schulsozialarbeit',
      requiredModule: 'schulsozialarbeit',
      sidebarNav: {
        label: 'Schulsozialarbeit',
        items: [
          { path: '/admin/ssw', label: 'Berater/innen verwalten', iconName: 'HeartHandshake', allowedModules: ['schulsozialarbeit'] },
        ],
      },
    },
    {
      id: 'beratungslehrer',
      basePath: '/beratungslehrer',
      requiredModule: 'beratungslehrer',
      sidebarNav: {
        label: 'Beratungslehrkräfte',
        items: [
          { path: '/admin/beratungslehrer', label: 'Beratungstermine verwalten', iconName: 'GraduationCap', allowedModules: ['beratungslehrer'] },
        ],
      },
    },
    {
      id: 'flow',
      basePath: '/flow',
      requiredModule: 'flow',
      accentRgb: '59, 109, 224',
      sidebarNav: {
        label: 'Flow',
        items: [
          { path: '/teacher/flow', label: 'Dashboard', iconName: 'LayoutGrid', roles: ['teacher', 'admin', 'superadmin'] },
          { path: '/teacher/flow/aufgaben', label: 'Meine Aufgaben', iconName: 'CheckSquare', roles: ['teacher', 'admin', 'superadmin'] },
          { path: '/teacher/flow/admin/bgl', label: 'BGL-Verwaltung', iconName: 'Settings', roles: ['admin', 'superadmin'] },
          { path: '/teacher/flow/admin/abteilung', label: 'Abteilungsübersicht', iconName: 'Building2', roles: ['admin', 'superadmin'] },
        ],
      },
    },
  ],
}));

import { useAdminNavGroups } from './useAdminNavGroups';

// ── Helpers ──────────────────────────────────────────────────────────

function setUser(user: Record<string, unknown> | null, view = 'admin') {
  mockAuth.user = user;
  mockAuth.activeView = view;
}

function labels(groups: { label: string }[]) {
  return groups.map((g) => g.label).filter(Boolean);
}

function paths(groups: { items: { path: string }[] }[]) {
  return groups.flatMap((g) => g.items.map((i) => i.path));
}

function hook() {
  return renderHook(() => useAdminNavGroups()).result.current;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('useAdminNavGroups', () => {
  beforeEach(() => {
    mockLocation.pathname = '/admin';
    mockLocation.search = '';
  });

  // ── A: Lehrkraft + Beratungslehrer (modules) ─────────────────────
  describe('A: Lehrkraft + Beratungslehrer', () => {
    beforeEach(() => setUser({ role: 'teacher', teacherId: 5, modules: ['beratungslehrer'], adminModules: [] }, 'teacher'));

    it('BL group visible without view filter (counselor without teacherId would get no-filter, but this user HAS teacherId so normal view logic applies)', () => {
      // User A has teacherId=5, so !hasTeacherId is false → isModuleAdminAccess=false
      // But modules.includes('beratungslehrer')=true so checkModuleAccess passes
      // Items: roleMatch=false (teacher not in [admin,superadmin]), moduleMatch=true (modules includes bl)
      const { navGroups } = hook();
      const bl = navGroups.find((g) => g.label === 'Beratungslehrkräfte');
      expect(bl).toBeDefined();
      expect(bl!.items).toHaveLength(1);
    });

    it('no ViewSwitcher', () => {
      const { isAdminOrModuleAdmin } = hook();
      expect(isAdminOrModuleAdmin).toBe(false);
    });

    it('Lehrkraft group visible', () => {
      const { filteredGroups } = hook();
      expect(labels(filteredGroups)).toContain('Lehrkraft');
    });
  });

  // ── B: Nur Lehrkraft ─────────────────────────────────────────────
  describe('B: Nur Lehrkraft', () => {
    beforeEach(() => setUser({ role: 'teacher', teacherId: 5, modules: [], adminModules: [] }, 'teacher'));

    it('only Lehrkraft group with 3 items', () => {
      const { filteredGroups } = hook();
      expect(labels(filteredGroups)).toEqual(['Lehrkraft']);
      expect(paths(filteredGroups)).toEqual(['/teacher', '/teacher/requests', '/teacher/bookings']);
    });
  });

  // ── C: Admin ─────────────────────────────────────────────────────
  describe('C: Admin', () => {
    beforeEach(() => setUser({ role: 'admin', teacherId: 10, modules: [], adminModules: [] }, 'admin'));

    it('shows all admin groups', () => {
      const { filteredGroups } = hook();
      const l = labels(filteredGroups);
      expect(l).toContain('Elternsprechtag');
      expect(l).toContain('Schulsozialarbeit');
      expect(l).toContain('Beratungslehrkräfte');
      expect(l).toContain('Flow');
      expect(l).toContain('Verwaltung');
    });

    it('all 4 Flow items visible', () => {
      const { filteredGroups } = hook();
      const flow = filteredGroups.find((g) => g.label === 'Flow');
      expect(flow!.items).toHaveLength(4);
    });

    it('ViewSwitcher visible', () => {
      const { isAdminOrModuleAdmin, hasTeacherId } = hook();
      expect(isAdminOrModuleAdmin).toBe(true);
      expect(hasTeacherId).toBe(true);
    });

    it('teacher view shows Lehrkraft + Flow', () => {
      setUser({ role: 'admin', teacherId: 10, modules: [], adminModules: [] }, 'teacher');
      const { filteredGroups } = hook();
      const l = labels(filteredGroups);
      expect(l).toContain('Lehrkraft');
      expect(l).toContain('Flow');
      expect(l).not.toContain('Verwaltung');
    });
  });

  // ── D: Superadmin ────────────────────────────────────────────────
  describe('D: Superadmin', () => {
    beforeEach(() => setUser({ role: 'superadmin', teacherId: 10, modules: [], adminModules: [] }, 'admin'));

    it('shows Konfiguration group', () => {
      expect(labels(hook().filteredGroups)).toContain('Konfiguration');
    });
  });

  // ── E: Nur SSW-Berater ───────────────────────────────────────────
  describe('E: Nur SSW-Berater (no teacherId)', () => {
    beforeEach(() => setUser({ role: 'teacher', teacherId: null, modules: ['schulsozialarbeit'], adminModules: [] }, 'teacher'));

    it('SSW group visible without view filter', () => {
      const { navGroups } = hook();
      const ssw = navGroups.find((g) => g.label === 'Schulsozialarbeit');
      expect(ssw).toBeDefined();
      expect(ssw!.view).toBeUndefined();
    });

    it('SSW visible in teacher view (no view filter)', () => {
      expect(labels(hook().filteredGroups)).toContain('Schulsozialarbeit');
    });

    it('Lehrkraft group visible for teacher-role counselors', () => {
      expect(labels(hook().filteredGroups)).toContain('Lehrkraft');
    });

    it('no ViewSwitcher', () => {
      const { isAdminOrModuleAdmin, hasTeacherId } = hook();
      expect(isAdminOrModuleAdmin).toBe(false);
      expect(hasTeacherId).toBe(false);
    });
  });

  // ── F: Lehrkraft + adminModules=[beratungslehrer] ────────────────
  describe('F: Lehrkraft + Admin-Rechte Beratung', () => {
    beforeEach(() => setUser({ role: 'teacher', teacherId: 5, modules: [], adminModules: ['beratungslehrer'] }, 'teacher'));

    it('BL group has no view filter (visible in both views)', () => {
      const { navGroups } = hook();
      const bl = navGroups.find((g) => g.label === 'Beratungslehrkräfte');
      expect(bl).toBeDefined();
      expect(bl!.view).toBeUndefined();
    });

    it('ViewSwitcher visible', () => {
      expect(hook().isAdminOrModuleAdmin).toBe(true);
    });

    it('no Elternsprechtag group (0 visible items)', () => {
      expect(hook().navGroups.find((g) => g.label === 'Elternsprechtag')).toBeUndefined();
    });

    it('getViewChangeTarget → /admin/beratungslehrer', () => {
      expect(hook().getViewChangeTarget('admin')).toBe('/admin/beratungslehrer');
    });
  });

  // ── G: Lehrkraft + adminModules=[elternsprechtag] ────────────────
  describe('G: Lehrkraft + Admin-Rechte Elternsprechtag', () => {
    beforeEach(() => setUser({ role: 'teacher', teacherId: 5, modules: [], adminModules: ['elternsprechtag'] }, 'teacher'));

    it('Elternsprechtag group has no view filter (visible in both views)', () => {
      const { navGroups } = hook();
      const est = navGroups.find((g) => g.label === 'Elternsprechtag');
      expect(est).toBeDefined();
      expect(est!.view).toBeUndefined();
      expect(est!.items).toHaveLength(2);
    });

    it('teacher view shows Elternsprechtag and Lehrkraft', () => {
      const l = labels(hook().filteredGroups);
      expect(l).toContain('Elternsprechtag');
      expect(l).toContain('Lehrkraft');
    });

    it('getViewChangeTarget → /admin/events', () => {
      expect(hook().getViewChangeTarget('admin')).toBe('/admin/events');
    });
  });

  // ── H: Lehrkraft + adminModules=[beratungslehrer, elternsprechtag]
  describe('H: Lehrkraft + Admin-Rechte Beratung + Elternsprechtag', () => {
    beforeEach(() => setUser({ role: 'teacher', teacherId: 5, modules: [], adminModules: ['beratungslehrer', 'elternsprechtag'] }, 'teacher'));

    it('teacher view shows all module groups and Lehrkraft', () => {
      const l = labels(hook().filteredGroups);
      expect(l).toContain('Elternsprechtag');
      expect(l).toContain('Beratungslehrkräfte');
      expect(l).toContain('Lehrkraft');
    });

    it('admin-module groups have no view filter (visible in both views)', () => {
      const { navGroups } = hook();
      expect(navGroups.find((g) => g.label === 'Elternsprechtag')!.view).toBeUndefined();
      expect(navGroups.find((g) => g.label === 'Beratungslehrkräfte')!.view).toBeUndefined();
    });

    it('getViewChangeTarget → first admin item', () => {
      expect(hook().getViewChangeTarget('admin')).toBe('/admin/events');
    });
  });
});
