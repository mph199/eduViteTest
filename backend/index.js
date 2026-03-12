import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import teacherRoutes from './routes/teacher.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import superadminRoutes from './routes/superadmin.js';
import { initDatabase } from './migrate.js';
import logger from './config/logger.js';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Express App
const app = express();
const PORT = process.env.PORT || 4000;

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // managed by nginx/reverse proxy in production
  crossOriginEmbedderPolicy: false,
}));

// CORS – origins from env or sensible defaults for development
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                     // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.' },
});

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Buchungsanfragen. Bitte später erneut versuchen.' },
});

// Serve uploaded files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'request');
  next();
});

// Routes (with rate limiters)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);

// Apply booking limiter to specific public endpoints
app.post('/api/bookings', bookingLimiter);
app.post('/api/booking-requests', bookingLimiter);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler – no stack traces in production
app.use((err, _req, res, _next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
    ...(isProduction ? {} : { detail: err.message }),
  });
});

// Graceful shutdown
const HOST = process.env.HOST || '0.0.0.0';
let server;

function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received, closing server…');
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      // Import pool dynamically to close DB connections
      import('./config/db.js').then(({ default: pool }) => {
        pool.end().then(() => {
          logger.info('DB pool closed');
          process.exit(0);
        });
      });
    });
    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      logger.warn('Forced exit after timeout');
      process.exit(1);
    }, 10_000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

initDatabase()
  .then(() => {
    server = app.listen(PORT, HOST, () => {
      const printedHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
      logger.info(`Backend listening on http://${printedHost}:${PORT}`);
    });
  })
  .catch(err => {
    logger.fatal({ err }, 'Failed to initialize database');
    process.exit(1);
  });
