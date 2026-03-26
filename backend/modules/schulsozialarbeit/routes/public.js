/**
 * Schulsozialarbeit – Öffentliche Routen
 *
 * Endpunkte für Schüler/innen zum Anzeigen von Beratern,
 * verfügbaren Terminen und zum Buchen.
 */

import { createCounselorPublicRoutes } from '../../../shared/counselorPublicRoutes.js';
import * as service from '../services/appointmentService.js';

export default createCounselorPublicRoutes(service, {
  tablePrefix: 'ssw',
  counselorLabel: 'Berater/innen',
  moduleName: 'schulsozialarbeit',
});
