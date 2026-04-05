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
const SSWCounselorLayout = lazy(() =>
  import('./pages/SSWCounselorLayout').then((m) => ({ default: m.SSWCounselorLayout }))
);
const SSWCounselorAnfragenPage = lazy(() =>
  import('./pages/SSWCounselorAnfragenPage').then((m) => ({ default: m.SSWCounselorAnfragenPage }))
);
const SSWCounselorSprechzeitenPage = lazy(() =>
  import('./pages/SSWCounselorSprechzeitenPage').then((m) => ({ default: m.SSWCounselorSprechzeitenPage }))
);
const SSWCounselorTerminePage = lazy(() =>
  import('./pages/SSWCounselorTerminePage').then((m) => ({ default: m.SSWCounselorTerminePage }))
);

const schulsozialarbeitModule: ModuleDefinition = {
  id: 'schulsozialarbeit',
  title: 'Schulsozialarbeit',
  description: 'Buche einen vertraulichen Beratungstermin bei der Schulsozialarbeit.',
  icon: '',
  basePath: '/schulsozialarbeit',
  accent: 'var(--module-accent-schulsozialarbeit)',
  accentRgb: '205, 92, 92',
  requiredModule: 'schulsozialarbeit',

  /** Öffentliche Buchungsseite */
  PublicPage: SSWBookingApp,

  /** Admin-Bereich: Berater/innen & Kategorien verwalten */
  adminRoutes: [
    { path: '/admin/ssw', label: 'Schulsozialarbeit', Component: SSWAdmin },
  ],

  /** Sidebar-Navigation */
  sidebarNav: {
    label: 'Schulsozialarbeit',
    items: [
      { path: '/admin/ssw', label: 'Berater/innen verwalten', iconName: 'HeartHandshake', allowedModules: ['schulsozialarbeit'], view: 'admin' },
      { path: '/teacher/ssw', label: 'Meine Anfragen', iconName: 'Inbox', allowedModules: ['schulsozialarbeit'], view: 'teacher' },
      { path: '/teacher/ssw/sprechzeiten', label: 'Sprechzeiten', iconName: 'Clock', allowedModules: ['schulsozialarbeit'], view: 'teacher' },
      { path: '/teacher/ssw/termine', label: 'Termine', iconName: 'CalendarCheck', allowedModules: ['schulsozialarbeit'], view: 'teacher' },
    ],
  },

  /** Lehrkraft-Bereich: Berater-eigene Ansicht */
  teacherLayout: SSWCounselorLayout,
  teacherBasePath: '/teacher/ssw',
  teacherRoutes: [
    { index: true, Component: SSWCounselorAnfragenPage },
    { path: 'sprechzeiten', Component: SSWCounselorSprechzeitenPage },
    { path: 'termine', Component: SSWCounselorTerminePage },
  ],
};

export default schulsozialarbeitModule;
