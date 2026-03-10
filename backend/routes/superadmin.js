import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { requireSuperadmin } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { isEmailConfigured, sendMail } from '../config/email.js';
import { buildEmail, getEmailBranding } from '../emails/template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer config for logo uploads
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'logos')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo-${Date.now()}${ext}`);
  },
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Nur Bilddateien (PNG, JPG, SVG, WebP, GIF) erlaubt'));
  },
});

const router = express.Router();

// GET /api/superadmin/email-branding
router.get('/email-branding', requireSuperadmin, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM email_branding WHERE id = 1 LIMIT 1');
    const data = rows[0] || { school_name: 'BKSB', logo_url: '', primary_color: '#2d5016', footer_text: 'Mit freundlichen Grüßen\n\nIhr BKSB-Team' };
    return res.json(data);
  } catch (error) {
    console.error('Error fetching email branding:', error);
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
    const now = new Date().toISOString();
    const { rows } = await query(
      `INSERT INTO email_branding (id, school_name, logo_url, primary_color, footer_text, updated_at)
       VALUES (1, $1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET school_name = $1, logo_url = $2, primary_color = $3, footer_text = $4, updated_at = $5
       RETURNING *`,
      [
        String(school_name).trim().slice(0, 255),
        String(logo_url || '').trim(),
        String(primary_color || '#2d5016').trim().slice(0, 9),
        String(footer_text || '').trim(),
        now,
      ]
    );
    return res.json({ success: true, branding: rows[0] });
  } catch (error) {
    console.error('Error updating email branding:', error);
    return res.status(500).json({ error: 'Failed to update email branding' });
  }
});

// POST /api/superadmin/logo
router.post('/logo', requireSuperadmin, (req, res) => {
  logoUpload.single('logo')(req, res, async (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'Datei zu groß (max. 2 MB)'
        : err.message || 'Upload fehlgeschlagen';
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    const logoFilename = req.file.filename;
    const logoUrl = `/uploads/logos/${logoFilename}`;
    try {
      await query(
        `UPDATE email_branding SET logo_url = $1, updated_at = NOW() WHERE id = 1`,
        [logoFilename]
      );
    } catch (e) {
      console.error('Error saving logo URL:', e);
    }
    return res.json({ success: true, logo_url: logoUrl });
  });
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
    console.error('Error sending preview email:', error);
    return res.status(500).json({ error: error?.message || 'Fehler beim Senden' });
  }
});

export default router;
