import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin/index.js';
import superadminRoutes from './routes/superadmin.js';
import consentRoutes from './routes/consent.js';
import { loadModules } from './moduleLoader.js';
import { initDatabase } from './migrate.js';
import logger from './config/logger.js';
import { startRetentionSchedule } from './jobs/retention-cleanup.js';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Express App
const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy (nginx, Codespaces port forwarding)
app.set('trust proxy', 1);

// CORS – origins from env or sensible defaults for development
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000'];

// Security headers – CSP als Fallback; in Produktion überschreibt nginx die Header
const cspConnectSrc = ["'self'", ...corsOrigins];
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: cspConnectSrc,
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    // Allow GitHub Codespaces forwarded ports (development only).
    // IMPORTANT: Ensure NODE_ENV=production in all non-dev deployments to disable this.
    if (process.env.NODE_ENV !== 'production' && origin && (origin.endsWith('.app.github.dev') || origin.endsWith('.preview.app.github.dev'))) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 40,                     // 40 requests per window (verify, logout, etc.)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
});

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Buchungsanfragen. Bitte später erneut versuchen.' },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
});

// Serve uploaded files (with restrictive CSP to prevent script execution)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Request-ID for correlation (I-03)
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Request logging
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url, reqId: req.id }, 'request');
  next();
});

// Shared kernel routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/superadmin', adminLimiter, superadminRoutes);
app.use('/api/consent', bookingLimiter, consentRoutes);

// 404 + Error handler werden erst nach dem Laden der Module registriert (s.u.)

// Graceful shutdown
const HOST = process.env.HOST || '0.0.0.0';
let server;
let retentionTimers;

function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received, closing server…');
  // Clear retention timers if running
  if (retentionTimers) {
    clearInterval(retentionTimers.timer);
    clearTimeout(retentionTimers.initialDelay);
  }
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
  .then(async () => {
    // Module laden (gesteuert über ENABLED_MODULES oder alle verfügbaren)
    const loaded = await loadModules(app, {
      rateLimiters: { booking: bookingLimiter, admin: adminLimiter, auth: authLimiter },
    });
    logger.info({ modules: loaded }, 'Aktive Module');

    // 404 + Error handler NACH dem Laden der Module registrieren
    app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
    app.use((err, _req, res, _next) => {
      logger.error({ err }, 'Unhandled error');
      res.status(500).json({
        error: 'Internal server error',
        ...(isProduction ? {} : { detail: err.message }),
      });
    });

    // Start retention cleanup schedule (DSGVO data hygiene)
    retentionTimers = startRetentionSchedule();
    logger.info('Retention cleanup job scheduled');

    server = app.listen(PORT, HOST, () => {
      const printedHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
      logger.info(`Backend listening on http://${printedHost}:${PORT}`);
    });
  })
  .catch(err => {
    logger.fatal({ err }, 'Failed to initialize database');
    process.exit(1);
  });
