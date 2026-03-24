import { query } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'logos');

// ── Cache ────────────────────────────────────────────────────────────
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

// ── Escaping ─────────────────────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Text Utilities ───────────────────────────────────────────────────

/** Return trimmed string or fallback (em dash) for empty/undefined values. */
function safeText(val, fallback = '\u2014') {
  const s = val != null ? String(val).trim() : '';
  return s || fallback;
}

// ── Color Utilities ──────────────────────────────────────────────────

/** Normalize hex to #RRGGBB. Returns DEFAULTS.primary_color for invalid input. */
function sanitizeHex(hex) {
  if (!hex || typeof hex !== 'string') return DEFAULTS.primary_color;
  const clean = hex.replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return '#' + clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '#' + clean;
  }
  return DEFAULTS.primary_color;
}

function hexToRgb(hex) {
  const safe = sanitizeHex(hex);
  const h = safe.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

function darkenHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 - amount;
  return rgbToHex(r * factor, g * factor, b * factor);
}

function lightenHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

function buildColorTokens(primaryColor) {
  const pc = sanitizeHex(primaryColor);
  return {
    primary: pc,
    primary_dark: darkenHex(pc, 0.15),
    primary_light: lightenHex(pc, 0.88),
    ink: '#1a1a1a',
    ink_soft: '#374151',
    ink_muted: '#9ca3af',
    border: '#e5e5e0',
    surface: '#ffffff',
    background: '#f7f6f3',
    confirm: '#16a34a',
    confirm_light: '#f0fdf4',
    cancel: '#dc2626',
    cancel_light: '#fef2f2',
  };
}

// ── Shared HTML Components ───────────────────────────────────────────

function renderPreheader(text) {
  if (!text) return '';
  return `<div style="display:none;font-size:1px;color:#f7f6f3;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(text)} &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>`;
}

// Max logo file size for base64 embedding (~150KB file ≈ ~200KB base64).
// Larger logos are skipped to keep email size manageable.
const MAX_LOGO_BYTES = 200_000;

function renderLogoBlock(branding, tokens) {
  const b = { ...DEFAULTS, ...branding };
  let logoContent = '';

  if (b.logo_url) {
    try {
      const filename = b.logo_url.includes('/') ? b.logo_url.split('/').pop() : b.logo_url;
      const filePath = path.join(UPLOADS_DIR, filename);
      if (!path.resolve(filePath).startsWith(path.resolve(UPLOADS_DIR))) {
        logger.warn({ logoUrl: b.logo_url }, 'Ungültiger Logo-Pfad (Path-Traversal-Versuch)');
      } else if (!fs.existsSync(filePath)) {
        logger.warn({ filePath }, 'Logo-Datei nicht gefunden');
      } else {
        const buf = fs.readFileSync(filePath);
        if (buf.length > MAX_LOGO_BYTES) {
          logger.warn({ bytes: buf.length, max: MAX_LOGO_BYTES }, 'Logo zu groß für E-Mail-Einbettung');
        } else {
          const ext = path.extname(filename).toLowerCase().replace('.', '');
          const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[ext] || 'image/png';
          const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
          logoContent = `<img src="${esc(dataUri)}" alt="${esc(b.school_name)}" width="auto" height="60" style="display:block;height:60px;width:auto;max-width:280px;border:0;outline:none;text-decoration:none;" />`;
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Fehler beim Laden des Logos für E-Mail');
    }
  }

  // Fallback: show school name as styled text header (no platform branding)
  if (!logoContent) {
    logoContent = `<span style="font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;line-height:24px;mso-line-height-rule:exactly;color:${esc(tokens.ink)};">${esc(b.school_name)}</span>`;
  }

  return `<tr><td align="center" style="padding:32px 36px 0;" class="email-padding">${logoContent}</td></tr>`;
}

function renderStatusBadge(type, tokens) {
  const isConfirm = type === 'confirmed';
  const bg = isConfirm ? tokens.confirm_light : tokens.cancel_light;
  const color = isConfirm ? tokens.confirm : tokens.cancel;
  const label = isConfirm ? 'Bestätigt' : 'Storniert';

  return `<tr><td align="center" style="padding:20px 36px 0;" class="email-padding"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${bg};border-radius:100px;padding:6px 16px 6px 12px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${color};line-height:20px;mso-line-height-rule:exactly;"><!--[if mso]>&nbsp;<![endif]--><span style="display:inline-block;width:8px;height:8px;background-color:${color};border-radius:50%;vertical-align:middle;margin-right:8px;"></span>${esc(label)}</td></tr></table></td></tr>`;
}

function renderBookingDetailsCard(rows, headerLabel, headerBg, tokens) {
  const rowsHtml = rows
    .filter((r) => r.value)
    .map((r) => `<tr><td style="padding:10px 16px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;mso-line-height-rule:exactly;color:${tokens.ink_muted};border-bottom:1px solid ${tokens.border};white-space:nowrap;vertical-align:top;" width="120">${esc(r.label)}</td><td style="padding:10px 16px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;mso-line-height-rule:exactly;color:${tokens.ink};border-bottom:1px solid ${tokens.border};vertical-align:top;">${esc(r.value)}</td></tr>`)
    .join('');

  return `<tr><td style="padding:24px 36px 0;" class="email-padding"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid ${tokens.border};border-radius:12px;overflow:hidden;"><!--[if mso]><tr><td style="background-color:${headerBg};padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${tokens.ink_soft};line-height:16px;text-transform:uppercase;letter-spacing:0.5px;" colspan="2">${esc(headerLabel)}</td></tr><![endif]--><!--[if !mso]><!--><tr><td style="background-color:${headerBg};padding:10px 16px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${tokens.ink_soft};line-height:16px;mso-line-height-rule:exactly;text-transform:uppercase;letter-spacing:0.5px;border-radius:12px 12px 0 0;" colspan="2">${esc(headerLabel)}</td></tr><!--<![endif]-->${rowsHtml}</table></td></tr>`;
}

function renderCtaButton(text, url, bgColor, tokens) {
  const safeUrl = esc(url);
  const safeText = esc(text);
  const textColor = '#ffffff';

  return `<tr><td align="center" style="padding:28px 36px 0;" class="email-padding"><!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="17%" stroke="f" fillcolor="${bgColor}"><w:anchorlock/><center style="color:${textColor};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">${safeText}</center></v:roundrect><![endif]--><!--[if !mso]><!--><a href="${safeUrl}" style="display:inline-block;padding:14px 32px;background-color:${bgColor};color:${textColor};font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;mso-line-height-rule:exactly;font-weight:600;text-decoration:none;border-radius:8px;">${safeText}</a><!--<![endif]--></td></tr>`;
}

/**
 * Render a left-bordered hint box. The `html` parameter MUST be pre-escaped
 * by the caller (use esc() on all dynamic values). Only internal builders
 * call this function — it is not part of the public API.
 */
function renderHintBox(html, borderColor, bgColor, tokens) {
  return `<tr><td style="padding:24px 36px 0;" class="email-padding"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;"><tr><td style="background-color:${bgColor};border-left:4px solid ${borderColor};border-radius:0 8px 8px 0;padding:14px 18px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:${tokens.ink_soft};">${html}</td></tr></table></td></tr>`;
}

function renderFooter(branding, tokens) {
  const b = { ...DEFAULTS, ...branding };
  const footerHtml = esc(b.footer_text).replace(/\n/g, '<br/>');

  // Privacy footer (Art. 13/14 DSGVO)
  const rawPrivacyUrl = b.privacy_policy_url || '/datenschutz';
  const privacyUrl = rawPrivacyUrl.startsWith('/') || rawPrivacyUrl.startsWith('https://') || rawPrivacyUrl.startsWith('http://') ? rawPrivacyUrl : '/datenschutz';
  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
  const fullPrivacyUrl = privacyUrl.startsWith('http') ? privacyUrl : `${baseUrl}${privacyUrl}`;

  let privacyParts = [];
  if (b.responsible_name) {
    privacyParts.push(`Verantwortlich: ${esc(b.responsible_name)}`);
  }
  privacyParts.push(`<a href="${esc(fullPrivacyUrl)}" style="color:${tokens.ink_muted};text-decoration:underline;">Datenschutz</a>`);
  if (b.dsb_email) {
    privacyParts.push(`DSB: <a href="mailto:${esc(b.dsb_email)}" style="color:${tokens.ink_muted};text-decoration:underline;">${esc(b.dsb_email)}</a>`);
  }

  return `<!-- Footer -->
    <tr><td style="padding:32px 36px 0;" class="email-padding"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-top:1px solid ${tokens.border};"><tr><td style="padding:20px 0 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;mso-line-height-rule:exactly;color:${tokens.ink_muted};text-align:center;">${footerHtml}</td></tr></table></td></tr>
    <!-- Privacy (DSGVO Art. 13/14) -->
    <tr><td style="padding:12px 36px 32px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;mso-line-height-rule:exactly;color:${tokens.ink_muted};text-align:center;" class="email-padding">${privacyParts.join(' &middot; ')}</td></tr>`;
}

// ── Wrapper ──────────────────────────────────────────────────────────

/**
 * Wrap email body content in a professional, production-ready HTML template.
 * @param {object} opts
 * @param {string} opts.body         - inner HTML content rows (each wrapped in <tr><td>)
 * @param {object} [opts.branding]   - email_branding row
 * @param {string} [opts.preheader]  - hidden preheader text
 * @param {string} [opts.statusBadge] - 'confirmed' | 'cancelled' | null
 * @returns {string} full HTML email
 */
export function wrapEmailHtml({ body, branding, preheader, statusBadge }) {
  const b = { ...DEFAULTS, ...branding };
  const tokens = buildColorTokens(b.primary_color);

  const logoBlock = renderLogoBlock(branding, tokens);
  const badgeBlock = statusBadge ? renderStatusBadge(statusBadge, tokens) : '';
  const footerBlock = renderFooter(branding, tokens);
  const preheaderBlock = renderPreheader(preheader);

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${esc(b.school_name)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; }
    img { border: 0; display: block; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse; border-spacing: 0; }
    body { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .email-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .mobile-headline { font-size: 20px !important; line-height: 28px !important; }
      .mobile-hide { display: none !important; }
      .stack-column, .stack-column td { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${tokens.background};font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${tokens.ink_soft};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${preheaderBlock}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background-color:${tokens.background};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"><tr><td><![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="email-container" style="width:600px;max-width:600px;background-color:${tokens.surface};border-radius:12px;overflow:hidden;">
          ${logoBlock}
          ${badgeBlock}
          ${body}
          ${footerBlock}
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────

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

// ── Body helpers ─────────────────────────────────────────────────────

function bodyHeadline(text, tokens) {
  return `<tr><td style="padding:24px 36px 0;" class="email-padding"><h1 style="margin:0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;line-height:32px;mso-line-height-rule:exactly;color:${tokens.ink};" class="mobile-headline">${esc(text)}</h1></td></tr>`;
}

/** Internal helper — `html` param must be pre-escaped by the caller. */
function bodyParagraph(html, tokens, extraStyle) {
  const style = `padding:12px 36px 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;mso-line-height-rule:exactly;color:${tokens.ink_soft};${extraStyle || ''}`;
  return `<tr><td style="${style}" class="email-padding">${html}</td></tr>`;
}

/** Internal helper — `html` param must be pre-escaped by the caller. */
function bodyMutedText(html, tokens) {
  return `<tr><td style="padding:20px 36px 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;mso-line-height-rule:exactly;color:${tokens.ink_muted};" class="email-padding">${html}</td></tr>`;
}

// ── Individual email builders ────────────────────────────────────────

function buildVerifySlotEmail(data, branding) {
  const { date, time, teacherName, teacherRoom, verifyUrl } = data;
  const b = { ...DEFAULTS, ...branding };
  const tokens = buildColorTokens(b.primary_color);
  const subject = `${b.school_name} Elternsprechtag – E-Mail-Adresse bestätigen (Terminreservierung)`;

  const text = `Guten Tag,

bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminreservierung abzuschließen.

Termin: ${date} ${time}
Lehrkraft: ${safeText(teacherName)}
Raum: ${safeText(teacherRoom)}

Bestätigungslink: ${verifyUrl}

Hinweis: Erst nach erfolgreicher Bestätigung kann die Lehrkraft Ihren Termin verbindlich bestätigen.

Falls Sie diese Buchung nicht vorgenommen haben, können Sie diese E-Mail ignorieren.`;

  const body = [
    bodyHeadline('E-Mail-Adresse bestätigen', tokens),
    bodyParagraph('Guten Tag,<br/>bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminreservierung abzuschließen.', tokens),
    renderBookingDetailsCard([
      { label: 'Termin', value: `${date} ${time}` },
      { label: 'Lehrkraft', value: safeText(teacherName) },
      { label: 'Raum', value: safeText(teacherRoom) },
    ], 'Termindetails', tokens.primary_light, tokens),
    renderCtaButton('E-Mail-Adresse jetzt bestätigen', verifyUrl, tokens.primary, tokens),
    bodyMutedText('<strong>Hinweis:</strong> Erst nach erfolgreicher Bestätigung kann die Lehrkraft Ihren Termin verbindlich bestätigen.', tokens),
    bodyMutedText('Falls Sie diese Buchung nicht vorgenommen haben, können Sie diese E-Mail ignorieren.', tokens),
  ].join('');

  const html = wrapEmailHtml({ body, branding, preheader: 'Bitte bestätigen Sie Ihre E-Mail-Adresse für Ihren Termin.' });
  return { subject, text, html };
}

function buildVerifyRequestEmail(data, branding) {
  const { date, requestedTime, teacherName, teacherRoom, verifyUrl } = data;
  const b = { ...DEFAULTS, ...branding };
  const tokens = buildColorTokens(b.primary_color);
  const subject = `${b.school_name} Elternsprechtag – E-Mail-Adresse bestätigen (Terminanfrage)`;

  const text = `Guten Tag,

bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminanfrage abzuschließen.

Gewünschter Zeitraum: ${date} ${requestedTime}
Lehrkraft: ${safeText(teacherName)}
Raum: ${safeText(teacherRoom)}

Bestätigungslink: ${verifyUrl}

Hinweis: Die Lehrkraft vergibt die Termine. Nach Bestätigung Ihrer E-Mail-Adresse kann die Lehrkraft Ihre Anfrage annehmen.

Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.`;

  const body = [
    bodyHeadline('E-Mail-Adresse bestätigen', tokens),
    bodyParagraph('Guten Tag,<br/>bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihre Terminanfrage abzuschließen.', tokens),
    renderBookingDetailsCard([
      { label: 'Zeitraum', value: `${date} ${requestedTime}` },
      { label: 'Lehrkraft', value: safeText(teacherName) },
      { label: 'Raum', value: safeText(teacherRoom) },
    ], 'Termindetails', tokens.primary_light, tokens),
    renderCtaButton('E-Mail-Adresse jetzt bestätigen', verifyUrl, tokens.primary, tokens),
    bodyMutedText('<strong>Hinweis:</strong> Die Lehrkraft vergibt die Termine. Nach Bestätigung Ihrer E-Mail-Adresse kann die Lehrkraft Ihre Anfrage annehmen.', tokens),
    bodyMutedText('Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.', tokens),
  ].join('');

  const html = wrapEmailHtml({ body, branding, preheader: 'Bitte bestätigen Sie Ihre E-Mail-Adresse für Ihre Terminanfrage.' });
  return { subject, text, html };
}

function buildConfirmationEmail(data, branding) {
  const { date, time, teacherName, teacherRoom, teacherMessage, label } = data;
  const msgLabel = label || 'Ihre Terminanfrage wurde von der Lehrkraft angenommen.';
  const b = { ...DEFAULTS, ...branding };
  const tokens = buildColorTokens(b.primary_color);
  const subject = `${b.school_name} Elternsprechtag – Termin bestätigt am ${date} (${time})`;

  const teacherMsgPlain = teacherMessage ? `\n\nNachricht der Lehrkraft:\n${teacherMessage}` : '';
  const text = `Guten Tag,

${msgLabel}

Termin: ${date} ${time}
Lehrkraft: ${safeText(teacherName)}
Raum: ${safeText(teacherRoom)}
${teacherMsgPlain}`;

  const teacherMsgBlock = teacherMessage
    ? renderHintBox(
        `<strong style="color:${tokens.ink};">Nachricht der Lehrkraft:</strong><br/>${esc(teacherMessage).replace(/\n/g, '<br/>')}`,
        tokens.primary,
        tokens.primary_light,
        tokens,
      )
    : '';

  const body = [
    bodyHeadline('Termin bestätigt', tokens),
    bodyParagraph(`Guten Tag,<br/>${esc(msgLabel)}`, tokens),
    renderBookingDetailsCard([
      { label: 'Termin', value: `${date} ${time}` },
      { label: 'Lehrkraft', value: safeText(teacherName) },
      { label: 'Raum', value: safeText(teacherRoom) },
    ], 'Buchungsdetails', tokens.primary_light, tokens),
    teacherMsgBlock,
    bodyMutedText('Falls Sie diesen Termin stornieren möchten, wenden Sie sich bitte an die Lehrkraft oder nutzen Sie das Buchungssystem.', tokens),
  ].join('');

  const html = wrapEmailHtml({ body, branding, preheader: `Ihr Termin am ${date} wurde bestätigt.`, statusBadge: 'confirmed' });
  return { subject, text, html };
}

/**
 * Merge consecutive time slots into combined ranges.
 * E.g. ["16:00 - 16:10", "16:10 - 16:20"] → "16:00 - 16:20"
 * Non-consecutive slots are kept as separate entries.
 */
function mergeConsecutiveSlots(slots) {
  if (!slots?.length) return [];
  const parsed = slots.map((s) => {
    const m = String(s.time || '').match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
    return m ? { start: m[1], end: m[2] } : null;
  }).filter(Boolean);
  if (!parsed.length) return slots.map((s) => s.time);

  // Sort by start time
  parsed.sort((a, b) => a.start.localeCompare(b.start));

  const merged = [{ ...parsed[0] }];
  for (let i = 1; i < parsed.length; i++) {
    const last = merged[merged.length - 1];
    if (parsed[i].start === last.end) {
      last.end = parsed[i].end;
    } else {
      merged.push({ ...parsed[i] });
    }
  }
  return merged.map((r) => `${r.start} - ${r.end}`);
}

function buildMultiConfirmationEmail(data, branding) {
  const { date, slots, teacherName, teacherRoom, teacherMessage } = data;
  const mergedTimes = mergeConsecutiveSlots(slots);
  const timeDisplay = mergedTimes.join(', ');
  const b = { ...DEFAULTS, ...branding };
  const tokens = buildColorTokens(b.primary_color);
  const subject = `${b.school_name} Elternsprechtag – Termin bestätigt am ${date} (${timeDisplay})`;

  const teacherMsgPlain = teacherMessage ? `\n\nNachricht der Lehrkraft:\n${teacherMessage}` : '';
  const text = `Guten Tag,

Ihre Terminanfrage wurde von der Lehrkraft angenommen.

Termin: ${date} ${timeDisplay}
Lehrkraft: ${safeText(teacherName)}
Raum: ${safeText(teacherRoom)}
${teacherMsgPlain}`;

  const teacherMsgBlock = teacherMessage
    ? renderHintBox(
        `<strong style="color:${tokens.ink};">Nachricht der Lehrkraft:</strong><br/>${esc(teacherMessage).replace(/\n/g, '<br/>')}`,
        tokens.primary,
        tokens.primary_light,
        tokens,
      )
    : '';

  const cardRows = mergedTimes.map((time) => ({
    label: 'Termin',
    value: `${date} ${time}`,
  }));
  cardRows.push({ label: 'Lehrkraft', value: safeText(teacherName) });
  cardRows.push({ label: 'Raum', value: safeText(teacherRoom) });

  const body = [
    bodyHeadline('Termin bestätigt', tokens),
    bodyParagraph('Guten Tag,<br/>Ihre Terminanfrage wurde von der Lehrkraft angenommen.', tokens),
    renderBookingDetailsCard(cardRows, 'Buchungsdetails', tokens.primary_light, tokens),
    teacherMsgBlock,
    bodyMutedText('Falls Sie diesen Termin stornieren möchten, wenden Sie sich bitte an die Lehrkraft oder nutzen Sie das Buchungssystem.', tokens),
  ].join('');

  const html = wrapEmailHtml({ body, branding, preheader: `Ihr Termin am ${date} wurde bestätigt.`, statusBadge: 'confirmed' });
  return { subject, text, html };
}

function buildCancellationEmail(data, branding) {
  const { date, time, teacherName, teacherRoom, cancellationMessage } = data;
  const b = { ...DEFAULTS, ...branding };
  const tokens = buildColorTokens(b.primary_color);
  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
  const subject = `${b.school_name} Elternsprechtag – Termin storniert am ${date} (${time})`;

  const msgLine = cancellationMessage ? `\nBegründung:\n${cancellationMessage}\n` : '';
  const text = `Guten Tag,

wir müssen Ihnen leider mitteilen, dass Ihr Termin storniert wurde.
${msgLine}
Termin: ${date} ${time}
Lehrkraft: ${safeText(teacherName)}
Raum: ${safeText(teacherRoom)}

Wenn Sie einen neuen Termin vereinbaren möchten, können Sie dies jederzeit über das Buchungssystem tun.`;

  const reasonBlock = cancellationMessage
    ? renderHintBox(
        `<strong style="color:${tokens.ink};">Begründung:</strong><br/>${esc(cancellationMessage).replace(/\n/g, '<br/>')}`,
        tokens.cancel,
        tokens.cancel_light,
        tokens,
      )
    : '';

  const body = [
    bodyHeadline('Termin storniert', tokens),
    bodyParagraph('Guten Tag,<br/>wir müssen Ihnen leider mitteilen, dass Ihr Termin storniert wurde.', tokens),
    renderBookingDetailsCard([
      { label: 'Termin', value: `${date} ${time}` },
      { label: 'Lehrkraft', value: safeText(teacherName) },
      { label: 'Raum', value: safeText(teacherRoom) },
    ], 'Stornierte Buchung', tokens.cancel_light, tokens),
    reasonBlock,
    renderCtaButton('Neuen Termin buchen', baseUrl, tokens.ink, tokens),
    bodyMutedText('Falls Sie Fragen zur Stornierung haben, wenden Sie sich bitte an die Lehrkraft.', tokens),
  ].join('');

  const html = wrapEmailHtml({ body, branding, preheader: `Ihr Termin am ${date} wurde storniert.`, statusBadge: 'cancelled' });
  return { subject, text, html };
}
