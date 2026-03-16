/**
 * Schulsozialarbeit – Oeffentliche Routen
 *
 * Endpunkte fuer Schueler/innen zum Anzeigen von Beratern,
 * Kategorien, verfuegbaren Terminen und zum Buchen.
 */

import { createCounselorPublicRoutes } from '../../../shared/counselorPublicRoutes.js';
import * as service from '../services/appointmentService.js';

export default createCounselorPublicRoutes(service, {
  topicForeignKey: 'category_id',
  topicEndpoint: '/categories',
  topicResponseKey: 'categories',
  counselorLabel: 'Berater/innen',
});
