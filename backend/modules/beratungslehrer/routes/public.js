/**
 * Beratungslehrer – Oeffentliche Routen
 *
 * Endpunkte fuer Schueler/innen zum Anzeigen von Beratungslehrern,
 * Themen, verfuegbaren Terminen und Buchen.
 */

import { createCounselorPublicRoutes } from '../../../shared/counselorPublicRoutes.js';
import * as service from '../services/appointmentService.js';

export default createCounselorPublicRoutes(service, {
  topicForeignKey: 'topic_id',
  topicEndpoint: '/topics',
  topicResponseKey: 'topics',
  counselorLabel: 'Beratungslehrer',
});
