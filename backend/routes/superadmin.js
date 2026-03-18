import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireSuperadmin } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { isEmailConfigured, sendMail } from '../config/email.js';
import { buildEmail, getEmailBranding } from '../emails/template.js';
import logger from '../config/logger.js';

/** Allow only local /uploads/* paths or empty string. Blocks javascript:, data:, external URLs. */
function sanitizeUploadUrl(value) {
  if (!value) return '';
  if (/^\/uploads\/[a-zA-Z0-9_\-/.]+$/.test(value)) return value;
  return '';
}

/** Sanitize an image-map object: only keep entries whose values are valid /uploads/ paths. */
function sanitizeImageMap(obj) {
  if (typeof obj !== 'object' || obj === null) return {};
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const clean = sanitizeUploadUrl(String(val || ''));
    if (clean) result[key] = clean;
  }
  return result;
}

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Shared upload helpers ─────────────────────────────────────────────

// SVG intentionally excluded — can contain embedded <script> (stored XSS)
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function createImageUpload(subdir, prefix, { maxSize = 2 * 1024 * 1024, exts = IMAGE_EXTS, mimes = IMAGE_MIMES } = {}) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(__dirname, '..', 'uploads', subdir);
      try { fs.mkdirSync(dir, { recursive: true }); } catch (err) { return cb(err); }
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${prefix}-${Date.now()}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (exts.includes(ext) && mimes.includes(file.mimetype)) return cb(null, true);
      cb(new Error(`Nur Bilddateien (${exts.map(e => e.slice(1).toUpperCase()).join(', ')}) erlaubt`));
    },
  });
}

function handleUpload(upload, fieldName, urlPrefix) {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        const msg = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? `Datei zu gross (max. ${Math.round(upload.limits?.fileSize / 1024 / 1024 || 2)} MB)`
          : err.message || 'Upload fehlgeschlagen';
        return res.status(400).json({ error: msg });
      }
      if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });
      req.uploadUrl = `${urlPrefix}${req.file.filename}`;
      next();
    });
  };
}

const logoUpload = createImageUpload('logos', 'logo');
const tileUpload = createImageUpload('tiles', 'tile');
const bgUpload = createImageUpload('bg', 'bg', {
  maxSize: 5 * 1024 * 1024,
  exts: ['.png', '.jpg', '.jpeg', '.webp'],
  mimes: ['image/png', 'image/jpeg', 'image/webp'],
});

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════
// Email Branding
// ═══════════════════════════════════════════════════════════════════════

// GET /api/superadmin/email-branding
router.get('/email-branding', requireSuperadmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM email_branding WHERE id = 1 LIMIT 1');
    const data = rows[0] || { school_name: 'BKSB', logo_url: '', primary_color: '#2d5016', footer_text: 'Mit freundlichen Grüßen\n\nIhr BKSB-Team' };
    return res.json(data);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching email branding');
    return res.status(500).json({ error: 'Failed to fetch email branding' });
  }
});

// PUT /api/superadmin/email-branding
router.put('/email-branding', requireSuperadmin, async (req, res) => {
  const { school_name, logo_url, primary_color, footer_text } = req.body || {};
  if (!school_name || typeof school_name !== 'string') {
    return res.status(400).json({ error: 'school_name is required' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO email_branding (id, school_name, logo_url, primary_color, footer_text, updated_at)
       VALUES (1, $1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET school_name = $1, logo_url = $2, primary_color = $3, footer_text = $4, updated_at = NOW()
       RETURNING *`,
      [
        String(school_name).trim().slice(0, 255),
        sanitizeUploadUrl(String(logo_url || '').trim()),
        String(primary_color || '#2d5016').trim().slice(0, 9),
        String(footer_text || '').trim(),
      ]
    );
    return res.json({ success: true, branding: rows[0] });
  } catch (error) {
    logger.error({ err: error }, 'Error updating email branding');
    return res.status(500).json({ error: 'Failed to update email branding' });
  }
});

// POST /api/superadmin/logo
router.post('/logo', requireSuperadmin, handleUpload(logoUpload, 'logo', '/uploads/logos/'), async (req, res) => {
  try {
    await query(
      `UPDATE email_branding SET logo_url = $1, updated_at = NOW() WHERE id = 1`,
      [req.file.filename]
    );
  } catch (e) {
    logger.error({ err: e }, 'Error saving logo URL');
  }
  return res.json({ success: true, logo_url: req.uploadUrl });
});

// POST /api/superadmin/email-branding/preview
router.post('/email-branding/preview', requireSuperadmin, async (req, res) => {
  if (!isEmailConfigured()) {
    return res.status(503).json({ error: 'Email ist nicht konfiguriert' });
  }
  const { to } = req.body || {};
  if (!to || typeof to !== 'string') {
    return res.status(400).json({ error: 'Empfänger-Adresse (to) fehlt' });
  }
  try {
    const branding = await getEmailBranding();
    const { subject, text, html } = buildEmail('confirmation', {
      date: new Date().toISOString().split('T')[0],
      time: '14:00 - 14:15',
      teacherName: 'Max Mustermann',
      teacherRoom: 'A 204',
      label: 'Dies ist eine Vorschau-Email mit Ihrem aktuellen Branding.',
    }, branding);
    const result = await sendMail({ to: to.trim(), subject: `[VORSCHAU] ${subject}`, text, html });
    return res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    logger.error({ err: error }, 'Error sending preview email');
    return res.status(500).json({ error: error?.message || 'Fehler beim Senden' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Site Branding (appearance, colors, texts)
// ═══════════════════════════════════════════════════════════════════════

const SITE_BRANDING_DEFAULTS = {
  school_name: 'BKSB',
  logo_url: '',
  primary_color: '#123C73',
  primary_dark: '#0B2545',
  primary_darker: '#081D38',
  secondary_color: '#5B8DEF',
  ink_color: '#0B2545',
  surface_1: '#F8FAFC',
  surface_2: '#D9E4F2',
  header_font_color: '',
  hero_title: 'Herzlich willkommen!',
  hero_text: 'Über dieses Portal können Sie Gesprächstermine für den Eltern- und Ausbildersprechtag anfragen.',
  step_1: 'Lehrkraft auswählen',
  step_2: 'Wunsch-Zeitfenster wählen',
  step_3: 'Daten eingeben und Anfrage absenden',
  tile_images: {},
  background_images: {},
  dsb_name: '',
  dsb_email: '',
  responsible_name: '',
  responsible_address: '',
  responsible_email: '',
  responsible_phone: '',
  supervisory_authority: '',
  privacy_policy_url: '/datenschutz',
};

// GET /api/superadmin/site-branding  (public — no auth, everyone needs the theme)
router.get('/site-branding', publicLimiter, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM site_branding WHERE id = 1 LIMIT 1');
    const data = rows[0] || { ...SITE_BRANDING_DEFAULTS };
    return res.json(data);
  } catch (error) {
    // Table might not exist yet — return defaults
    return res.json({ ...SITE_BRANDING_DEFAULTS });
  }
});

// PUT /api/superadmin/site-branding  (superadmin only)
router.put('/site-branding', requireSuperadmin, async (req, res) => {
  const b = req.body || {};

  const hexOrEmpty = (v, fallback) => {
    const s = String(v || fallback).trim().slice(0, 9);
    return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : fallback;
  };

  const values = {
    school_name:       String(b.school_name || SITE_BRANDING_DEFAULTS.school_name).trim().slice(0, 255),
    logo_url:          sanitizeUploadUrl(String(b.logo_url || '').trim()),
    primary_color:     hexOrEmpty(b.primary_color, SITE_BRANDING_DEFAULTS.primary_color),
    primary_dark:      hexOrEmpty(b.primary_dark, SITE_BRANDING_DEFAULTS.primary_dark),
    primary_darker:    hexOrEmpty(b.primary_darker, SITE_BRANDING_DEFAULTS.primary_darker),
    secondary_color:   hexOrEmpty(b.secondary_color, SITE_BRANDING_DEFAULTS.secondary_color),
    ink_color:         hexOrEmpty(b.ink_color, SITE_BRANDING_DEFAULTS.ink_color),
    surface_1:         hexOrEmpty(b.surface_1, SITE_BRANDING_DEFAULTS.surface_1),
    surface_2:         hexOrEmpty(b.surface_2, SITE_BRANDING_DEFAULTS.surface_2),
    header_font_color: b.header_font_color ? hexOrEmpty(b.header_font_color, '') : '',
    hero_title:        String(b.hero_title ?? SITE_BRANDING_DEFAULTS.hero_title).trim().slice(0, 255),
    hero_text:         String(b.hero_text ?? SITE_BRANDING_DEFAULTS.hero_text).trim(),
    step_1:            String(b.step_1 ?? SITE_BRANDING_DEFAULTS.step_1).trim().slice(0, 255),
    step_2:            String(b.step_2 ?? SITE_BRANDING_DEFAULTS.step_2).trim().slice(0, 255),
    step_3:            String(b.step_3 ?? SITE_BRANDING_DEFAULTS.step_3).trim().slice(0, 255),
    tile_images:       sanitizeImageMap(b.tile_images),
    background_images: sanitizeImageMap(b.background_images),
    dsb_name:              String(b.dsb_name ?? '').trim().slice(0, 255),
    dsb_email:             String(b.dsb_email ?? '').trim().slice(0, 255),
    responsible_name:      String(b.responsible_name ?? '').trim().slice(0, 255),
    responsible_address:   String(b.responsible_address ?? '').trim().slice(0, 500),
    responsible_email:     String(b.responsible_email ?? '').trim().slice(0, 255),
    responsible_phone:     String(b.responsible_phone ?? '').trim().slice(0, 50),
    supervisory_authority: String(b.supervisory_authority ?? '').trim().slice(0, 500),
    privacy_policy_url:    (() => { const u = String(b.privacy_policy_url ?? '/datenschutz').trim().slice(0, 500); return u.startsWith('/') || u.startsWith('https://') || u.startsWith('http://') ? u : '/datenschutz'; })(),
  };

  try {
    const { rows } = await query(
      `INSERT INTO site_branding (
        id, school_name, logo_url,
        primary_color, primary_dark, primary_darker, secondary_color, ink_color, surface_1, surface_2,
        header_font_color,
        hero_title, hero_text, step_1, step_2, step_3,
        tile_images, background_images,
        dsb_name, dsb_email, responsible_name, responsible_address,
        responsible_email, responsible_phone, supervisory_authority, privacy_policy_url,
        updated_at
      ) VALUES (
        1, $1, $2,
        $3, $4, $5, $6, $7, $8, $9,
        $10,
        $11, $12, $13, $14, $15,
        $16, $17,
        $18, $19, $20, $21,
        $22, $23, $24, $25,
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        school_name = $1, logo_url = $2,
        primary_color = $3, primary_dark = $4, primary_darker = $5, secondary_color = $6, ink_color = $7, surface_1 = $8, surface_2 = $9,
        header_font_color = $10,
        hero_title = $11, hero_text = $12, step_1 = $13, step_2 = $14, step_3 = $15,
        tile_images = $16, background_images = $17,
        dsb_name = $18, dsb_email = $19, responsible_name = $20, responsible_address = $21,
        responsible_email = $22, responsible_phone = $23, supervisory_authority = $24, privacy_policy_url = $25,
        updated_at = NOW()
      RETURNING *`,
      [
        values.school_name, values.logo_url,
        values.primary_color, values.primary_dark, values.primary_darker, values.secondary_color, values.ink_color, values.surface_1, values.surface_2,
        values.header_font_color,
        values.hero_title, values.hero_text, values.step_1, values.step_2, values.step_3,
        JSON.stringify(values.tile_images), JSON.stringify(values.background_images),
        values.dsb_name, values.dsb_email, values.responsible_name, values.responsible_address,
        values.responsible_email, values.responsible_phone, values.supervisory_authority, values.privacy_policy_url,
      ]
    );
    // ── Sync school_name + primary_color to email_branding ──
    try {
      await query(
        `UPDATE email_branding SET school_name = $1, primary_color = $2, updated_at = NOW() WHERE id = 1`,
        [values.school_name, values.primary_color]
      );
    } catch { /* email_branding table might not exist yet — ignore */ }

    return res.json({ success: true, branding: rows[0] });
  } catch (error) {
    logger.error({ err: error }, 'Error updating site branding');
    return res.status(500).json({ error: 'Failed to update site branding' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Image Uploads (tile + background)
// ═══════════════════════════════════════════════════════════════════════

router.post('/tile-image', requireSuperadmin, handleUpload(tileUpload, 'tile', '/uploads/tiles/'), (_req, res) => {
  return res.json({ success: true, tile_url: _req.uploadUrl });
});

router.post('/bg-image', requireSuperadmin, handleUpload(bgUpload, 'bg', '/uploads/bg/'), (_req, res) => {
  return res.json({ success: true, bg_url: _req.uploadUrl });
});

// ═══════════════════════════════════════════════════════════════════════
// Text Branding (Elternsprechtag booking UI texts)
// ═══════════════════════════════════════════════════════════════════════

const TEXT_BRANDING_DEFAULTS = {
  booking_title: 'Herzlich willkommen!',
  booking_text: 'Über dieses Portal können Sie Gesprächstermine für den Eltern- und Ausbildersprechtag anfragen.\n\nWählen Sie die gewünschte Lehrkraft und Ihren bevorzugten Zeitraum aus. Die Lehrkraft wird versuchen, Ihnen einen Termin im gewünschten Zeitfenster zuzuweisen.\n\nSobald Ihr Termin bestätigt wurde, erhalten Sie eine E-Mail mit allen Details.',
  booking_steps_title: 'In drei Schritten zum Termin:',
  booking_step_1: 'Lehrkraft auswählen',
  booking_step_2: 'Wunsch-Zeitfenster wählen',
  booking_step_3: 'Daten eingeben und Anfrage absenden',
  booking_hint: 'Die Lehrkraft vergibt nach Möglichkeit einen Termin in Ihrem Wunschzeitraum – Sie werden per E-Mail benachrichtigt.',
  event_banner_template: 'Der nächste Eltern- und Ausbildersprechtag findet am {weekday}, den {date} von {startTime} bis {endTime} Uhr statt.',
  event_banner_fallback: 'Der nächste Eltern- und Ausbildersprechtag: Termine folgen.',
  modal_title: 'Fast fertig!',
  modal_text: 'Vielen Dank für Ihre Terminanfrage!\n\nBitte bestätigen Sie zunächst Ihre E-Mail-Adresse über den zugesandten Link (ggf. im Spam-Ordner prüfen). Anschließend wird die Lehrkraft Ihnen einen Termin im gewünschten Zeitfenster zuweisen. Sie erhalten eine Bestätigungs-E-Mail mit Datum, Uhrzeit und Raum.',
  modal_button: 'Verstanden',
  booking_closed_text: 'Buchungen sind aktuell noch nicht freigeschaltet.',

};

const TEXT_BRANDING_FIELDS = Object.keys(TEXT_BRANDING_DEFAULTS);

// GET /api/superadmin/text-branding  (public — booking UI needs these texts)
router.get('/text-branding', publicLimiter, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM text_branding WHERE id = 1 LIMIT 1');
    return res.json(rows[0] || { ...TEXT_BRANDING_DEFAULTS });
  } catch {
    return res.json({ ...TEXT_BRANDING_DEFAULTS });
  }
});

// PUT /api/superadmin/text-branding  (superadmin only)
router.put('/text-branding', requireSuperadmin, async (req, res) => {
  const b = req.body || {};

  const values = {};
  for (const key of TEXT_BRANDING_FIELDS) {
    values[key] = String(b[key] ?? TEXT_BRANDING_DEFAULTS[key]).trim();
    // Limit VARCHAR fields to 255 chars
    if (key !== 'booking_text' && key !== 'booking_hint' && key !== 'event_banner_template' && key !== 'event_banner_fallback' && key !== 'modal_text' && key !== 'booking_closed_text') {
      values[key] = values[key].slice(0, 255);
    }
  }

  try {
    const cols = TEXT_BRANDING_FIELDS;
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const params = cols.map((c) => values[c]);

    const { rows } = await query(
      `INSERT INTO text_branding (id, ${cols.join(', ')}, updated_at)
       VALUES (1, ${placeholders.join(', ')}, NOW())
       ON CONFLICT (id) DO UPDATE SET ${setClause}, updated_at = NOW()
       RETURNING *`,
      params
    );
    return res.json({ success: true, textBranding: rows[0] });
  } catch (error) {
    logger.error({ err: error }, 'Error updating text branding');
    return res.status(500).json({ error: 'Failed to update text branding' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Module Configuration (enable / disable modules at runtime)
// ═══════════════════════════════════════════════════════════════════════

// GET /api/superadmin/modules/enabled  (public — frontend needs enabled module list)
router.get('/modules/enabled', publicLimiter, async (_req, res) => {
  try {
    const { rows } = await query(
      'SELECT module_id, enabled FROM module_config WHERE enabled = TRUE ORDER BY module_id'
    );
    return res.json(rows);
  } catch {
    // Table might not exist yet — treat all as enabled
    return res.json([]);
  }
});

// GET /api/superadmin/modules  (superadmin only — sees all including disabled)
router.get('/modules', requireSuperadmin, async (_req, res) => {
  try {
    const { rows } = await query(
      'SELECT module_id, enabled FROM module_config ORDER BY module_id'
    );
    return res.json(rows);
  } catch {
    return res.json([]);
  }
});

// PUT /api/superadmin/modules/:moduleId  (superadmin only)
router.put('/modules/:moduleId', requireSuperadmin, async (req, res) => {
  const { moduleId } = req.params;
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) is required' });
  }
  // Validate moduleId format (alphanumeric + hyphens/underscores, max 64 chars)
  if (!/^[a-z0-9_-]{1,64}$/.test(moduleId)) {
    return res.status(400).json({ error: 'Ungültige Modul-ID' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO module_config (module_id, enabled, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (module_id) DO UPDATE SET enabled = $2, updated_at = NOW()
       RETURNING *`,
      [moduleId, enabled]
    );
    return res.json({ success: true, module: rows[0] });
  } catch (error) {
    logger.error({ err: error }, 'Error updating module config');
    return res.status(500).json({ error: 'Failed to update module config' });
  }
});

export default router;
