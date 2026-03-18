import express from 'express';
import bookingRoutes from './teacher/bookings.js';
import requestRoutes from './teacher/requests.js';
import miscRoutes from './teacher/misc.js';
import passwordRoutes from './teacher/password.js';

// Import autoAssign to start the global sweep timer
import './teacher/lib/autoAssign.js';

const router = express.Router();

router.use(bookingRoutes);
router.use(requestRoutes);
router.use(miscRoutes);
router.use(passwordRoutes);

export default router;
