/**
 * Schulsozialarbeit – Öffentliche Routen
 *
 * Endpunkte für Schüler/innen zum Anzeigen von Beratern,
 * Kategorien, verfügbaren Terminen und zum Buchen.
 */

import { createCounselorPublicRoutes } from '../../../shared/counselorPublicRoutes.js';
import * as service from '../services/appointmentService.js';

export default createCounselorPublicRoutes(service, {
  tablePrefix: 'ssw',
  topicForeignKey: 'category_id',
  topicEndpoint: '/categories',
  topicResponseKey: 'categories',
  counselorLabel: 'Berater/innen',
  moduleName: 'schulsozialarbeit',
});
