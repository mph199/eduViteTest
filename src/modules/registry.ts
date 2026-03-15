/**
 * Module Registry – Zentrale Stelle für alle aktivierten Frontend-Module.
 *
 * Über die Env-Variable VITE_ENABLED_MODULES (kommasepariert) kann
 * gesteuert werden, welche Module geladen werden. Ist sie nicht gesetzt,
 * werden alle registrierten Module aktiviert.
 */

import type { ComponentType, LazyExoticComponent } from 'react';

// ── Typen ──────────────────────────────────────────────────────────────

export interface TeacherRoute {
  path?: string;
  index?: boolean;
  Component: LazyExoticComponent<ComponentType>;
}

export interface AdminRoute {
  path: string;
  label: string;
  Component: LazyExoticComponent<ComponentType>;
}

/** Sidebar navigation item within a module group */
export interface SidebarNavItem {
  path: string;
  label: string;
  /** Only show for these roles. If omitted, visible to all with access. */
  roles?: string[];
}

/** Sidebar navigation group contributed by a module */
export interface SidebarNavGroup {
  /** Group label shown in sidebar */
  label: string;
  /** Navigation items */
  items: SidebarNavItem[];
}

export interface ModuleDefinition {
  /** Eindeutige Modul-ID (z.B. 'elternsprechtag') */
  id: string;
  /** Anzeigename */
  title: string;
  /** Kurzbeschreibung für die Landing Page */
  description: string;
  /** Optional icon */
  icon: string;
  /** Basis-Pfad der öffentlichen Seite (z.B. '/elternsprechtag') */
  basePath: string;

  /** Lazy-geladene öffentliche Hauptseite */
  PublicPage: LazyExoticComponent<ComponentType>;

  /** Zusätzliche Admin-Routen */
  adminRoutes?: AdminRoute[];

  /** Sidebar-Navigationsgruppe(n) fuer den Admin/Modulbereich */
  sidebarNav?: SidebarNavGroup;

  /** Module-Key fuer Zugangssteuerung (user_module_access) */
  requiredModule?: string;

  /** Lehrkraft-Layout-Komponente */
  teacherLayout?: LazyExoticComponent<ComponentType>;
  /** Lehrkraft-Unterrouten */
  teacherRoutes?: TeacherRoute[];
}

// ── Alle verfügbaren Module registrieren ────────────────────────────────

import elternsprechtagModule from './elternsprechtag/index';
import schulsozialarbeitModule from './schulsozialarbeit/index';
import beratungslehrerModule from './beratungslehrer/index';

const allModules: ModuleDefinition[] = [
  elternsprechtagModule,
  schulsozialarbeitModule,
  beratungslehrerModule,
];

// ── Filter über Env-Variable ────────────────────────────────────────────

function getEnabledIds(): string[] | null {
  const raw = (import.meta as unknown as Record<string, Record<string, unknown>>).env
    ?.VITE_ENABLED_MODULES;
  if (typeof raw !== 'string' || !raw.trim()) return null; // alle laden
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const enabledIds = getEnabledIds();

/** Alle aktiven Module */
export const modules: ModuleDefinition[] = enabledIds
  ? allModules.filter((m) => enabledIds.includes(m.id))
  : allModules;

/** Schneller Lookup nach ID */
export function getModule(id: string): ModuleDefinition | undefined {
  return modules.find((m) => m.id === id);
}
