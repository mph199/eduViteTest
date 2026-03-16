/**
 * Beratungslehrer – Appointment Service
 *
 * Thin wrapper around shared counselor service factory.
 */

import { createCounselorService } from '../../../shared/counselorService.js';

const service = createCounselorService({
  tablePrefix: 'bl',
  counselorLabel: 'Beratungslehrer',
  topicTable: 'bl_topics',
  topicForeignKey: 'topic_id',
  topicSelectCols: ['id', 'name', 'description'],
});

export const {
  listCounselors,
  getCounselorById,
  listTopics,
  getAvailableAppointments,
  bookAppointment,
  generateTimeSlots,
} = service;
