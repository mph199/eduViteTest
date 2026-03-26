/**
 * Beratungslehrer – Öffentliche Routen
 *
 * Endpunkte für Schüler/innen zum Anzeigen von Beratungslehrern,
 * verfügbaren Terminen und Buchen.
 */

import { createCounselorPublicRoutes } from '../../../shared/counselorPublicRoutes.js';
import * as service from '../services/appointmentService.js';

export default createCounselorPublicRoutes(service, {
  tablePrefix: 'bl',
  counselorLabel: 'Beratungslehrer',
  moduleName: 'beratungslehrer',
});
