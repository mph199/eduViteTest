import express from 'express';
import feedbackRoutes from './feedbackRoutes.js';
import bookingRoutes from './bookingRoutes.js';
import userRoutes from './userRoutes.js';
import teacherRoutes from './teacherRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import slotsRoutes from './slotsRoutes.js';
import eventsRoutes from './eventsRoutes.js';
import dataSubjectRoutes from './dataSubject.js';

const router = express.Router();

router.use(feedbackRoutes);
router.use(bookingRoutes);
router.use(userRoutes);
router.use(teacherRoutes);
router.use(settingsRoutes);
router.use(slotsRoutes);
router.use(eventsRoutes);
router.use(dataSubjectRoutes);

export default router;
