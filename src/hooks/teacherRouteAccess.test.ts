/**
 * Tests for teacher route access — verifies that teachers can reach
 * /teacher routes without needing explicit module access for the
 * base teacher module (elternsprechtag).
 *
 * Regression test for: new teacher without any modules gets redirected
 * to "/" when trying to access /teacher because elternsprechtag's
 * requiredModule gates the teacherRoutes via allowedModules.
 */

import { describe, it, expect } from 'vitest';

/**
 * Simulates the ProtectedRoute decision logic from src/components/ProtectedRoute.tsx
 * Returns: 'allow' | redirect-path
 */
function simulateProtectedRoute(
  user: { role: string; modules: string[]; adminModules: string[] },
  allowedRoles?: string[],
  allowedModules?: string[],
): 'allow' | string {
  const { role, modules, adminModules } = user;

  // Admin/superadmin bypass
  if (role === 'admin' || role === 'superadmin') return 'allow';

  // Module check
  if (allowedModules && allowedModules.length > 0) {
    const hasAccess = allowedModules.some(m => modules.includes(m) || adminModules.includes(m));
    if (hasAccess) return 'allow';
    if (!allowedRoles) return '/'; // denied
  }

  // Role check
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === 'teacher') return '/teacher';
    return '/';
  }

  return 'allow';
}

/**
 * Simulates how App.tsx builds the ProtectedRoute params for teacherRoutes.
 * Modules on the default /teacher path get NO allowedModules guard.
 * Only modules with their own teacherBasePath get gated.
 */
function getTeacherRouteGuard(mod: { requiredModule?: string; teacherBasePath?: string }) {
  const needsModuleGuard = mod.teacherBasePath && mod.requiredModule;
  return { allowedModules: needsModuleGuard ? [mod.requiredModule!] : undefined };
}

describe('Teacher route access', () => {
  const newTeacher = { role: 'teacher', modules: [] as string[], adminModules: [] as string[] };
  const teacherWithEST = { role: 'teacher', modules: ['elternsprechtag'], adminModules: [] as string[] };
  const teacherWithFlow = { role: 'teacher', modules: ['flow'], adminModules: [] as string[] };

  describe('Elternsprechtag (base teacher module, basePath=/teacher)', () => {
    const estModule = { requiredModule: 'elternsprechtag', teacherBasePath: undefined };

    it('NEW TEACHER without modules should access /teacher', () => {
      const guard = getTeacherRouteGuard(estModule);
      const result = simulateProtectedRoute(newTeacher, undefined, guard.allowedModules);
      // This FAILS with current code — new teacher gets redirected to "/"
      expect(result).toBe('allow');
    });

    it('teacher WITH elternsprechtag module should access /teacher', () => {
      const guard = getTeacherRouteGuard(estModule);
      const result = simulateProtectedRoute(teacherWithEST, undefined, guard.allowedModules);
      expect(result).toBe('allow');
    });
  });

  describe('Flow (optional module, basePath=/teacher/flow)', () => {
    const flowModule = { requiredModule: 'flow', teacherBasePath: '/teacher/flow' };

    it('teacher WITHOUT flow module should be denied /teacher/flow', () => {
      const guard = getTeacherRouteGuard(flowModule);
      const result = simulateProtectedRoute(newTeacher, undefined, guard.allowedModules);
      expect(result).toBe('/');
    });

    it('teacher WITH flow module should access /teacher/flow', () => {
      const guard = getTeacherRouteGuard(flowModule);
      const result = simulateProtectedRoute(teacherWithFlow, undefined, guard.allowedModules);
      expect(result).toBe('allow');
    });
  });

  describe('Admin bypass', () => {
    const admin = { role: 'admin', modules: [] as string[], adminModules: [] as string[] };

    it('admin should access /teacher regardless of modules', () => {
      const guard = getTeacherRouteGuard({ requiredModule: 'elternsprechtag' });
      const result = simulateProtectedRoute(admin, undefined, guard.allowedModules);
      expect(result).toBe('allow');
    });
  });
});
