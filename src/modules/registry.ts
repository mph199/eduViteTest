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
  /** Lucide icon name for sidebar rendering */
  iconName?: string;
  /** Only show for these roles. If omitted, visible to all with access. */
  roles?: string[];
  /** Also show for users with these module accesses (OR with roles). */
  allowedModules?: string[];
  /** Restrict to this view ('admin' or 'teacher'). If omitted, shown in all views. */
  view?: 'admin' | 'teacher';
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

  /** CSS custom property name for module accent color (e.g. 'var(--module-accent-elternsprechtag)') */
  accent?: string;
  /** RGB triplet for rgba() usage (e.g. '26, 127, 122') */
  accentRgb?: string;

  /** Lazy-geladene öffentliche Hauptseite (optional für interne Module) */
  PublicPage?: LazyExoticComponent<ComponentType>;

  /** Zusätzliche Admin-Routen */
  adminRoutes?: AdminRoute[];

  /** Sidebar-Navigationsgruppe(n) für den Admin/Modulbereich */
  sidebarNav?: SidebarNavGroup;

  /** Module-Key für Zugangssteuerung (user_module_access) */
  requiredModule?: string;

  /** Lehrkraft-Layout-Komponente */
  teacherLayout?: LazyExoticComponent<ComponentType>;
  /** Basis-Pfad für Teacher-Routen (Standard: '/teacher') */
  teacherBasePath?: string;
  /** Lehrkraft-Unterrouten */
  teacherRoutes?: TeacherRoute[];
}

// ── Alle verfügbaren Module registrieren ────────────────────────────────

import elternsprechtagModule from './elternsprechtag/index';
import schulsozialarbeitModule from './schulsozialarbeit/index';
import beratungslehrerModule from './beratungslehrer/index';
import flowModule from './flow/index';
import choiceModule from './choice/index';

const allModules: ModuleDefinition[] = [
  elternsprechtagModule,
  schulsozialarbeitModule,
  beratungslehrerModule,
  flowModule,
  choiceModule,
];

// ── Filter über Env-Variable ────────────────────────────────────────────

function getEnabledIds(): string[] | null {
  const raw = (import.meta as unknown as Record<string, Record<string, unknown>>).env
    ?.VITE_ENABLED_MODULES;
  if (typeof raw !== 'string' || !raw.trim()) return null; // alle laden
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const enabledIds = getEnabledIds();

/** Alle registrierten Module (unabhängig von Aktivierung) */
export const allModuleDefinitions: ModuleDefinition[] = allModules;

/** Alle aktiven Module */
export const modules: ModuleDefinition[] = enabledIds
  ? allModules.filter((m) => enabledIds.includes(m.id))
  : allModules;

/** Schneller Lookup nach ID */
export function getModule(id: string): ModuleDefinition | undefined {
  return modules.find((m) => m.id === id);
}
