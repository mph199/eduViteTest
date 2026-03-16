import type { SiteBranding } from '../../contexts/BrandingContext';
import { modules } from '../../modules/registry';
import api from '../../services/api';
import { ColorField } from './ColorField';

interface Props {
  site: SiteBranding;
  setSiteField: <K extends keyof SiteBranding>(key: K, value: SiteBranding[K]) => void;
  setSite: React.Dispatch<React.SetStateAction<SiteBranding>>;
  siteMsg: string;
  setSiteMsg: (msg: string) => void;
  siteSaving: boolean;
  onSave: () => void;
  onReset: () => void;
}

export function BrandingTab({ site, setSiteField, setSite, siteMsg, setSiteMsg, siteSaving, onSave, onReset }: Props) {
  return (
    <>
      {/* 1. Schulname / Header */}
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

      {/* 2. Farbschema */}
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

      {/* 3. Hero-Texte */}
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

      {/* 4. Drei-Schritte */}
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

      {/* 5. Kachel-Bilder */}
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
                      style={{ maxHeight: 60, maxWidth: 120, borderRadius: 6, background: 'var(--color-white)', padding: 2 }}
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
                      setSiteMsg(`Fehler: "${file.name}" hat ein nicht unterstütztes Format (${ext || 'keine Endung'}, Typ: ${file.type || 'unbekannt'}). Erlaubt: PNG, JPG, SVG, WebP, GIF.`);
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
                      setSiteMsg(`Bild für ${mod.title} hochgeladen`);
                      setTimeout(() => setSiteMsg(''), 3000);
                    } catch (err: unknown) {
                      setSiteMsg(`Fehler: Upload für ${mod.title} fehlgeschlagen – ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
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

      {/* Live Preview */}
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

      {/* Status + Save */}
      {siteMsg && (
        <div className={`superadmin__hint ${siteMsg.startsWith('Fehler') ? 'superadmin__hint--error' : ''}`}>
          <span>{siteMsg}</span>
        </div>
      )}
      <div className="superadmin__actions">
        <button type="button" className="superadmin__btn superadmin__btn--secondary" onClick={onReset}>Zurücksetzen</button>
        <button type="button" className="superadmin__btn superadmin__btn--primary" onClick={onSave} disabled={siteSaving}>
          {siteSaving ? 'Speichern\u2026' : 'Änderungen speichern'}
        </button>
      </div>
    </>
  );
}
