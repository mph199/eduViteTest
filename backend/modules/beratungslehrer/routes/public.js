/**
 * Beratungslehrer – Öffentliche Routen
 *
 * Endpunkte für Schüler/innen zum Anzeigen von Beratungslehrern,
 * Themen, verfügbaren Terminen und Buchen.
 */

import { createCounselorPublicRoutes } from '../../../shared/counselorPublicRoutes.js';
import * as service from '../services/appointmentService.js';

export default createCounselorPublicRoutes(service, {
  topicForeignKey: 'topic_id',
  topicEndpoint: '/topics',
  topicResponseKey: 'topics',
  counselorLabel: 'Beratungslehrer',
});
