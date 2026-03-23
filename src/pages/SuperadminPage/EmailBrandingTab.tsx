import type { EmailBranding } from '../../types';
import api from '../../services/api';
import { ColorField } from './ColorField';

function esc(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Must match backend/emails/template.js lightenHex — same formula, same rounding.
function lightenHex(hex: string, amount: number): string {
  const clean = hex.replace(/^#/, '');
  const full = /^[0-9a-fA-F]{3}$/.test(clean)
    ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
    : /^[0-9a-fA-F]{6}$/.test(clean) ? clean : '2d5016';
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount]
    .map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

interface Props {
  emailBranding: EmailBranding;
  setEb: <K extends keyof EmailBranding>(key: K, value: EmailBranding[K]) => void;
  emailMsg: string;
  emailSaving: boolean;
  previewEmail: string;
  setPreviewEmail: (v: string) => void;
  previewSending: boolean;
  onSave: () => void;
  onReset: () => void;
  onSendPreview: () => void;
}

export function EmailBrandingTab({ emailBranding, setEb, emailMsg, emailSaving, previewEmail, setPreviewEmail, previewSending, onSave, onReset, onSendPreview }: Props) {
  const footerHtml = esc(emailBranding.footer_text).replace(/\n/g, '<br/>');
  const logoPreviewSrc = api.superadmin.resolveLogoUrl(emailBranding.logo_url);
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(emailBranding.primary_color) ? emailBranding.primary_color : '#2d5016';
  const primaryLight = lightenHex(safeColor, 0.88);

  // Email preview token colors — hardcoded hex is intentional here:
  // The sandboxed iframe (sandbox="") cannot access CSS variables.
  // These mirror the fixed system tokens in backend/emails/template.js.
  const ink = '#1a1a1a';
  const inkSoft = '#374151';
  const inkMuted = '#9ca3af';
  const border = '#e5e5e0';
  const bg = '#f7f6f3';
  const confirm = '#16a34a';
  const confirmLight = '#f0fdf4';

  const logoHtml = logoPreviewSrc
    ? `<img src="${esc(logoPreviewSrc)}" alt="" style="display:block;height:48px;width:auto;max-width:220px;" />`
    : `<span style="font-family:'DM Sans',Arial,sans-serif;font-size:18px;font-weight:700;line-height:24px;color:${ink};">${esc(emailBranding.school_name)}</span>`;

  const previewHtmlContent = `
    <div style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:24px;color:${inkSoft};background:${bg};padding:16px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        <!-- Logo -->
        <div style="padding:24px 28px 0;text-align:center;">${logoHtml}</div>
        <!-- Status Badge -->
        <div style="padding:16px 28px 0;text-align:center;">
          <span style="display:inline-block;background-color:${confirmLight};border-radius:100px;padding:6px 16px 6px 12px;font-size:13px;font-weight:700;color:${confirm};line-height:20px;">
            <span style="display:inline-block;width:8px;height:8px;background-color:${confirm};border-radius:50%;vertical-align:middle;margin-right:8px;"></span>Bestaetigt
          </span>
        </div>
        <!-- Headline -->
        <div style="padding:20px 28px 0;">
          <h1 style="margin:0;font-size:22px;font-weight:700;line-height:30px;color:${ink};">Termin bestaetigt</h1>
        </div>
        <!-- Body -->
        <div style="padding:10px 28px 0;">
          <p style="margin:0;color:${inkSoft};">Guten Tag,<br/>Ihre Terminanfrage wurde durch die Lehrkraft angenommen.</p>
        </div>
        <!-- Booking Card -->
        <div style="padding:20px 28px 0;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid ${border};border-radius:12px;overflow:hidden;">
            <tr><td colspan="2" style="background-color:${primaryLight};padding:8px 14px;font-size:11px;font-weight:700;color:${inkSoft};text-transform:uppercase;letter-spacing:0.5px;">Buchungsdetails</td></tr>
            <tr><td style="padding:8px 14px;font-size:12px;color:${inkMuted};border-bottom:1px solid ${border};white-space:nowrap;" width="90">Termin</td><td style="padding:8px 14px;font-size:14px;color:${ink};border-bottom:1px solid ${border};">15.05.2026 14:00 - 14:15</td></tr>
            <tr><td style="padding:8px 14px;font-size:12px;color:${inkMuted};border-bottom:1px solid ${border};">Lehrkraft</td><td style="padding:8px 14px;font-size:14px;color:${ink};border-bottom:1px solid ${border};">Max Mustermann</td></tr>
            <tr><td style="padding:8px 14px;font-size:12px;color:${inkMuted};">Raum</td><td style="padding:8px 14px;font-size:14px;color:${ink};">A 204</td></tr>
          </table>
        </div>
        <!-- Muted Hint -->
        <div style="padding:16px 28px 0;">
          <p style="margin:0;font-size:13px;line-height:20px;color:${inkMuted};">Falls Sie diesen Termin stornieren moechten, wenden Sie sich bitte an die Lehrkraft.</p>
        </div>
        <!-- Footer -->
        <div style="padding:24px 28px 0;">
          <div style="border-top:1px solid ${border};padding-top:16px;font-size:13px;line-height:20px;color:${inkMuted};text-align:center;">
            ${footerHtml}
          </div>
        </div>
        <div style="padding:8px 28px 24px;font-size:11px;color:${inkMuted};text-align:center;">
          <a href="#" style="color:${inkMuted};text-decoration:underline;">Datenschutz</a>
        </div>
      </div>
    </div>`;

  return (
    <>
      {/* Schulname */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Schulname</h2>
        <div className="superadmin__grid">
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Wird im Email-Header angezeigt</span>
            <input
              type="text"
              className="superadmin__input"
              value={emailBranding.school_name}
              onChange={(e) => setEb('school_name', e.target.value)}
              placeholder="z.B. Berufskolleg Simmerath/Stolberg"
            />
          </div>
        </div>
      </section>

      {/* Logo-Upload */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Logo</h2>
        <div className="superadmin__grid">
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Logo hochladen (max. 2 MB, PNG/JPG/WebP/GIF)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="superadmin__input"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const result = await api.superadmin.uploadLogo(file);
                  setEb('logo_url', result.logo_url);
                } catch (err: unknown) {
                  // handled by parent
                }
              }}
            />
            {emailBranding.logo_url && (
              <div style={{ marginTop: 8 }}>
                <img
                  src={api.superadmin.resolveLogoUrl(emailBranding.logo_url)}
                  alt="Logo-Vorschau"
                  style={{ maxHeight: 60, maxWidth: 220, borderRadius: 4, background: 'var(--color-white)', padding: 4 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <button
                  type="button"
                  className="superadmin__btn superadmin__btn--secondary"
                  style={{ marginTop: 6, fontSize: '0.85rem' }}
                  onClick={() => setEb('logo_url', '')}
                >Logo entfernen</button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Primaerfarbe */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Farbe</h2>
        <div className="superadmin__grid">
          <ColorField label="Markenfarbe (Header, Buttons, Akzente)" value={emailBranding.primary_color} onChange={(v) => setEb('primary_color', v)} />
        </div>
      </section>

      {/* Footer-Text */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Footer</h2>
        <div className="superadmin__grid">
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Text am Ende jeder Email (Zeilenumbrueche werden uebernommen)</span>
            <textarea
              className="superadmin__textarea"
              value={emailBranding.footer_text}
              onChange={(e) => setEb('footer_text', e.target.value)}
              rows={4}
              placeholder="Mit freundlichen Gruessen&#10;&#10;Ihr Schulteam"
            />
          </div>
        </div>
      </section>

      {/* Live Preview */}
      <div className="superadmin__preview">
        <div className="superadmin__preview-title">E-Mail-Vorschau</div>
        <iframe
          className="superadmin__preview-frame superadmin__preview-frame--email"
          sandbox=""
          srcDoc={previewHtmlContent}
          title="E-Mail-Vorschau"
          style={{ border: 'none', width: '100%', minHeight: 480 }}
        />
      </div>

      {/* Test-Email senden */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Test-Email senden</h2>
        <div className="superadmin__grid">
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Empfaenger-Adresse</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                className="superadmin__input"
                value={previewEmail}
                onChange={(e) => setPreviewEmail(e.target.value)}
                placeholder="test@example.de"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="superadmin__btn superadmin__btn--secondary"
                onClick={onSendPreview}
                disabled={previewSending || !previewEmail.trim()}
              >
                {previewSending ? 'Sende\u2026' : 'Senden'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Status + Save */}
      {emailMsg && (
        <div className={`superadmin__hint ${emailMsg.startsWith('Fehler') ? 'superadmin__hint--error' : ''}`}>
          <span>{emailMsg}</span>
        </div>
      )}
      <div className="superadmin__actions">
        <button type="button" className="superadmin__btn superadmin__btn--secondary" onClick={onReset}>
          Zuruecksetzen
        </button>
        <button type="button" className="superadmin__btn superadmin__btn--primary" onClick={onSave} disabled={emailSaving}>
          {emailSaving ? 'Speichern\u2026' : 'Aenderungen speichern'}
        </button>
      </div>
    </>
  );
}
