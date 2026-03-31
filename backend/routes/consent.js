/**
 * Consent-Widerruf (DSGVO Art. 7 Abs. 3)
 *
 * Public endpoint – rate-limited, no auth required.
 * Allows data subjects to withdraw consent and anonymize their booking data.
 */

import express from 'express';
import { sql } from 'kysely';
import { createRateLimiter } from '../config/rateLimiter.js';
import { db } from '../db/database.js';
import logger from '../config/logger.js';
import { validate } from '../middleware/validate.js';
import { consentWithdrawSchema } from '../schemas/booking.js';

const router = express.Router();

const consentLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Zu viele Anfragen. Bitte spaeter erneut versuchen.' },
});

router.post('/withdraw', consentLimiter, validate(consentWithdrawSchema), async (req, res) => {
  try {
    const { email: normalizedEmail, module: moduleName } = req.body;

    let anonymizedCount = 0;

    if (moduleName === 'elternsprechtag') {
      const result = await sql`SELECT anonymize_booking_requests_by_email(${normalizedEmail}) AS affected`.execute(db);
      anonymizedCount = result.rows[0]?.affected || 0;
    } else if (moduleName === 'schulsozialarbeit') {
      const result = await db.updateTable('ssw_appointments')
        .set({
          student_name: null, student_class: null, email: null, phone: null,
          restricted: true, updated_at: new Date(),
        })
        .where(sql`LOWER(email)`, '=', normalizedEmail)
        .where('email', 'is not', null)
        .executeTakeFirst();
      anonymizedCount = Number(result?.numUpdatedRows ?? 0);
    } else if (moduleName === 'beratungslehrer') {
      const result = await db.updateTable('bl_appointments')
        .set({
          student_name: null, student_class: null, email: null, phone: null,
          restricted: true, updated_at: new Date(),
        })
        .where(sql`LOWER(email)`, '=', normalizedEmail)
        .where('email', 'is not', null)
        .executeTakeFirst();
      anonymizedCount = Number(result?.numUpdatedRows ?? 0);
    }

    if (anonymizedCount > 0) {
      await db.insertInto('consent_receipts')
        .values({
          module: moduleName,
          appointment_id: null,
          consent_version: 'withdrawal',
          consent_purpose: 'Widerruf der Einwilligung',
          ip_address: req.ip || null,
          user_agent: req.get('user-agent') || null,
        })
        .execute();
    }

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
