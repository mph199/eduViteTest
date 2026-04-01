/**
 * Public API Routes — Elternsprechtag
 *
 * Aggregates sub-routers for cleaner separation:
 * - slots.js: Teachers + Slots (GET /teachers, GET /slots)
 * - bookings.js: Booking lifecycle (POST /bookings, POST /booking-requests, GET /verify)
 * - events.js: Event queries (GET /events/active, GET /events/upcoming)
 * - misc.js: Health check + dev helpers
 */

import express from 'express';
import slotsRouter from './public/slots.js';
import bookingsRouter from './public/bookings.js';
import eventsRouter from './public/events.js';
import miscRouter from './public/misc.js';

const router = express.Router();

router.use('/', slotsRouter);
router.use('/', bookingsRouter);
router.use('/', eventsRouter);
router.use('/', miscRouter);

export default router;
