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
  title: 'Beratungslehrer',
  description: 'Sprechstunde buchen oder eine anonyme Anfrage stellen.',
  icon: '',
  basePath: '/beratungslehrer',
  accent: 'var(--module-accent-beratungslehrer)',
  accentRgb: '184, 134, 11',
  requiredModule: 'beratungslehrer',

  /** Öffentliche Buchungsseite */
  PublicPage: BLBookingApp,

  /** Admin-Bereich: Beratungslehrer verwalten */
  adminRoutes: [
    { path: '/admin/beratungslehrer', label: 'Beratungslehrer', Component: BLAdmin },
  ],

  /** Sidebar-Navigation */
  sidebarNav: {
    label: 'Beratungslehrer',
    items: [
      { path: '/admin/beratungslehrer', label: 'Beratungstermine verwalten' },
    ],
  },
};

export default beratungslehrerModule;
