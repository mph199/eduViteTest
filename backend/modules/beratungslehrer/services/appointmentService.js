/**
 * Beratungslehrer – Appointment Service
 *
 * Thin wrapper around shared counselor service factory.
 */

import { createCounselorService } from '../../../shared/counselorService.js';

const service = createCounselorService({
  tablePrefix: 'bl',
  counselorLabel: 'Beratungslehrer',
});

export const {
  listCounselors,
  getCounselorById,
  listTopics,
  getAvailableAppointments,
  bookAppointment,
  generateTimeSlots,
} = service;
