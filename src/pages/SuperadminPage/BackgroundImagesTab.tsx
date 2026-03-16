import type { SiteBranding } from '../../contexts/BrandingContext';
import { modules } from '../../modules/registry';
import api from '../../services/api';

interface BgSlot {
  key: string;
  label: string;
  description: string;
}

const bgSlots: BgSlot[] = [
  { key: 'landing', label: 'Landing Page', description: 'Startseite / Modulübersicht' },
  ...modules.map((mod) => ({
    key: mod.id,
    label: mod.title,
    description: mod.description,
  })),
];

interface Props {
  site: SiteBranding;
  setSite: React.Dispatch<React.SetStateAction<SiteBranding>>;
  siteMsg: string;
  setSiteMsg: (msg: string) => void;
  siteSaving: boolean;
  onSave: () => void;
  onReset: () => void;
}

export function BackgroundImagesTab({ site, setSite, siteMsg, setSiteMsg, siteSaving, onSave, onReset }: Props) {
  const handleUpload = async (slotKey: string, file: File) => {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setSiteMsg(`Fehler: "${file.name}" ist zu gross (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximal 5 MB erlaubt.`);
      setTimeout(() => setSiteMsg(''), 6000);
      return;
    }
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
      setSiteMsg(`Fehler: "${file.name}" hat ein nicht unterstütztes Format. Erlaubt: PNG, JPG, WebP.`);
      setTimeout(() => setSiteMsg(''), 6000);
      return;
    }
    try {
      const result = await api.superadmin.uploadBgImage(file);
      setSite((prev) => ({
        ...prev,
        background_images: { ...prev.background_images, [slotKey]: result.bg_url },
      }));
      setSiteMsg(`Hintergrundbild hochgeladen`);
      setTimeout(() => setSiteMsg(''), 3000);
    } catch (err: any) {
      setSiteMsg(`Fehler: Upload fehlgeschlagen – ${err.message || 'Unbekannter Fehler'}`);
      setTimeout(() => setSiteMsg(''), 6000);
    }
  };

  const handleRemove = (slotKey: string) => {
    setSite((prev) => {
      const next = { ...prev.background_images };
      delete next[slotKey];
      return { ...prev, background_images: next };
    });
  };

  return (
    <>
      <div className="superadmin__hint">
        Laden Sie für jede Seite ein eigenes Hintergrundbild hoch. Ohne Upload wird das Standard-Hintergrundbild verwendet.
        Empfohlene Aufloesung: mindestens 1920x1080 Pixel. Erlaubte Formate: PNG, JPG, WebP (max. 5 MB).
      </div>

      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Seitenhintergründe</h2>
        <div className="superadmin__bg-grid">
          {bgSlots.map((slot) => {
            const bgUrl = site.background_images?.[slot.key] || '';
            const resolvedUrl = bgUrl ? api.superadmin.resolveBgUrl(bgUrl) : '';
            return (
              <div key={slot.key} className="superadmin__bg-card">
                <div
                  className="superadmin__bg-preview"
                  style={resolvedUrl ? { backgroundImage: `url(${resolvedUrl})` } : undefined}
                >
                  {!resolvedUrl && <span className="superadmin__bg-placeholder">Kein Bild</span>}
                </div>
                <div className="superadmin__bg-info">
                  <span className="superadmin__bg-label">{slot.label}</span>
                  <span className="superadmin__bg-desc">{slot.description}</span>
                  <div className="superadmin__bg-actions">
                    <label className="superadmin__btn superadmin__btn--secondary superadmin__bg-upload-label">
                      Bild wählen
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(slot.key, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {bgUrl && (
                      <button
                        type="button"
                        className="superadmin__btn superadmin__btn--secondary"
                        onClick={() => handleRemove(slot.key)}
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
