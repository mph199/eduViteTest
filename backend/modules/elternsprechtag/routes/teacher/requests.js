import express from 'express';
import { requireAuth } from '../../../../middleware/auth.js';
import { query } from '../../../../config/db.js';
import { mapSlotRow, mapBookingRequestRow } from '../../../../utils/mappers.js';
import logger from '../../../../config/logger.js';
import { requireTeacher } from './lib/middleware.js';
import {
  buildAssignableSlotTimesFromRequestedWindow,
  assignRequestToSlot,
  assignExtraSlot,
  sendMultiSlotConfirmation,
} from './lib/slotAssignment.js';
import { autoAssignOverdueRequestsForTeacher } from './lib/autoAssign.js';

const router = express.Router();

/**
 * GET /api/teacher/requests
 */
router.get('/requests', requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    // Auto-assign verified requests older than 24h to the earliest free slot.
    await autoAssignOverdueRequestsForTeacher(teacherId);

    const { rows: requestData } = await query(
      `SELECT * FROM booking_requests
       WHERE teacher_id = $1 AND status = 'requested'
       ORDER BY created_at DESC LIMIT 500`,
      [teacherId]
    );

    return res.json({
      requests: await (async () => {
        const rows = requestData || [];
        const dates = Array.from(new Set(rows.map((row) => row.date).filter(Boolean)));

        let allFreeSlots = [];
        if (dates.length) {
          const SLOT_LIMIT = 3000;
          const { rows: freeSlotRows } = await query(
            `SELECT time, date FROM slots
             WHERE teacher_id = $1 AND booked = false AND date = ANY($2)
             ORDER BY time ASC LIMIT $3`,
            [teacherId, dates, SLOT_LIMIT]
          );
          allFreeSlots = freeSlotRows || [];
        }

        return rows.map((row) => {
          const scopedFreeTimes = allFreeSlots
            .filter((slot) => slot.date === row.date)
            .map((slot) => slot.time)
            .filter((value, index, arr) => arr.indexOf(value) === index);

          return {
            ...mapBookingRequestRow(row),
            assignableTimes: buildAssignableSlotTimesFromRequestedWindow(row.requested_time),
            availableTimes: scopedFreeTimes,
          };
        });
      })(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching teacher requests');
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

/**
 * PUT /api/teacher/requests/:id/accept
 */
router.put('/requests/:id/accept', requireAuth, requireTeacher, async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  if (isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request id' });
  }

  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const { rows: currentRows } = await query(
      'SELECT * FROM booking_requests WHERE id = $1 AND teacher_id = $2',
      [requestId, teacherId]
    );
    const current = currentRows[0] || null;

    if (!current) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (current.status === 'accepted') {
      return res.json({ success: true, request: mapBookingRequestRow(current) });
    }

    if (current.status !== 'requested') {
      return res.status(409).json({ error: 'Request is not pending' });
    }

    if (!current.verified_at) {
      return res.status(409).json({
        error: 'Anfrage kann erst angenommen werden, nachdem die E-Mail-Adresse verifiziert wurde',
      });
    }

    // Support both 'times' (array) and 'time' (single string) for backward compat
    let rawTimes = [];
    if (Array.isArray(req.body?.times) && req.body.times.length > 0) {
      rawTimes = req.body.times.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
    } else if (typeof req.body?.time === 'string' && req.body.time.trim()) {
      rawTimes = [req.body.time.trim()];
    }

    const rawTeacherMessage = typeof req.body?.teacherMessage === 'string' ? req.body.teacherMessage.trim() : '';
    if (rawTeacherMessage.length > 1000) {
      return res.status(400).json({ error: 'Nachricht der Lehrkraft darf maximal 1000 Zeichen lang sein' });
    }

    // Assign first slot using assignRequestToSlot (updates booking_requests status)
    const firstTime = rawTimes[0] || null;
    const skipEmail = rawTimes.length > 1;
    const assignment = await assignRequestToSlot(current, teacherId, firstTime, rawTeacherMessage || '', { skipEmail });
    if (!assignment.ok) {
      if (assignment.code === 'INVALID_TIME_SELECTION') {
        return res.status(400).json({ error: 'Ungültige Zeit-Auswahl', assignableTimes: assignment.candidateTimes || [] });
      }
      if (assignment.code === 'INVALID_REQUEST_WINDOW') {
        return res.status(400).json({ error: 'Anfrage-Zeitraum ist ungültig' });
      }
      if (assignment.code === 'NO_SLOT_AVAILABLE') {
        return res.status(409).json({
          error: 'Slot nicht verfügbar. Bitte prüfen, ob Slots für das Event generiert wurden oder ob der Slot bereits vergeben ist.',
          details: assignment.details,
        });
      }
      if (assignment.code === 'SLOT_ALREADY_BOOKED') {
        return res.status(409).json({ error: 'Slot bereits vergeben' });
      }
      if (assignment.code === 'REQUEST_NOT_PENDING_ANYMORE') {
        return res.status(409).json({ error: 'Anfrage ist nicht mehr offen' });
      }
      return res.status(409).json({ error: 'Anfrage konnte nicht angenommen werden' });
    }

    const allSlots = [assignment.updatedSlot];

    // Assign additional slots if multiple times were requested
    if (rawTimes.length > 1) {
      for (let i = 1; i < rawTimes.length; i++) {
        const additionalTime = rawTimes[i];
        try {
          const extraAssignment = await assignExtraSlot(current, teacherId, additionalTime);
          if (extraAssignment.ok) {
            allSlots.push(extraAssignment.updatedSlot);
          } else {
            logger.warn({ code: extraAssignment.code, time: additionalTime }, 'Multi-slot assignment: could not assign additional slot');
          }
        } catch (e) {
          logger.warn({ err: e, time: additionalTime }, 'Multi-slot assignment: error assigning time');
        }
      }
    }

    // If multiple slots were assigned, send a combined confirmation email
    if (allSlots.length > 1) {
      await sendMultiSlotConfirmation(allSlots, assignment.updatedReq, teacherId, rawTeacherMessage);
    }

    return res.json({
      success: true,
      request: mapBookingRequestRow(assignment.updatedReq),
      slot: mapSlotRow(assignment.updatedSlot),
      slots: allSlots.map(mapSlotRow),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error accepting booking request');
    return res.status(500).json({ error: 'Failed to accept request' });
  }
});

/**
 * PUT /api/teacher/requests/:id/decline
 */
router.put('/requests/:id/decline', requireAuth, requireTeacher, async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  if (isNaN(requestId)) {
    return res.status(400).json({ error: 'Invalid request id' });
  }

  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID not found in token' });
    }

    const now = new Date().toISOString();
    const { rows: declineRows } = await query(
      `UPDATE booking_requests SET status = 'declined', updated_at = $1
       WHERE id = $2 AND teacher_id = $3 AND status = 'requested'
       RETURNING *`,
      [now, requestId, teacherId]
    );

    if (declineRows.length === 0) {
      return res.status(404).json({ error: 'Request not found or not pending' });
    }

    return res.json({ success: true, request: mapBookingRequestRow(declineRows[0]) });
  } catch (error) {
    logger.error({ err: error }, 'Error declining booking request');
    return res.status(500).json({ error: 'Failed to decline request' });
  }
});

export default router;
