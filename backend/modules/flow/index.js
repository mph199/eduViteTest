/**
 * Modul: Flow – Kollaborationsformat
 *
 * Rein internes Modul (kein oeffentlicher Einstiegspunkt).
 * Alle Routen erfordern requireAuth + requireModuleAccess('flow').
 * Abteilungssicht zusaetzlich per requireFlowAbteilungsleitung gesichert.
 */

import { requireAuth, requireModuleAccess } from '../../middleware/auth.js';
import { requireFlowAbteilungsleitung } from './middleware/flowAuth.js';
import bildungsgangRouter from './routes/bildungsgang.js';
import arbeitspaketRouter from './routes/arbeitspaket.js';
import aufgabeRouter from './routes/aufgabe.js';
import tagungRouter from './routes/tagung.js';
import dashboardRouter from './routes/dashboard.js';
import abteilungRouter from './routes/abteilung.js';
import dateiRouter from './routes/datei.js';

export default {
    id: 'flow',
    name: 'Flow – Kollaborationsformat',

    register(app, { rateLimiters }) {
        const auth = [requireAuth, requireModuleAccess('flow')];

        // Reihenfolge: spezifischere Pfade zuerst
        app.use('/api/flow/abteilung', ...auth, requireFlowAbteilungsleitung, abteilungRouter);
        app.use('/api/flow/dashboard', ...auth, dashboardRouter);
        app.use('/api/flow/aufgaben', ...auth, aufgabeRouter);
        app.use('/api/flow/tagungen', ...auth, tagungRouter);
        app.use('/api/flow/arbeitspakete', ...auth, arbeitspaketRouter);
        app.use('/api/flow/bildungsgaenge', ...auth, bildungsgangRouter);
        app.use('/api/flow/dateien', ...auth, dateiRouter);
    },
};
