/**
 * Modul: Flow – Kollaborationsformat
 *
 * Rein internes Modul (kein oeffentlicher Einstiegspunkt).
 * Alle Routen erfordern requireAuth + requireModuleAccess('flow').
 * Abteilungssicht zusaetzlich per requireFlowAbteilungsleitung gesichert.
 */

import { requireAuth, requireAdmin, requireModuleAccess } from '../../middleware/auth.js';
import { requireFlowAbteilungsleitung } from './middleware/flowAuth.js';
import bildungsgangRouter from './routes/bildungsgang.js';
import arbeitspaketRouter from './routes/arbeitspaket.js';
import aufgabeRouter from './routes/aufgabe.js';
import tagungRouter from './routes/tagung.js';
import dashboardRouter from './routes/dashboard.js';
import abteilungRouter from './routes/abteilung.js';
import dateiRouter from './routes/datei.js';
import adminRouter from './routes/admin.js';

export default {
    id: 'flow',
    name: 'Flow – Kollaborationsformat',

    register(app, { rateLimiters }) {
        const auth = [rateLimiters.auth, requireAuth, requireModuleAccess('flow')];

        // Admin-Routen: BGL-Verwaltung (vor spezifischeren Pfaden)
        app.use('/api/flow/admin', rateLimiters.admin, requireAuth, requireAdmin, requireModuleAccess('flow'), adminRouter);

        // Reihenfolge: spezifischere Pfade zuerst
        app.use('/api/flow/abteilung', rateLimiters.admin, requireAuth, requireModuleAccess('flow'), requireFlowAbteilungsleitung, abteilungRouter);
        app.use('/api/flow/dashboard', ...auth, dashboardRouter);
        app.use('/api/flow/aufgaben', ...auth, aufgabeRouter);
        app.use('/api/flow/tagungen', ...auth, tagungRouter);
        app.use('/api/flow/arbeitspakete', ...auth, arbeitspaketRouter);
        app.use('/api/flow/bildungsgaenge', ...auth, bildungsgangRouter);
        app.use('/api/flow/dateien', ...auth, dateiRouter);
    },
};
