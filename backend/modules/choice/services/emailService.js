/**
 * E-Mail-Service fuer Choice-Modul.
 *
 * Sendet Einladungs- und Verifizierungsmails an Teilnehmer.
 * Nutzt den zentralen E-Mail-Transporter aus config/email.js.
 */

import { sendMail, isEmailConfigured } from '../../../config/email.js';
import logger from '../../../config/logger.js';

const TOKEN_TTL_HOURS = Number.parseInt(process.env.CHOICE_TOKEN_TTL_HOURS || '24', 10) || 24;

const log = logger.child({ component: 'choice-email' });

/**
 * Sendet eine Einladungsmail mit Verifizierungslink.
 *
 * @param {{ email: string, firstName: string, lastName: string }} participant
 * @param {{ title: string, id: string }} group
 * @param {string} token – Klartext-Token für den Verify-Link
 * @returns {Promise<{ sent: boolean, previewUrl?: string }>}
 */
export async function sendInviteEmail(participant, group, token) {
  if (!isEmailConfigured()) {
    log.warn({ email: participant.email }, 'E-Mail nicht konfiguriert, Einladung übersprungen');
    return { sent: false };
  }

  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
  // Sicherstellen, dass baseUrl ein HTTP(S)-Schema hat
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      log.error({ baseUrl }, 'PUBLIC_BASE_URL hat kein HTTP(S)-Schema');
      return { sent: false };
    }
  } catch {
    log.error({ baseUrl }, 'PUBLIC_BASE_URL ist keine gültige URL');
    return { sent: false };
  }
  const verifyUrl = `${baseUrl}/wahl/${group.id}/verify?token=${token}`;

  const subject = `Einladung zur Differenzierungswahl: ${group.title}`;

  const text = [
    `Hallo ${participant.firstName} ${participant.lastName},`,
    '',
    `Sie wurden zur Differenzierungswahl "${group.title}" eingeladen.`,
    '',
    'Bitte klicken Sie auf den folgenden Link, um Ihre Wahl abzugeben:',
    verifyUrl,
    '',
    `Dieser Link ist ${TOKEN_TTL_HOURS} Stunden gültig und kann nur einmal verwendet werden.`,
    'Falls der Link abgelaufen ist, können Sie über die Wahlseite einen neuen anfordern.',
    '',
    'Mit freundlichen Grüßen',
    'Ihr Schulverwaltungsteam',
  ].join('\n');

  const html = [
    `<p>Hallo ${escapeHtml(participant.firstName)} ${escapeHtml(participant.lastName)},</p>`,
    `<p>Sie wurden zur Differenzierungswahl <strong>&bdquo;${escapeHtml(group.title)}&ldquo;</strong> eingeladen.</p>`,
    '<p>Bitte klicken Sie auf den folgenden Button, um Ihre Wahl abzugeben:</p>',
    `<p><a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:12px 24px;background:#1976d2;color:#fff;text-decoration:none;border-radius:4px">Zur Wahl</a></p>`,
    `<p style="font-size:0.85em;color:#666">Dieser Link ist ${TOKEN_TTL_HOURS} Stunden gültig und kann nur einmal verwendet werden.<br>`,
    'Falls der Link abgelaufen ist, können Sie über die Wahlseite einen neuen anfordern.</p>',
    '<p>Mit freundlichen Grüßen<br>Ihr Schulverwaltungsteam</p>',
  ].join('\n');

  try {
    const result = await sendMail({ to: participant.email, subject, text, html });
    log.info({ email: participant.email, groupId: group.id, previewUrl: result.previewUrl }, 'Einladungsmail gesendet');
    return { sent: true, previewUrl: result.previewUrl || undefined };
  } catch (err) {
    log.error({ err, email: participant.email }, 'Einladungsmail fehlgeschlagen');
    return { sent: false };
  }
}

/** Simple HTML escaping for user-provided values. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
