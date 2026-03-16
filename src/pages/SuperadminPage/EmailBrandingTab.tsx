import type { EmailBranding } from '../../types';
import api from '../../services/api';
import { ColorField } from './ColorField';

function esc(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface Props {
  emailBranding: EmailBranding;
  setEb: <K extends keyof EmailBranding>(key: K, value: EmailBranding[K]) => void;
  emailMsg: string;
  setEmailMsg: (msg: string) => void;
  emailSaving: boolean;
  previewEmail: string;
  setPreviewEmail: (v: string) => void;
  previewSending: boolean;
  onSave: () => void;
  onReset: () => void;
  onSendPreview: () => void;
}

export function EmailBrandingTab({ emailBranding, setEb, emailMsg, emailSaving, previewEmail, setPreviewEmail, previewSending, onSave, onReset, onSendPreview }: Props) {
  // Build inline email preview HTML
  const footerHtml = esc(emailBranding.footer_text).replace(/\n/g, '<br/>');
  const logoPreviewSrc = api.superadmin.resolveLogoUrl(emailBranding.logo_url);
  const logoHtml = logoPreviewSrc
    ? `<div style="background:#fff;border-radius:6px;padding:6px;display:inline-block;margin:0 auto 6px;"><img src="${esc(logoPreviewSrc)}" alt="" style="max-height:50px;max-width:180px;display:block;" /></div>`
    : '';
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(emailBranding.primary_color) ? emailBranding.primary_color : '#2d5016';
  const previewHtmlContent = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;background:#f4f4f5;padding:16px;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="background:${safeColor};padding:14px 18px;text-align:center;color:#fff;">
          <span style="font-size:15px;font-weight:600;">${esc(emailBranding.school_name)}</span>
        </div>
        ${logoHtml ? `<div style="padding:12px 18px 0;text-align:center;">${logoHtml}</div>` : ''}
        <div style="padding:20px 18px 16px;">
          <p>Guten Tag,</p>
          <p>Ihre Terminanfrage wurde bestätigt.</p>
          <p><strong>Termin:</strong> 15.05.2026 14:00 - 14:15<br/>
          <strong>Lehrkraft:</strong> Max Mustermann<br/>
          <strong>Raum:</strong> A 204</p>
        </div>
        <div style="padding:12px 18px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;">
          ${footerHtml}
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
            <span className="superadmin__label">Logo hochladen (max. 2 MB, PNG/JPG/SVG/WebP)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
              className="superadmin__input"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const result = await api.superadmin.uploadLogo(file);
                  setEb('logo_url', result.logo_url);
                } catch (err: any) {
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

      {/* Primärfarbe */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Farbe</h2>
        <div className="superadmin__grid">
          <ColorField label="Header-/Button-Farbe" value={emailBranding.primary_color} onChange={(v) => setEb('primary_color', v)} />
        </div>
      </section>

      {/* Footer-Text */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Footer</h2>
        <div className="superadmin__grid">
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Text am Ende jeder Email (Zeilenumbrüche werden übernommen)</span>
            <textarea
              className="superadmin__textarea"
              value={emailBranding.footer_text}
              onChange={(e) => setEb('footer_text', e.target.value)}
              rows={4}
              placeholder="Mit freundlichen Grüßen&#10;&#10;Ihr Schulteam"
            />
          </div>
        </div>
      </section>

      {/* Live Preview */}
      <div className="superadmin__preview">
        <div className="superadmin__preview-title">E-Mail-Vorschau</div>
        <div
          className="superadmin__preview-frame superadmin__preview-frame--email"
          dangerouslySetInnerHTML={{ __html: previewHtmlContent }}
        />
      </div>

      {/* Test-Email senden */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Test-Email senden</h2>
        <div className="superadmin__grid">
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Empfänger-Adresse</span>
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
          Zurücksetzen
        </button>
        <button type="button" className="superadmin__btn superadmin__btn--primary" onClick={onSave} disabled={emailSaving}>
          {emailSaving ? 'Speichern\u2026' : 'Änderungen speichern'}
        </button>
      </div>
    </>
  );
}
