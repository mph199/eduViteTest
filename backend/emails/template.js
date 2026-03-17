import { query } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'logos');

// Cache branding for 60s to avoid DB hit on every email
let cachedBranding = null;
let cacheExpiry = 0;

export async function getEmailBranding() {
  const now = Date.now();
  if (cachedBranding && now < cacheExpiry) return cachedBranding;

  try {
    const { rows } = await query('SELECT * FROM email_branding WHERE id = 1 LIMIT 1');
    cachedBranding = rows[0] || null;
  } catch {
    cachedBranding = null;
  }

  // Merge DSB fields from site_branding
  try {
    const { rows: sbRows } = await query(
      'SELECT dsb_name, dsb_email, responsible_name, privacy_policy_url FROM site_branding WHERE id = 1 LIMIT 1'
    );
    if (sbRows[0]) {
      cachedBranding = { ...cachedBranding, ...sbRows[0] };
    }
  } catch { /* site_branding may not have new columns yet */ }

  cacheExpiry = now + 60_000;
  return cachedBranding;
}

const DEFAULTS = {
  school_name: 'BKSB',
  logo_url: '',
  primary_color: '#2d5016',
  footer_text: 'Mit freundlichen Grüßen\n\nIhr BKSB-Team',
};

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Wrap email body content in a professional HTML template.
 * @param {object} opts
 * @param {string} opts.body       - inner HTML content (the email-specific part)
 * @param {object} [opts.branding] - email_branding row (fetched, or null for defaults)
 * @returns {string} full HTML email
 */
export function wrapEmailHtml({ body, branding }) {
  const b = { ...DEFAULTS, ...branding };

  // Resolve logo: read file from disk and embed as base64 data URI
  let logoHtml = '';
  if (b.logo_url) {
    try {
      // logo_url may be a full URL (legacy) or just a filename
      const filename = b.logo_url.includes('/') ? b.logo_url.split('/').pop() : b.logo_url;
      const filePath = path.join(UPLOADS_DIR, filename);
      // Path containment check — prevent directory traversal
      if (!path.resolve(filePath).startsWith(path.resolve(UPLOADS_DIR))) {
        throw new Error('Invalid logo path');
      }
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase().replace('.', '');
        const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', gif: 'image/gif' }[ext] || 'image/png';
        const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
        logoHtml = `<div style="background:#ffffff;border-radius:6px;padding:6px;display:inline-block;margin:0 auto 8px;"><img src="${dataUri}" alt="${esc(b.school_name)}" style="max-height:60px;max-width:220px;display:block;" /></div>`;
      }
    } catch { /* ignore – send without logo */ }
  }
  const footerHtml = esc(b.footer_text).replace(/\n/g, '<br/>');

  // Privacy footer (Art. 13/14 DSGVO) – URL-Schema-Whitelist (Defense in Depth)
  const rawPrivacyUrl = b.privacy_policy_url || '/datenschutz';
  const privacyUrl = rawPrivacyUrl.startsWith('/') || rawPrivacyUrl.startsWith('https://') || rawPrivacyUrl.startsWith('http://') ? rawPrivacyUrl : '/datenschutz';
  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
  const fullPrivacyUrl = privacyUrl.startsWith('http') ? privacyUrl : `${baseUrl}${privacyUrl}`;
  let privacyFooter = `<a href="${esc(fullPrivacyUrl)}" style="color:#6b7280;text-decoration:underline;">Datenschutzerklaerung</a>`;
  if (b.responsible_name) {
    privacyFooter = `Verantwortlich: ${esc(b.responsible_name)} | ${privacyFooter}`;
  }
  if (b.dsb_email) {
    privacyFooter += ` | DSB: <a href="mailto:${esc(b.dsb_email)}" style="color:#6b7280;text-decoration:underline;">${esc(b.dsb_email)}</a>`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <!-- Header -->
    <tr>
      <td style="background:${esc(b.primary_color)};padding:20px 24px;text-align:center;">
        <span style="color:#ffffff;font-size:18px;font-weight:600;">${esc(b.school_name)}</span>
      </td>
    </tr>
    <!-- Logo -->
    ${logoHtml ? `<tr><td style="padding:16px 24px 0;text-align:center;">${logoHtml}</td></tr>` : ''}
    <!-- Body -->
    <tr>
      <td style="padding:28px 24px 24px;">
        ${body}
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center;">
        ${footerHtml}
      </td>
    </tr>
    <!-- Privacy Footer (Art. 13/14 DSGVO) -->
    <tr>
      <td style="padding:8px 24px 16px;font-size:11px;color:#9ca3af;text-align:center;">
        ${privacyFooter}
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Build both plain text and HTML for a specific email type.
 * Returns { subject, text, html }.
 */
export function buildEmail(type, data, branding) {
  const builders = {
    'verify-slot': buildVerifySlotEmail,
    'verify-request': buildVerifyRequestEmail,
    'confirmation': buildConfirmationEmail,
    'confirmation-multi': buildMultiConfirmationEmail,
    'cancellation': buildCancellationEmail,
  };

  const builder = builders[type];
  if (!builder) throw new Error(`Unknown email type: ${type}`);
  return builder(data, branding);
}

// ── Individual email builders ──────────────────────────────────────

function buildVerifySlotEmail(data, branding) {
  const { date, time, teacherName, teacherRoom, verifyUrl } = data;
  const subject = `${(branding || DEFAULTS).school_name} Elternsprechtag – E-Mail-Adresse bestätigen (Terminreservierung)`;

  const text = `Guten Tag,

bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminreservierung abzuschließen.

Termin: ${date} ${time}
Lehrkraft: ${teacherName || '—'}
Raum: ${teacherRoom || '—'}

Bestätigungslink: ${verifyUrl}

Hinweis: Erst nach erfolgreicher Bestätigung kann die Lehrkraft Ihren Termin verbindlich bestätigen.`;

  const body = `<p>Guten Tag,</p>
<p>bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminreservierung abzuschließen.</p>
<p><strong>Termin:</strong> ${esc(date)} ${esc(time)}<br/>
<strong>Lehrkraft:</strong> ${esc(teacherName || '—')}<br/>
<strong>Raum:</strong> ${esc(teacherRoom || '—')}</p>
<p style="margin:20px 0;"><a href="${esc(verifyUrl)}" style="display:inline-block;padding:12px 28px;background:${esc((branding || DEFAULTS).primary_color)};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">E-Mail-Adresse jetzt bestätigen</a></p>
<p style="font-size:13px;color:#6b7280;"><strong>Hinweis:</strong> Erst nach erfolgreicher Bestätigung kann die Lehrkraft Ihren Termin verbindlich bestätigen.</p>`;

  const html = wrapEmailHtml({ body, branding });
  return { subject, text, html };
}

function buildVerifyRequestEmail(data, branding) {
  const { date, requestedTime, teacherName, teacherRoom, verifyUrl } = data;
  const subject = `${(branding || DEFAULTS).school_name} Elternsprechtag – E-Mail-Adresse bestätigen (Terminanfrage)`;

  const text = `Guten Tag,

bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminanfrage abzuschließen.

Gewünschter Zeitraum: ${date} ${requestedTime}
Lehrkraft: ${teacherName || '—'}
Raum: ${teacherRoom || '—'}

Bestätigungslink: ${verifyUrl}

Hinweis: Die Lehrkraft vergibt die Termine. Nach Bestätigung Ihrer E-Mail-Adresse kann die Lehrkraft die Anfrage annehmen.`;

  const body = `<p>Guten Tag,</p>
<p>bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminanfrage abzuschließen.</p>
<p><strong>Gewünschter Zeitraum:</strong> ${esc(date)} ${esc(requestedTime)}<br/>
<strong>Lehrkraft:</strong> ${esc(teacherName || '—')}<br/>
<strong>Raum:</strong> ${esc(teacherRoom || '—')}</p>
<p style="margin:20px 0;"><a href="${esc(verifyUrl)}" style="display:inline-block;padding:12px 28px;background:${esc((branding || DEFAULTS).primary_color)};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">E-Mail-Adresse jetzt bestätigen</a></p>
<p style="font-size:13px;color:#6b7280;"><strong>Hinweis:</strong> Die Lehrkraft vergibt die Termine. Nach Bestätigung Ihrer E-Mail-Adresse kann die Lehrkraft die Anfrage annehmen.</p>`;

  const html = wrapEmailHtml({ body, branding });
  return { subject, text, html };
}

function buildConfirmationEmail(data, branding) {
  const { date, time, teacherName, teacherRoom, teacherMessage, label } = data;
  const msgLabel = label || 'Ihre Terminanfrage wurde durch die Lehrkraft angenommen.';
  const subject = `${(branding || DEFAULTS).school_name} Elternsprechtag – Termin bestätigt am ${date} (${time})`;

  const teacherMsgPlain = teacherMessage ? `\n\nNachricht der Lehrkraft:\n${teacherMessage}` : '';
  const teacherMsgHtml = teacherMessage
    ? `<p><strong>Nachricht der Lehrkraft:</strong><br/>${esc(teacherMessage).replace(/\n/g, '<br/>')}</p>`
    : '';

  const text = `Guten Tag,

${msgLabel}

Termin: ${date} ${time}
Lehrkraft: ${teacherName || '—'}
Raum: ${teacherRoom || '—'}
${teacherMsgPlain}`;

  const body = `<p>Guten Tag,</p>
<p>${esc(msgLabel)}</p>
<p><strong>Termin:</strong> ${esc(date)} ${esc(time)}<br/>
<strong>Lehrkraft:</strong> ${esc(teacherName || '—')}<br/>
<strong>Raum:</strong> ${esc(teacherRoom || '—')}</p>
${teacherMsgHtml}`;

  const html = wrapEmailHtml({ body, branding });
  return { subject, text, html };
}

function buildMultiConfirmationEmail(data, branding) {
  const { date, slots, teacherName, teacherRoom, teacherMessage } = data;
  const timesFormatted = slots.map((s) => s.time).join(', ');
  const subject = `${(branding || DEFAULTS).school_name} Elternsprechtag – ${slots.length} Termine bestätigt am ${date} (${timesFormatted})`;

  const teacherMsgPlain = teacherMessage ? `\n\nNachricht der Lehrkraft:\n${teacherMessage}` : '';
  const teacherMsgHtml = teacherMessage
    ? `<p><strong>Nachricht der Lehrkraft:</strong><br/>${esc(teacherMessage).replace(/\n/g, '<br/>')}</p>`
    : '';
  const timesListPlain = slots.map((s, i) => `  ${i + 1}. ${s.time}`).join('\n');
  const timesListHtml = slots.map((s) => `<li>${esc(s.time)}</li>`).join('');

  const text = `Guten Tag,

Ihre Terminanfrage wurde durch die Lehrkraft angenommen.

Es wurden ${slots.length} Termine für Sie vergeben:
${timesListPlain}

Datum: ${date}
Lehrkraft: ${teacherName || '—'}
Raum: ${teacherRoom || '—'}
${teacherMsgPlain}`;

  const body = `<p>Guten Tag,</p>
<p>Ihre Terminanfrage wurde durch die Lehrkraft angenommen.</p>
<p>Es wurden <strong>${slots.length} Termine</strong> für Sie vergeben:</p>
<ul>${timesListHtml}</ul>
<p><strong>Datum:</strong> ${esc(date)}<br/>
<strong>Lehrkraft:</strong> ${esc(teacherName || '—')}<br/>
<strong>Raum:</strong> ${esc(teacherRoom || '—')}</p>
${teacherMsgHtml}`;

  const html = wrapEmailHtml({ body, branding });
  return { subject, text, html };
}

function buildCancellationEmail(data, branding) {
  const { date, time, teacherName, teacherRoom, cancellationMessage } = data;
  const subject = `${(branding || DEFAULTS).school_name} Elternsprechtag – Termin storniert am ${date} (${time})`;

  const msgLine = cancellationMessage ? `\nBegründung:\n${cancellationMessage}\n` : '';
  const text = `Guten Tag,

wir müssen Ihnen leider mitteilen, dass Ihr Termin storniert wurde.
${msgLine}
Termin: ${date} ${time}
Lehrkraft: ${teacherName || '—'}
Raum: ${teacherRoom || '—'}

Wenn Sie einen neuen Termin vereinbaren möchten, können Sie dies jederzeit über das Buchungssystem tun.`;

  const msgHtml = cancellationMessage
    ? `<p><strong>Begründung:</strong><br/>${esc(cancellationMessage).replace(/\n/g, '<br/>')}</p>`
    : '';
  const body = `<p>Guten Tag,</p>
<p>wir müssen Ihnen leider mitteilen, dass Ihr Termin storniert wurde.</p>
${msgHtml}
<p><strong>Termin:</strong> ${esc(date)} ${esc(time)}<br/>
<strong>Lehrkraft:</strong> ${esc(teacherName || '—')}<br/>
<strong>Raum:</strong> ${esc(teacherRoom || '—')}</p>
<p>Wenn Sie einen neuen Termin vereinbaren möchten, können Sie dies jederzeit über das Buchungssystem tun.</p>`;

  const html = wrapEmailHtml({ body, branding });
  return { subject, text, html };
}
