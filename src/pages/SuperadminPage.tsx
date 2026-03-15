import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useBranding, type SiteBranding } from '../contexts/BrandingContext';
import { useTextBranding, type TextBranding } from '../contexts/TextBrandingContext';
import { modules } from '../modules/registry';
import api from '../services/api';
import './SuperadminPage.css';

/**
 * Superadmin – Konfiguration für Tenant-Branding und E-Mail-Branding.
 * Nur für User mit Rolle "superadmin" sichtbar.
 */

interface EmailBranding {
  school_name: string;
  logo_url: string;
  primary_color: string;
  footer_text: string;
}

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
  const { branding: liveBranding, reload: reloadBranding } = useBranding();
  const { textBranding: liveTextBranding, reload: reloadTextBranding } = useTextBranding();

  // ── Site Branding state ──────────────────────────────
  const [site, setSite] = useState<SiteBranding>({ ...liveBranding });
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteMsg, setSiteMsg] = useState('');

  // ── Email Branding state ─────────────────────────────
  const [emailBranding, setEmailBranding] = useState<EmailBranding>({ ...DEFAULT_EMAIL_BRANDING });
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [previewEmail, setPreviewEmail] = useState('');
  const [previewSending, setPreviewSending] = useState(false);

  // ── Text Branding state ──────────────────────────────
  const [text, setText] = useState<TextBranding>({ ...liveTextBranding });
  const [textSaving, setTextSaving] = useState(false);
  const [textMsg, setTextMsg] = useState('');

  const [activeTab, setActiveTab] = useState<'branding' | 'email' | 'texts'>('email');

  // Access guard: superadmin role
  if (!user || user.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  // ── Load Email Branding ──────────────────────────────
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

  // ── Load Site Branding ───────────────────────────────
  const loadSiteBranding = useCallback(async () => {
    try {
      const data = await api.superadmin.getSiteBranding();
      if (data) {
        const merged = { ...liveBranding };
        for (const key of Object.keys(merged) as (keyof SiteBranding)[]) {
          if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
            (merged as Record<string, unknown>)[key] = data[key];
          }
        }
        if (typeof merged.tile_images === 'string') {
          try { merged.tile_images = JSON.parse(merged.tile_images as unknown as string); } catch { merged.tile_images = {}; }
        }
        setSite(merged);
      }
    } catch {
      // keep current state
    }
  }, [liveBranding]);

  // ── Load Text Branding ──────────────────────────────
  const loadTextBranding = useCallback(async () => {
    try {
      const data = await api.superadmin.getTextBranding();
      if (data) {
        const merged = { ...liveTextBranding };
        for (const key of Object.keys(merged) as (keyof TextBranding)[]) {
          if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
            (merged as Record<string, unknown>)[key] = data[key];
          }
        }
        setText(merged);
      }
    } catch {
      // keep current state
    }
  }, [liveTextBranding]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { loadEmailBranding(); loadSiteBranding(); loadTextBranding(); }, [loadEmailBranding, loadSiteBranding, loadTextBranding]);

  const setSiteField = <K extends keyof SiteBranding>(key: K, value: SiteBranding[K]) =>
    setSite((prev) => ({ ...prev, [key]: value }));

  const setEb = <K extends keyof EmailBranding>(key: K, value: EmailBranding[K]) =>
    setEmailBranding((prev) => ({ ...prev, [key]: value }));

  const setTextField = <K extends keyof TextBranding>(key: K, value: TextBranding[K]) =>
    setText((prev) => ({ ...prev, [key]: value }));

  // ── Save Site Branding ───────────────────────────────
  const saveSiteBranding = async () => {
    setSiteSaving(true);
    setSiteMsg('');
    try {
      await api.superadmin.updateSiteBranding(site as unknown as Record<string, unknown>);
      await reloadBranding(); // re-apply CSS variables globally
      setSiteMsg('Gespeichert ✓');
    } catch (e: any) {
      setSiteMsg(`Fehler: ${e?.message || 'Unbekannt'}`);
    } finally {
      setSiteSaving(false);
      setTimeout(() => setSiteMsg(''), 4000);
    }
  };

  // ── Save Text Branding ──────────────────────────────
  const saveTextBranding = async () => {
    setTextSaving(true);
    setTextMsg('');
    try {
      await api.superadmin.updateTextBranding(text as unknown as Record<string, unknown>);
      await reloadTextBranding();
      setTextMsg('Gespeichert');
    } catch (e: any) {
      setTextMsg(`Fehler: ${e?.message || 'Unbekannt'}`);
    } finally {
      setTextSaving(false);
      setTimeout(() => setTextMsg(''), 4000);
    }
  };

  // ── Save Email Branding ──────────────────────────────
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
  const logoPreviewSrc = api.superadmin.resolveLogoUrl(emailBranding.logo_url);
  const logoHtml = logoPreviewSrc
    ? `<div style="background:#fff;border-radius:6px;padding:6px;display:inline-block;margin:0 auto 6px;"><img src="${esc(logoPreviewSrc)}" alt="" style="max-height:50px;max-width:180px;display:block;" /></div>`
    : '';
  const previewHtmlContent = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;background:#f4f4f5;padding:16px;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="background:${esc(emailBranding.primary_color)};padding:14px 18px;text-align:center;color:#fff;">
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
            className={`superadmin__tab ${activeTab === 'branding' ? 'superadmin__tab--active' : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            Erscheinungsbild
          </button>
          <button
            type="button"
            className={`superadmin__tab ${activeTab === 'email' ? 'superadmin__tab--active' : ''}`}
            onClick={() => setActiveTab('email')}
          >
            E-Mail-Branding
          </button>
          <button
            type="button"
            className={`superadmin__tab ${activeTab === 'texts' ? 'superadmin__tab--active' : ''}`}
            onClick={() => setActiveTab('texts')}
          >
            Texte Sprechtag
          </button>
        </div>

        {/* ═══════════════════════════════════════════════
            TAB: Seiten-Branding (LIVE – persisted)
            ═══════════════════════════════════════════════ */}
        {activeTab === 'branding' && (
          <>
            {/* ── 1. Schulname / Header ───────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Schulname &amp; Header</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Schulname (wird im Header und auf der Landing Page angezeigt)</span>
                  <input
                    type="text"
                    className="superadmin__input"
                    value={site.school_name}
                    onChange={(e) => setSiteField('school_name', e.target.value)}
                    placeholder="z.B. Berufskolleg Simmerath/Stolberg"
                  />
                </div>
                <ColorField
                  label="Schriftfarbe Schulname im Header (leer = Standard)"
                  value={site.header_font_color || '#065f46'}
                  onChange={(v) => setSiteField('header_font_color', v)}
                />
              </div>
            </section>

            {/* ── 2. Farbschema ───────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Farbschema</h2>
              <div className="superadmin__grid">
                <ColorField label="Primärfarbe" value={site.primary_color} onChange={(v) => setSiteField('primary_color', v)} />
                <ColorField label="Primär dunkel" value={site.primary_dark} onChange={(v) => setSiteField('primary_dark', v)} />
                <ColorField label="Primär dunkler" value={site.primary_darker} onChange={(v) => setSiteField('primary_darker', v)} />
                <ColorField label="Sekundärfarbe" value={site.secondary_color} onChange={(v) => setSiteField('secondary_color', v)} />
                <ColorField label="Akzentfarbe (Ink)" value={site.ink_color} onChange={(v) => setSiteField('ink_color', v)} />
                <ColorField label="Hintergrund hell" value={site.surface_1} onChange={(v) => setSiteField('surface_1', v)} />
                <ColorField label="Hintergrund mittel" value={site.surface_2} onChange={(v) => setSiteField('surface_2', v)} />
              </div>
            </section>

            {/* ── 3. Hero-Texte ───────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Landing Page — Hero-Texte</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Überschrift</span>
                  <input type="text" className="superadmin__input" value={site.hero_title} onChange={(e) => setSiteField('hero_title', e.target.value)} placeholder="Herzlich willkommen!" />
                </div>
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Beschreibungstext</span>
                  <textarea className="superadmin__textarea" value={site.hero_text} onChange={(e) => setSiteField('hero_text', e.target.value)} placeholder="Beschreibungstext für den Hero-Bereich" rows={3} />
                </div>
              </div>
            </section>

            {/* ── 4. Drei-Schritte ────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Kurzanleitung (3 Schritte)</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field">
                  <span className="superadmin__label">Schritt 1</span>
                  <input type="text" className="superadmin__input" value={site.step_1} onChange={(e) => setSiteField('step_1', e.target.value)} placeholder="Lehrkraft auswählen" />
                </div>
                <div className="superadmin__field">
                  <span className="superadmin__label">Schritt 2</span>
                  <input type="text" className="superadmin__input" value={site.step_2} onChange={(e) => setSiteField('step_2', e.target.value)} placeholder="Wunsch-Zeitfenster wählen" />
                </div>
                <div className="superadmin__field">
                  <span className="superadmin__label">Schritt 3</span>
                  <input type="text" className="superadmin__input" value={site.step_3} onChange={(e) => setSiteField('step_3', e.target.value)} placeholder="Daten eingeben und absenden" />
                </div>
              </div>
            </section>

            {/* ── 5. Kachel-Bilder ────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Kachel-Bilder (Landing Page)</h2>
              <p className="superadmin__label" style={{ marginBottom: 12 }}>
                Laden Sie für jedes Modul ein eigenes Bild hoch. Ohne Upload wird das Emoji des Moduls angezeigt.
              </p>
              <div className="superadmin__grid">
                {modules.map((mod) => {
                  const tileUrl = site.tile_images?.[mod.id] || '';
                  return (
                    <div key={mod.id} className="superadmin__field">
                      <span className="superadmin__label">{mod.icon} {mod.title}</span>
                      {tileUrl && (
                        <div style={{ marginBottom: 6 }}>
                          <img
                            src={api.superadmin.resolveTileUrl(tileUrl)}
                            alt={`Kachelbild ${mod.title}`}
                            style={{ maxHeight: 60, maxWidth: 120, borderRadius: 6, background: '#fff', padding: 2 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                        className="superadmin__input"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const maxSize = 2 * 1024 * 1024;
                          if (file.size > maxSize) {
                            setSiteMsg(`Fehler: "${file.name}" ist zu gross (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximal 2 MB erlaubt.`);
                            setTimeout(() => setSiteMsg(''), 6000);
                            e.target.value = '';
                            return;
                          }
                          const allowedExts = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
                          const allowedMimes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/gif'];
                          const dotIdx = file.name.lastIndexOf('.');
                          const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : '';
                          if (!ext || !allowedExts.includes(ext) || !allowedMimes.includes(file.type)) {
                            setSiteMsg(`Fehler: "${file.name}" hat ein nicht unterstuetztes Format (${ext || 'keine Endung'}, Typ: ${file.type || 'unbekannt'}). Erlaubt: PNG, JPG, SVG, WebP, GIF.`);
                            setTimeout(() => setSiteMsg(''), 6000);
                            e.target.value = '';
                            return;
                          }
                          try {
                            const result = await api.superadmin.uploadTileImage(file);
                            setSite((prev) => ({
                              ...prev,
                              tile_images: { ...prev.tile_images, [mod.id]: result.tile_url },
                            }));
                            setSiteMsg(`Bild fuer ${mod.title} hochgeladen`);
                            setTimeout(() => setSiteMsg(''), 3000);
                          } catch (err: any) {
                            setSiteMsg(`Fehler: Upload fuer ${mod.title} fehlgeschlagen – ${err.message || 'Unbekannter Fehler'}`);
                            setTimeout(() => setSiteMsg(''), 6000);
                          }
                          e.target.value = '';
                        }}
                      />
                      {tileUrl && (
                        <button
                          type="button"
                          className="superadmin__btn superadmin__btn--secondary"
                          style={{ marginTop: 4, fontSize: '0.8rem', padding: '4px 10px' }}
                          onClick={() => {
                            setSite((prev) => {
                              const next = { ...prev.tile_images };
                              delete next[mod.id];
                              return { ...prev, tile_images: next };
                            });
                          }}
                        >Bild entfernen</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── Live Preview ────────────────────────── */}
            <div className="superadmin__preview">
              <div className="superadmin__preview-title">Vorschau</div>
              <div className="superadmin__preview-frame">
                <div className="superadmin__preview-header" style={{ background: site.primary_color, color: '#fff' }}>
                  <span style={{ color: site.header_font_color || '#fff' }}>{site.school_name || 'Schulname'}</span>
                  <span style={{ opacity: 0.7, marginLeft: 6 }}>— Buchungssystem</span>
                </div>
                <div className="superadmin__preview-hero" style={{ background: `linear-gradient(135deg, ${site.surface_1} 0%, #fff 60%, ${site.surface_2} 100%)` }}>
                  <h2 style={{ color: site.primary_dark }}>{site.hero_title || 'Überschrift'}</h2>
                  <p style={{ color: '#374151' }}>{site.hero_text || 'Beschreibungstext…'}</p>
                  <div className="superadmin__preview-steps">
                    <div className="superadmin__preview-step"><strong style={{ color: site.primary_dark }}>1.</strong> {site.step_1 || '—'}</div>
                    <div className="superadmin__preview-step"><strong style={{ color: site.primary_dark }}>2.</strong> {site.step_2 || '—'}</div>
                    <div className="superadmin__preview-step"><strong style={{ color: site.primary_dark }}>3.</strong> {site.step_3 || '—'}</div>
                  </div>
                </div>
                <div className="superadmin__preview-buttons">
                  <button type="button" className="superadmin__preview-btn" style={{ background: site.primary_color }}>Primärbutton</button>
                  <button type="button" className="superadmin__preview-btn superadmin__preview-btn--secondary" style={{ borderColor: site.primary_dark, color: site.primary_dark }}>Sekundärbutton</button>
                </div>
              </div>
            </div>

            {/* ── Status + Save ────────────────────────── */}
            {siteMsg && (
              <div className={`superadmin__hint ${siteMsg.startsWith('Fehler') ? 'superadmin__hint--error' : ''}`}>
                <span>{siteMsg}</span>
              </div>
            )}
            <div className="superadmin__actions">
              <button type="button" className="superadmin__btn superadmin__btn--secondary" onClick={() => { setSite({ ...liveBranding }); setSiteMsg(''); }}>Zurücksetzen</button>
              <button type="button" className="superadmin__btn superadmin__btn--primary" onClick={saveSiteBranding} disabled={siteSaving}>
                {siteSaving ? 'Speichern…' : 'Änderungen speichern'}
              </button>
            </div>
          </>
        )}

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

            {/* ── Logo-Upload ────────────────────────────── */}
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
                        setEmailMsg('Logo hochgeladen!');
                      } catch (err: any) {
                        setEmailMsg(err.message || 'Upload fehlgeschlagen');
                      }
                    }}
                  />
                  {emailBranding.logo_url && (
                    <div style={{ marginTop: 8 }}>
                      <img
                        src={api.superadmin.resolveLogoUrl(emailBranding.logo_url)}
                        alt="Logo-Vorschau"
                        style={{ maxHeight: 60, maxWidth: 220, borderRadius: 4, background: '#fff', padding: 4 }}
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
            TAB: Text-Branding (Elternsprechtag Buchungs-UI)
            ═══════════════════════════════════════════════ */}
        {activeTab === 'texts' && (
          <>
            {/* ── 1. Welcome-Bereich ────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Willkommen-Bereich</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Titel</span>
                  <input type="text" className="superadmin__input" value={text.booking_title} onChange={(e) => setTextField('booking_title', e.target.value)} placeholder="Herzlich willkommen!" />
                </div>
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Beschreibungstext (Absatztrennung mit Leerzeile)</span>
                  <textarea className="superadmin__textarea" value={text.booking_text} onChange={(e) => setTextField('booking_text', e.target.value)} rows={5} />
                </div>
              </div>
            </section>

            {/* ── 2. Drei-Schritte-Anleitung ────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Kurzanleitung (Sidebar)</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Titel</span>
                  <input type="text" className="superadmin__input" value={text.booking_steps_title} onChange={(e) => setTextField('booking_steps_title', e.target.value)} placeholder="In drei Schritten zum Termin:" />
                </div>
                <div className="superadmin__field">
                  <span className="superadmin__label">Schritt 1</span>
                  <input type="text" className="superadmin__input" value={text.booking_step_1} onChange={(e) => setTextField('booking_step_1', e.target.value)} />
                </div>
                <div className="superadmin__field">
                  <span className="superadmin__label">Schritt 2</span>
                  <input type="text" className="superadmin__input" value={text.booking_step_2} onChange={(e) => setTextField('booking_step_2', e.target.value)} />
                </div>
                <div className="superadmin__field">
                  <span className="superadmin__label">Schritt 3</span>
                  <input type="text" className="superadmin__input" value={text.booking_step_3} onChange={(e) => setTextField('booking_step_3', e.target.value)} />
                </div>
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Hinweistext unter den Schritten</span>
                  <textarea className="superadmin__textarea" value={text.booking_hint} onChange={(e) => setTextField('booking_hint', e.target.value)} rows={2} />
                </div>
              </div>
            </section>

            {/* ── 3. Event-Banner ───────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Event-Banner</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">
                    Banner-Text (Platzhalter: {'{weekday}'}, {'{date}'}, {'{startTime}'}, {'{endTime}'})
                  </span>
                  <textarea className="superadmin__textarea" value={text.event_banner_template} onChange={(e) => setTextField('event_banner_template', e.target.value)} rows={2} />
                </div>
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Fallback-Text (wenn kein Event aktiv)</span>
                  <input type="text" className="superadmin__input" value={text.event_banner_fallback} onChange={(e) => setTextField('event_banner_fallback', e.target.value)} />
                </div>
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Hinweis bei deaktivierten Buchungen</span>
                  <input type="text" className="superadmin__input" value={text.booking_closed_text} onChange={(e) => setTextField('booking_closed_text', e.target.value)} />
                </div>
              </div>
            </section>

            {/* ── 4. Erfolgs-Modal ──────────────────────── */}
            <section className="superadmin__section">
              <h2 className="superadmin__section-title">Erfolgs-Dialog (nach Buchungsanfrage)</h2>
              <div className="superadmin__grid">
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Titel</span>
                  <input type="text" className="superadmin__input" value={text.modal_title} onChange={(e) => setTextField('modal_title', e.target.value)} placeholder="Fast fertig!" />
                </div>
                <div className="superadmin__field superadmin__field--wide">
                  <span className="superadmin__label">Nachricht (Absatztrennung mit Leerzeile)</span>
                  <textarea className="superadmin__textarea" value={text.modal_text} onChange={(e) => setTextField('modal_text', e.target.value)} rows={5} />
                </div>
                <div className="superadmin__field">
                  <span className="superadmin__label">Button-Text</span>
                  <input type="text" className="superadmin__input" value={text.modal_button} onChange={(e) => setTextField('modal_button', e.target.value)} placeholder="Verstanden" />
                </div>
              </div>
            </section>

            {/* ── Status + Save ────────────────────────── */}
            {textMsg && (
              <div className={`superadmin__hint ${textMsg.startsWith('Fehler') ? 'superadmin__hint--error' : ''}`}>
                <span>{textMsg}</span>
              </div>
            )}
            <div className="superadmin__actions">
              <button type="button" className="superadmin__btn superadmin__btn--secondary" onClick={() => { setText({ ...liveTextBranding }); setTextMsg(''); }}>Zurücksetzen</button>
              <button type="button" className="superadmin__btn superadmin__btn--primary" onClick={saveTextBranding} disabled={textSaving}>
                {textSaving ? 'Speichern...' : 'Änderungen speichern'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
