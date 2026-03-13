/**
 * Modul-Manifest: Schulsozialarbeit
 *
 * Definiert Metadaten, Lazy-geladene Routen und Admin-Einträge
 * für das Schulsozialarbeit-Modul.
 */

import { lazy } from 'react';
import type { ModuleDefinition } from '../registry';

const SSWBookingApp = lazy(() =>
  import('./components/SSWBookingApp').then((m) => ({ default: m.SSWBookingApp }))
);
const SSWAdmin = lazy(() =>
  import('./pages/SSWAdmin').then((m) => ({ default: m.SSWAdmin }))
);

const schulsozialarbeitModule: ModuleDefinition = {
  id: 'schulsozialarbeit',
  title: 'Schulsozialarbeit',
  description: 'Buche einen vertraulichen Beratungstermin bei der Schulsozialarbeit.',
  icon: '🤝',
  basePath: '/schulsozialarbeit',

  /** Öffentliche Buchungsseite */
  PublicPage: SSWBookingApp,

  /** Admin-Bereich: Berater/innen & Kategorien verwalten */
  adminRoutes: [
    { path: '/admin/ssw', label: 'Schulsozialarbeit', Component: SSWAdmin },
  ],
};

export default schulsozialarbeitModule;
