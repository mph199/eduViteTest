/**
 * Modul-Manifest: Differenzierungswahl (Choice)
 *
 * Definiert Metadaten, Lazy-geladene Routen und Admin-Einträge
 * für das Choice-Modul.
 */

import { lazy } from 'react';
import type { ModuleDefinition } from '../registry';

const ChoiceAdmin = lazy(() =>
  import('./pages/ChoiceAdmin').then((m) => ({ default: m.ChoiceAdmin }))
);
const ChoicePublicApp = lazy(() =>
  import('./pages/ChoicePublicApp').then((m) => ({ default: m.ChoicePublicApp }))
);

const choiceModule: ModuleDefinition = {
  id: 'choice',
  title: 'Differenzierungswahl',
  description: 'Strukturierte Wunschabgabe für Differenzierungsfächer.',
  icon: '',
  basePath: '/wahl/*',
  accent: 'var(--module-accent-choice)',
  accentRgb: '196, 162, 101',
  requiredModule: 'choice',

  // Teilnahme erfolgt über Link in Einladungsmail – kein Menüeintrag nötig
  PublicPage: ChoicePublicApp,

  adminRoutes: [
    { path: '/admin/choice', label: 'Differenzierungswahl', Component: ChoiceAdmin },
  ],

  sidebarNav: {
    label: 'Differenzierungswahl',
    items: [
      { path: '/admin/choice', label: 'Wahlen verwalten', iconName: 'ListChecks', roles: ['admin', 'superadmin'], allowedModules: ['choice'], view: 'admin' },
    ],
  },
};

export default choiceModule;
