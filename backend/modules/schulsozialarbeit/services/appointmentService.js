/**
 * Schulsozialarbeit – Appointment Service
 *
 * Thin wrapper around shared counselor service factory.
 */

import { createCounselorService } from '../../../shared/counselorService.js';

const service = createCounselorService({
  tablePrefix: 'ssw',
  counselorLabel: 'Berater/in',
});

export const {
  listCounselors,
  getCounselorById,
  listTopics,
  getAvailableAppointments,
  bookAppointment,
  generateTimeSlots,
} = service;
