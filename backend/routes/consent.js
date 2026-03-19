/**
 * Consent-Widerruf (DSGVO Art. 7 Abs. 3)
 *
 * Public endpoint – rate-limited, no auth required.
 * Allows data subjects to withdraw consent and anonymize their booking data.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../config/db.js';
import logger from '../config/logger.js';
import { validate } from '../middleware/validate.js';
import { consentWithdrawSchema } from '../schemas/booking.js';

const router = express.Router();

const consentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Zu viele Anfragen. Bitte spaeter erneut versuchen.' },
});

/**
 * POST /api/consent/withdraw
 *
 * Body: { email: string, module: 'elternsprechtag' | 'schulsozialarbeit' | 'beratungslehrer' }
 *
 * Anonymizes all bookings for the given email in the given module.
 * Does NOT delete consent_receipts (append-only, proof of prior consent).
 */
router.post('/withdraw', consentLimiter, validate(consentWithdrawSchema), async (req, res) => {
  try {
    const { email: normalizedEmail, module: moduleName } = req.body;

    let anonymizedCount = 0;

    if (moduleName === 'elternsprechtag') {
      const { rowCount } = await query(
        `UPDATE booking_requests
         SET parent_name = NULL, student_name = NULL, company_name = NULL,
             trainee_name = NULL, representative_name = NULL,
             class_name = NULL, email = NULL, message = NULL,
             updated_at = NOW()
         WHERE LOWER(email) = $1 AND email IS NOT NULL`,
        [normalizedEmail]
      );
      anonymizedCount = rowCount;
    } else if (moduleName === 'schulsozialarbeit') {
      const { rowCount } = await query(
        `UPDATE ssw_appointments
         SET student_name = NULL, student_class = NULL, email = NULL, phone = NULL,
             updated_at = NOW()
         WHERE LOWER(email) = $1 AND email IS NOT NULL`,
        [normalizedEmail]
      );
      anonymizedCount = rowCount;
    } else if (moduleName === 'beratungslehrer') {
      const { rowCount } = await query(
        `UPDATE bl_appointments
         SET student_name = NULL, student_class = NULL, email = NULL, phone = NULL,
             updated_at = NOW()
         WHERE LOWER(email) = $1 AND email IS NOT NULL`,
        [normalizedEmail]
      );
      anonymizedCount = rowCount;
    }

    // Log the withdrawal (append-only) – only if data was actually anonymized
    if (anonymizedCount > 0) {
      await query(
        `INSERT INTO consent_receipts (module, appointment_id, consent_version, consent_purpose, ip_address, user_agent)
         VALUES ($1, NULL, $2, $3, $4, $5)`,
        [
          moduleName,
          'withdrawal',
          'Widerruf der Einwilligung',
          req.ip || null,
          req.get('user-agent') || null,
        ]
      );
    }

    // Einheitliche Antwort (kein Leak ob E-Mail im System existiert)
    res.json({
      success: true,
      message: 'Widerruf verarbeitet. Falls Daten vorhanden waren, wurden diese anonymisiert.',
    });
  } catch (err) {
    logger.error({ err }, 'consent withdraw error');
    res.status(500).json({ error: 'Fehler beim Widerruf' });
  }
});

export default router;
