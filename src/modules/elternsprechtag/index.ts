/**
 * Modul-Manifest: Elternsprechtag
 *
 * Definiert Metadaten, Lazy-geladene Routen und Admin-Einträge
 * für das Elternsprechtag-Modul.
 */

import { lazy } from 'react';
import type { ModuleDefinition } from '../registry';

const BookingApp = lazy(() =>
  import('./components/BookingApp').then((m) => ({ default: m.BookingApp }))
);
const AdminSlots = lazy(() =>
  import('./pages/AdminSlots').then((m) => ({ default: m.AdminSlots }))
);
const TeacherLayout = lazy(() =>
  import('./pages/teacher/TeacherLayout').then((m) => ({ default: m.TeacherLayout }))
);
const TeacherHome = lazy(() =>
  import('./pages/teacher/TeacherHome').then((m) => ({ default: m.TeacherHome }))
);
const TeacherRequests = lazy(() =>
  import('./pages/teacher/TeacherRequests').then((m) => ({ default: m.TeacherRequests }))
);
const TeacherBookings = lazy(() =>
  import('./pages/teacher/TeacherBookings').then((m) => ({ default: m.TeacherBookings }))
);
const TeacherPassword = lazy(() =>
  import('./pages/teacher/TeacherPassword').then((m) => ({ default: m.TeacherPassword }))
);
const elternsprechtagModule: ModuleDefinition = {
  id: 'elternsprechtag',
  title: 'Eltern- und Ausbildersprechtag',
  description: 'Buchen Sie einen Gesprächstermin mit einer Lehrkraft.',
  icon: '',
  basePath: '/elternsprechtag',
  accent: 'var(--module-accent-elternsprechtag)',
  accentRgb: '26, 127, 122',

  /** Öffentliche Buchungsseite */
  PublicPage: BookingApp,

  /** Admin-Bereich: Sprechzeiten verwalten */
  adminRoutes: [
    { path: '/admin/slots', label: 'Sprechzeiten', Component: AdminSlots },
  ],

  /** Sidebar-Navigation
   *  Note: /admin/events is a Core route (App.tsx), not a module route.
   *  It appears here as a sidebar link because event management is closely
   *  related to elternsprechtag but serves all modules. */
  sidebarNav: {
    label: 'Elternsprechtag',
    items: [
      { path: '/admin/events', label: 'Sprechtage verwalten', iconName: 'Calendar', roles: ['admin', 'superadmin'], allowedModules: ['elternsprechtag'], view: 'admin' },
      { path: '/admin/slots', label: 'Sprechzeiten', iconName: 'Clock', roles: ['admin', 'superadmin'], allowedModules: ['elternsprechtag'], view: 'admin' },
    ],
  },

  /** Lehrkraft-Bereich */
  teacherLayout: TeacherLayout,
  teacherRoutes: [
    { index: true, Component: TeacherHome },
    { path: 'requests', Component: TeacherRequests },
    { path: 'bookings', Component: TeacherBookings },
    { path: 'password', Component: TeacherPassword },
  ],
};

export default elternsprechtagModule;
