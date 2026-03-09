import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import api from '../services/api';
import './SuperadminPage.css';

/**
 * Superadmin – Konfiguration für Tenant-Branding und E-Mail-Branding.
 * Nur für User mit Rolle "superadmin" sichtbar.
 */

interface BrandingConfig {
  schoolName: string;
  fontColor: string;
  headingColor: string;
  buttonPrimaryColor: string;
  buttonSecondaryColor: string;
  backgroundImage: string;
  heroTitle: string;
  heroText: string;
  step1: string;
  step2: string;
  step3: string;
}

interface EmailBranding {
  school_name: string;
  logo_url: string;
  primary_color: string;
  footer_text: string;
}

const DEFAULT_CONFIG: BrandingConfig = {
  schoolName: 'BKSB',
  fontColor: '#1f2937',
  headingColor: '#2d5016',
  buttonPrimaryColor: '#2d5016',
  buttonSecondaryColor: '#4a7c29',
  backgroundImage: '',
  heroTitle: 'Herzlich willkommen!',
  heroText: 'Über dieses Portal können Sie Gesprächstermine für den Eltern- und Ausbildersprechtag anfragen.',
  step1: 'Lehrkraft auswählen',
  step2: 'Wunsch-Zeitfenster wählen',
  step3: 'Daten eingeben und Anfrage absenden',
};

const DEFAULT_EMAIL_BRANDING: EmailBranding = {
  school_name: 'BKSB',
  logo_url: '',
  primary_color: '#2d5016',
  footer_text: 'Mit freundlichen Grüßen\n\nIhr BKSB-Team',
};

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="superadmin__field">
      <span className="superadmin__label">{label}</span>
      <div className="superadmin__color-row">
        <input
          type="color"
          className="superadmin__color-swatch"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="superadmin__color-hex"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={9}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function esc(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function SuperadminPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<BrandingConfig>({ ...DEFAULT_CONFIG });

  // Email Branding state
  const [emailBranding, setEmailBranding] = useState<EmailBranding>({ ...DEFAULT_EMAIL_BRANDING });
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [previewEmail, setPreviewEmail] = useState('');
  const [previewSending, setPreviewSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'branding' | 'email'>('email');

  // Access guard: superadmin role
  if (!user || user.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  const loadEmailBranding = useCallback(async () => {
    try {
      const data = await api.superadmin.getEmailBranding();
      if (data) {
        setEmailBranding({
          school_name: data.school_name || DEFAULT_EMAIL_BRANDING.school_name,
          logo_url: data.logo_url || '',
          primary_color: data.primary_color || DEFAULT_EMAIL_BRANDING.primary_color,
          footer_text: data.footer_text ?? DEFAULT_EMAIL_BRANDING.footer_text,
        });
      }
    } catch {
      // keep defaults
    }
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { loadEmailBranding(); }, [loadEmailBranding]);

  const set = <K extends keyof BrandingConfig>(key: K, value: BrandingConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const setEb = <K extends keyof EmailBranding>(key: K, value: EmailBranding[K]) =>
    setEmailBranding((prev) => ({ ...prev, [key]: value }));

  const saveEmailBranding = async () => {
    setEmailSaving(true);
    setEmailMsg('');
    try {
      await api.superadmin.updateEmailBranding(emailBranding);
      setEmailMsg('Gespeichert ✓');
    } catch (e: any) {
      setEmailMsg(`Fehler: ${e?.message || 'Unbekannt'}`);
    } finally {
      setEmailSaving(false);
      setTimeout(() => setEmailMsg(''), 4000);
    }
  };

  const sendPreview = async () => {
    if (!previewEmail.trim()) return;
    setPreviewSending(true);
    setEmailMsg('');
    try {
      await api.superadmin.sendPreviewEmail(previewEmail.trim());
      setEmailMsg('Vorschau-Email gesendet ✓');
    } catch (e: any) {
      setEmailMsg(`Fehler: ${e?.message || 'Senden fehlgeschlagen'}`);
    } finally {
      setPreviewSending(false);
      setTimeout(() => setEmailMsg(''), 4000);
    }
  };

  // Build inline email preview HTML
  const footerHtml = esc(emailBranding.footer_text).replace(/\n/g, '<br/>');
  const logoHtml = emailBranding.logo_url
    ? `<img src="${esc(emailBranding.logo_url)}" alt="" style="max-height:50px;max-width:180px;display:block;margin:0 auto 6px;" />`
    : '';
  const previewHtmlContent = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;background:#f4f4f5;padding:16px;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="background:${esc(emailBranding.primary_color)};padding:14px 18px;text-align:center;color:#fff;">
          ${logoHtml}
          <span style="font-size:15px;font-weight:600;">${esc(emailBranding.school_name)} — Elternsprechtag</span>
        </div>
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
    <div className="superadmin">
      <div className="superadmin__inner">
        {/* ── Header ──────────────────────────────────── */}
        <div className="superadmin__header">
          <span className="superadmin__badge">Superadmin</span>
          <h1 className="superadmin__title">Konfiguration</h1>
        </div>
        <p className="superadmin__subtitle">
          Tenant-Branding und E-Mail-Erscheinungsbild konfigurieren
        </p>

        {/* ── Tab-Leiste ──────────────────────────────── */}
        <div className="superadmin__tabs">
          <button
            type="button"
            className={`superadmin__tab ${activeTab === 'email' ? 'superadmin__tab--active' : ''}`}
            onClick={() => setActiveTab('email')}
          >
            E-Mail-Branding
          </button>
          <button
            type="button"
            className={`superadmin__tab ${activeTab === 'branding' ? 'superadmin__tab--active' : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            Seiten-Branding
          </button>
        </div>

        {/* ═══════════════════════════════════════════════
            TAB: Email-Branding (live, persisted)
            ═══════════════════════════════════════════════ */}
        {activeTab === 'email' && (
          <>
            {/* ── Schulname ───────────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Schulname</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">
                    Wird im Email-Header angezeigt
                  </span>
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

            {/* ── Logo-URL ────────────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Logo</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Logo-URL (wird über dem Schulnamen angezeigt)</span>
                  <input
                    type="text"
                    className="superadmin__input"
                    value={emailBranding.logo_url}
                    onChange={(e) => setEb('logo_url', e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  {emailBranding.logo_url && (
                    <div style={{ marginTop: 8 }}>
                      <img
                        src={emailBranding.logo_url}
                        alt="Logo-Vorschau"
                        style={{ maxHeight: 60, maxWidth: 220, borderRadius: 4, background: '#fff', padding: 4 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Primärfarbe ─────────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Farbe</h2>
              <div className="superadmin__grid">
                <ColorField
                  label="Header-/Button-Farbe"
                  value={emailBranding.primary_color}
                  onChange={(v) => setEb('primary_color', v)}
                />
              </div>
            </section>

            {/* ── Footer-Text ─────────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Footer</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">
                    Text am Ende jeder Email (Zeilenumbrüche werden übernommen)
                  </span>
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

            {/* ── Live Preview ────────────────────────── */}
            <div className="superadmin__preview">
              <div className="superadmin__preview-title">E-Mail-Vorschau</div>
              <div
                className="superadmin__preview-frame superadmin__preview-frame--email"
                dangerouslySetInnerHTML={{ __html: previewHtmlContent }}
              />
            </div>

            {/* ── Test-Email senden ───────────────────── */}
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
                      onClick={sendPreview}
                      disabled={previewSending || !previewEmail.trim()}
                    >
                      {previewSending ? 'Sende…' : 'Senden'}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Status + Save ────────────────────────── */}
            {emailMsg && (
              <div className={`superadmin__hint ${emailMsg.startsWith('Fehler') ? 'superadmin__hint--error' : ''}`}>
                <span>{emailMsg}</span>
              </div>
            )}
            <div className="superadmin__actions">
              <button
                type="button"
                className="superadmin__btn superadmin__btn--secondary"
                onClick={() => { setEmailBranding({ ...DEFAULT_EMAIL_BRANDING }); setEmailMsg(''); }}
              >
                Zurücksetzen
              </button>
              <button
                type="button"
                className="superadmin__btn superadmin__btn--primary"
                onClick={saveEmailBranding}
                disabled={emailSaving}
              >
                {emailSaving ? 'Speichern…' : 'Änderungen speichern'}
              </button>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════
            TAB: Seiten-Branding (Sandbox)
            ═══════════════════════════════════════════════ */}
        {activeTab === 'branding' && (
          <>
            <div className="superadmin__hint">
              <span>
                <strong>Sandbox-Modus</strong> — Änderungen werden nur in der Vorschau angezeigt und nicht persistiert.
              </span>
            </div>

            {/* ── 1. Schulname / Header ───────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">
                Schulname &amp; Header
              </h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Schulname (wird im Header angezeigt)</span>
                  <input
                    type="text"
                    className="superadmin__input"
                    value={config.schoolName}
                    onChange={(e) => set('schoolName', e.target.value)}
                    placeholder="z.B. Berufskolleg Simmerath/Stolberg"
                  />
                </div>
              </div>
            </section>

            {/* ── 2. Farben ───────────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Farbschema</h2>
              <div className="superadmin__grid">
                <ColorField label="Schriftfarbe (Body)" value={config.fontColor} onChange={(v) => set('fontColor', v)} />
                <ColorField label="Überschriften-Farbe" value={config.headingColor} onChange={(v) => set('headingColor', v)} />
                <ColorField label="Button Primär" value={config.buttonPrimaryColor} onChange={(v) => set('buttonPrimaryColor', v)} />
                <ColorField label="Button Sekundär" value={config.buttonSecondaryColor} onChange={(v) => set('buttonSecondaryColor', v)} />
              </div>
            </section>

            {/* ── 3. Hintergrundbild ──────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Hintergrundbild</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Bild-URL (Hero-Hintergrund)</span>
                  <input
                    type="text"
                    className="superadmin__input"
                    value={config.backgroundImage}
                    onChange={(e) => set('backgroundImage', e.target.value)}
                    placeholder="https://example.com/schulgebaeude.jpg"
                  />
                </div>
              </div>
            </section>

            {/* ── 4. Hero-Texte ───────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Hero-Bereich — Texte</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Hero-Überschrift</span>
                  <input type="text" className="superadmin__input" value={config.heroTitle} onChange={(e) => set('heroTitle', e.target.value)} placeholder="Herzlich willkommen!" />
                </div>
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Hero-Beschreibung</span>
                  <textarea className="superadmin__textarea" value={config.heroText} onChange={(e) => set('heroText', e.target.value)} placeholder="Beschreibungstext für den Hero-Bereich" rows={3} />
                </div>
              </div>
            </section>

            {/* ── 5. Drei-Schritte-Bereich ────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Kurzanleitung (3 Schritte)</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field">
                  <span className="superadmin__label">Schritt 1</span>
                  <input type="text" className="superadmin__input" value={config.step1} onChange={(e) => set('step1', e.target.value)} placeholder="Lehrkraft auswählen" />
                </div>
                <div className="superadmin__field">
                  <span className="superadmin__label">Schritt 2</span>
                  <input type="text" className="superadmin__input" value={config.step2} onChange={(e) => set('step2', e.target.value)} placeholder="Wunsch-Zeitfenster wählen" />
                </div>
                <div className="superadmin__field">
                  <span className="superadmin__label">Schritt 3</span>
                  <input type="text" className="superadmin__input" value={config.step3} onChange={(e) => set('step3', e.target.value)} placeholder="Daten eingeben und absenden" />
                </div>
              </div>
            </section>

            {/* ── Live Preview ────────────────────────── */}
            <div className="superadmin__preview">
              <div className="superadmin__preview-title">Vorschau</div>
              <div className="superadmin__preview-frame">
                <div className="superadmin__preview-header" style={{ background: config.buttonPrimaryColor, color: '#fff' }}>
                  {config.schoolName || 'Schulname'} — Buchungssystem
                </div>
                <div className="superadmin__preview-hero" style={{ backgroundImage: config.backgroundImage ? `url(${config.backgroundImage})` : 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)', color: config.fontColor }}>
                  <h2 style={{ color: config.headingColor }}>{config.heroTitle || 'Überschrift'}</h2>
                  <p>{config.heroText || 'Beschreibungstext…'}</p>
                  <div className="superadmin__preview-steps">
                    <div className="superadmin__preview-step"><strong style={{ color: config.headingColor }}>1.</strong>{config.step1 || '—'}</div>
                    <div className="superadmin__preview-step"><strong style={{ color: config.headingColor }}>2.</strong>{config.step2 || '—'}</div>
                    <div className="superadmin__preview-step"><strong style={{ color: config.headingColor }}>3.</strong>{config.step3 || '—'}</div>
                  </div>
                </div>
                <div className="superadmin__preview-buttons">
                  <button type="button" className="superadmin__preview-btn" style={{ background: config.buttonPrimaryColor }}>Primärbutton</button>
                  <button type="button" className="superadmin__preview-btn superadmin__preview-btn--secondary" style={{ borderColor: config.buttonSecondaryColor, color: config.buttonSecondaryColor }}>Sekundärbutton</button>
                </div>
              </div>
            </div>

            <div className="superadmin__actions">
              <button type="button" className="superadmin__btn superadmin__btn--secondary" onClick={() => setConfig({ ...DEFAULT_CONFIG })}>Zurücksetzen</button>
              <button type="button" className="superadmin__btn superadmin__btn--primary" onClick={() => alert('Sandbox-Modus: Speichern ist noch nicht verdrahtet.')}>Änderungen speichern</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
