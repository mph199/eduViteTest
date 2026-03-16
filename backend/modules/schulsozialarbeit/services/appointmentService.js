/**
 * Schulsozialarbeit – Appointment Service
 *
 * Thin wrapper around shared counselor service factory.
 */

import { createCounselorService } from '../../../shared/counselorService.js';

const service = createCounselorService({
  tablePrefix: 'ssw',
  counselorLabel: 'Berater/in',
  topicTable: 'ssw_categories',
  topicForeignKey: 'category_id',
  topicSelectCols: ['id', 'name', 'description', 'icon'],
});

export const {
  listCounselors,
  getCounselorById,
  listTopics,
  getAvailableAppointments,
  bookAppointment,
  generateTimeSlots,
} = service;

// Re-export with original name for backwards compatibility
export const listCategories = listTopics;
