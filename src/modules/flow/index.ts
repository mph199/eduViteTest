import { lazy } from 'react';
import type { ModuleDefinition } from '../registry';

const FlowLayout = lazy(() =>
    import('./components/FlowLayout').then((m) => ({ default: m.FlowLayout }))
);

const FlowDashboard = lazy(() =>
    import('./pages/FlowDashboard').then((m) => ({ default: m.FlowDashboard }))
);

const MeineAufgabenPage = lazy(() =>
    import('./pages/MeineAufgabenPage').then((m) => ({ default: m.MeineAufgabenPage }))
);

const BildungsgangPage = lazy(() =>
    import('./pages/BildungsgangPage').then((m) => ({ default: m.BildungsgangPage }))
);

const ArbeitspaketPage = lazy(() =>
    import('./pages/ArbeitspaketPage').then((m) => ({ default: m.ArbeitspaketPage }))
);

const AbteilungPage = lazy(() =>
    import('./pages/AbteilungPage').then((m) => ({ default: m.AbteilungPage }))
);

const flowModule: ModuleDefinition = {
    id: 'flow',
    title: 'Flow',
    description: 'Kollaborationsformat fuer Bildungsgaenge',
    icon: '',
    basePath: '/flow',
    accent: 'var(--module-accent-flow)',
    accentRgb: '59, 109, 224',
    requiredModule: 'flow',
    // Kein PublicPage – rein internes Modul
    teacherBasePath: '/teacher/flow',
    adminRoutes: [
        {
            path: '/admin/flow/abteilung',
            label: 'Flow Abteilungssicht',
            Component: AbteilungPage,
        },
    ],
    teacherLayout: FlowLayout,
    teacherRoutes: [
        { index: true, Component: FlowDashboard },
        { path: 'aufgaben', Component: MeineAufgabenPage },
        { path: 'bildungsgang/:id', Component: BildungsgangPage },
        { path: 'arbeitspaket/:id', Component: ArbeitspaketPage },
    ],
    sidebarNav: {
        label: 'Flow',
        items: [
            { path: '/teacher/flow', label: 'Dashboard' },
            { path: '/teacher/flow/aufgaben', label: 'Meine Aufgaben' },
        ],
    },
};

export default flowModule;
