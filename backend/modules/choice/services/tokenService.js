/**
 * Token-Service fuer Choice-Modul.
 *
 * Generiert kryptographisch sichere Einmal-Tokens,
 * speichert nur SHA-256-Hashes in der DB.
 * TTL konfigurierbar über CHOICE_TOKEN_TTL_HOURS (Default: 24h).
 */

import crypto from 'crypto';
import { db } from '../../../db/database.js';

const TOKEN_TTL_HOURS = Number.parseInt(process.env.CHOICE_TOKEN_TTL_HOURS || '24', 10) || 24;

/**
 * Erzeugt einen neuen Verifizierungstoken für einen Teilnehmer.
 * @param {string} participantId – UUID des Teilnehmers
 * @returns {{ token: string, expiresAt: Date }} – Klartext-Token (nur für E-Mail) + Ablaufzeit
 */
export async function createToken(participantId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await db.insertInto('choice_email_tokens')
    .values({
      participant_id: participantId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .execute();

  return { token, expiresAt };
}

/**
 * Validiert einen Token und gibt den Teilnehmer zurück.
 * Single-Use: setzt used_at nach erfolgreicher Validierung.
 *
 * @param {string} token – Klartext-Token aus dem Verify-Link
 * @returns {{ participantId: string, groupId: string } | null}
 */
export async function validateAndConsumeToken(token) {
  if (!token || typeof token !== 'string') return null;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Atomare Transaktion mit FOR UPDATE gegen Race Conditions
  return db.transaction().execute(async (trx) => {
    const row = await trx.selectFrom('choice_email_tokens as t')
      .innerJoin('choice_participants as p', 'p.id', 't.participant_id')
      .select(['t.id', 't.participant_id', 't.expires_at', 'p.group_id'])
      .where('t.token_hash', '=', tokenHash)
      .where('t.used_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!row) return null;

    // TTL prüfen
    if (new Date(row.expires_at) < new Date()) return null;

    // Token als verwendet markieren (Single-Use)
    await trx.updateTable('choice_email_tokens')
      .set({ used_at: new Date() })
      .where('id', '=', row.id)
      .execute();

    return {
      participantId: row.participant_id,
      groupId: row.group_id,
    };
  });
}

/**
 * Invalidiert alle offenen Tokens eines Teilnehmers
 * (z.B. vor dem Erstellen eines neuen Tokens).
 */
export async function invalidateTokensForParticipant(participantId) {
  await db.updateTable('choice_email_tokens')
    .set({ used_at: new Date() })
    .where('participant_id', '=', participantId)
    .where('used_at', 'is', null)
    .execute();
}
