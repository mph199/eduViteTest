import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import './SuperadminPage.css';

/**
 * Superadmin Sandbox – Konzeptseite für Tenant-Branding.
 * Nur für den User "marc.huhn" sichtbar.
 * Rein visuelles Konzept, keine Backend-Verdrahtung.
 */

const SUPERADMIN_USERNAME = 'marc.huhn';

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

export function SuperadminPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<BrandingConfig>({ ...DEFAULT_CONFIG });

  // Access guard: only marc.huhn
  if (!user || user.username !== SUPERADMIN_USERNAME) {
    return <Navigate to="/" replace />;
  }

  const set = <K extends keyof BrandingConfig>(key: K, value: BrandingConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="superadmin">
      <div className="superadmin__inner">
        {/* ── Header ──────────────────────────────────── */}
        <div className="superadmin__header">
          <span className="superadmin__badge">Superadmin</span>
          <h1 className="superadmin__title">Tenant-Branding</h1>
        </div>
        <p className="superadmin__subtitle">
          Erscheinungsbild der Buchungsseite konfigurieren
        </p>

        <div className="superadmin__hint">
          <span>
            <strong>Sandbox-Modus</strong> — Änderungen werden nur in der Vorschau angezeigt und nicht persistiert.
          </span>
        </div>

        {/* ── 1. Schulname / Header ───────────────────── */}
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

        {/* ── 2. Farben ───────────────────────────────── */}
        <section className="superadmin__section">
          <h2 className="superadmin__section-title">
            Farbschema
          </h2>
          <div className="superadmin__grid">
            <ColorField
              label="Schriftfarbe (Body)"
              value={config.fontColor}
              onChange={(v) => set('fontColor', v)}
            />
            <ColorField
              label="Überschriften-Farbe"
              value={config.headingColor}
              onChange={(v) => set('headingColor', v)}
            />
            <ColorField
              label="Button Primär"
              value={config.buttonPrimaryColor}
              onChange={(v) => set('buttonPrimaryColor', v)}
            />
            <ColorField
              label="Button Sekundär"
              value={config.buttonSecondaryColor}
              onChange={(v) => set('buttonSecondaryColor', v)}
            />
          </div>
        </section>

        {/* ── 3. Hintergrundbild ──────────────────────── */}
        <section className="superadmin__section">
          <h2 className="superadmin__section-title">
            Hintergrundbild
          </h2>
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
            <div className="superadmin__field superadmin__field--wide">
              <div className="superadmin__upload-zone" role="button" tabIndex={0}>
                <span className="superadmin__upload-icon">↑</span>
                <span className="superadmin__upload-text">Bild hierher ziehen oder klicken</span>
                <span className="superadmin__upload-hint">JPG, PNG oder WebP — max. 2 MB</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. Hero-Texte ───────────────────────────── */}
        <section className="superadmin__section">
          <h2 className="superadmin__section-title">
            Hero-Bereich — Texte
          </h2>
          <div className="superadmin__grid">
            <div className="superadmin__field superadmin__field--wide">
              <span className="superadmin__label">Hero-Überschrift</span>
              <input
                type="text"
                className="superadmin__input"
                value={config.heroTitle}
                onChange={(e) => set('heroTitle', e.target.value)}
                placeholder="Herzlich willkommen!"
              />
            </div>
            <div className="superadmin__field superadmin__field--wide">
              <span className="superadmin__label">Hero-Beschreibung</span>
              <textarea
                className="superadmin__textarea"
                value={config.heroText}
                onChange={(e) => set('heroText', e.target.value)}
                placeholder="Beschreibungstext für den Hero-Bereich"
                rows={3}
              />
            </div>
          </div>
        </section>

        {/* ── 5. Drei-Schritte-Bereich ────────────────── */}
        <section className="superadmin__section">
          <h2 className="superadmin__section-title">
            Kurzanleitung (3 Schritte)
          </h2>
          <div className="superadmin__grid">
            <div className="superadmin__field">
              <span className="superadmin__label">Schritt 1</span>
              <input
                type="text"
                className="superadmin__input"
                value={config.step1}
                onChange={(e) => set('step1', e.target.value)}
                placeholder="Lehrkraft auswählen"
              />
            </div>
            <div className="superadmin__field">
              <span className="superadmin__label">Schritt 2</span>
              <input
                type="text"
                className="superadmin__input"
                value={config.step2}
                onChange={(e) => set('step2', e.target.value)}
                placeholder="Wunsch-Zeitfenster wählen"
              />
            </div>
            <div className="superadmin__field">
              <span className="superadmin__label">Schritt 3</span>
              <input
                type="text"
                className="superadmin__input"
                value={config.step3}
                onChange={(e) => set('step3', e.target.value)}
                placeholder="Daten eingeben und absenden"
              />
            </div>
          </div>
        </section>

        {/* ── Live Preview ────────────────────────────── */}
        <div className="superadmin__preview">
          <div className="superadmin__preview-title">Vorschau</div>
          <div className="superadmin__preview-frame">
            {/* Header preview */}
            <div
              className="superadmin__preview-header"
              style={{
                background: config.buttonPrimaryColor,
                color: '#fff',
              }}
            >
              {config.schoolName || 'Schulname'} — Buchungssystem
            </div>

            {/* Hero preview */}
            <div
              className="superadmin__preview-hero"
              style={{
                backgroundImage: config.backgroundImage
                  ? `url(${config.backgroundImage})`
                  : 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
                color: config.fontColor,
              }}
            >
              <h2 style={{ color: config.headingColor }}>
                {config.heroTitle || 'Überschrift'}
              </h2>
              <p>{config.heroText || 'Beschreibungstext…'}</p>

              {/* Three steps */}
              <div className="superadmin__preview-steps">
                <div className="superadmin__preview-step">
                  <strong style={{ color: config.headingColor }}>1.</strong>
                  {config.step1 || '—'}
                </div>
                <div className="superadmin__preview-step">
                  <strong style={{ color: config.headingColor }}>2.</strong>
                  {config.step2 || '—'}
                </div>
                <div className="superadmin__preview-step">
                  <strong style={{ color: config.headingColor }}>3.</strong>
                  {config.step3 || '—'}
                </div>
              </div>
            </div>

            {/* Buttons preview */}
            <div className="superadmin__preview-buttons">
              <button
                type="button"
                className="superadmin__preview-btn"
                style={{ background: config.buttonPrimaryColor }}
              >
                Primärbutton
              </button>
              <button
                type="button"
                className="superadmin__preview-btn superadmin__preview-btn--secondary"
                style={{
                  borderColor: config.buttonSecondaryColor,
                  color: config.buttonSecondaryColor,
                }}
              >
                Sekundärbutton
              </button>
            </div>
          </div>
        </div>

        {/* ── Action bar ──────────────────────────────── */}
        <div className="superadmin__actions">
          <button
            type="button"
            className="superadmin__btn superadmin__btn--secondary"
            onClick={() => setConfig({ ...DEFAULT_CONFIG })}
          >
            Zurücksetzen
          </button>
          <button
            type="button"
            className="superadmin__btn superadmin__btn--primary"
            onClick={() => alert('Sandbox-Modus: Speichern ist noch nicht verdrahtet.')}
          >
            Änderungen speichern
          </button>
        </div>
      </div>
    </div>
  );
}
