/**
 * Modul-Manifest: Beratungslehrer
 *
 * Definiert Metadaten, Lazy-geladene Routen und Admin-Eintraege
 * für das Beratungslehrer-Modul.
 */

import { lazy } from 'react';
import type { ModuleDefinition } from '../registry';

const BLBookingApp = lazy(() =>
  import('./components/BLBookingApp').then((m) => ({ default: m.BLBookingApp }))
);
const BLAdmin = lazy(() =>
  import('./pages/BLAdmin').then((m) => ({ default: m.BLAdmin }))
);

const beratungslehrerModule: ModuleDefinition = {
  id: 'beratungslehrer',
  title: 'Beratungslehrkräfte',
  description: 'Sprechstunde buchen oder eine anonyme Anfrage stellen.',
  icon: '',
  basePath: '/beratungslehrer',
  accent: 'var(--module-accent-beratungslehrer)',
  accentRgb: '184, 134, 11',
  requiredModule: 'beratungslehrer',

  /** Öffentliche Buchungsseite */
  PublicPage: BLBookingApp,

  /** Admin-Bereich: Beratungslehrkräfte verwalten */
  adminRoutes: [
    { path: '/admin/beratungslehrer', label: 'Beratungslehrkräfte', Component: BLAdmin },
  ],

  /** Sidebar-Navigation */
  sidebarNav: {
    label: 'Beratungslehrkräfte',
    items: [
      { path: '/admin/beratungslehrer', label: 'Beratungstermine verwalten', roles: ['admin', 'superadmin'], allowedModules: ['beratungslehrer'], view: 'admin' },
    ],
  },
};

export default beratungslehrerModule;
