import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { useBranding, type SiteBranding } from '../../contexts/BrandingContext';
import { useTextBranding, type TextBranding } from '../../contexts/TextBrandingContext';
import api from '../../services/api';
import { BrandingTab } from './BrandingTab';
import { EmailBrandingTab } from './EmailBrandingTab';
import { TextBrandingTab } from './TextBrandingTab';
import '../SuperadminPage.css';

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

export function SuperadminPage() {
  const { user } = useAuth();
  const { branding: liveBranding, reload: reloadBranding } = useBranding();
  const { textBranding: liveTextBranding, reload: reloadTextBranding } = useTextBranding();

  const [site, setSite] = useState<SiteBranding>({ ...liveBranding });
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteMsg, setSiteMsg] = useState('');

  const [emailBranding, setEmailBranding] = useState<EmailBranding>({ ...DEFAULT_EMAIL_BRANDING });
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [previewEmail, setPreviewEmail] = useState('');
  const [previewSending, setPreviewSending] = useState(false);

  const [text, setText] = useState<TextBranding>({ ...liveTextBranding });
  const [textSaving, setTextSaving] = useState(false);
  const [textMsg, setTextMsg] = useState('');

  const [activeTab, setActiveTab] = useState<'branding' | 'email' | 'texts'>('email');

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

  useEffect(() => { loadEmailBranding(); loadSiteBranding(); loadTextBranding(); }, [loadEmailBranding, loadSiteBranding, loadTextBranding]);

  const setSiteField = <K extends keyof SiteBranding>(key: K, value: SiteBranding[K]) =>
    setSite((prev) => ({ ...prev, [key]: value }));

  const setEb = <K extends keyof EmailBranding>(key: K, value: EmailBranding[K]) =>
    setEmailBranding((prev) => ({ ...prev, [key]: value }));

  const setTextField = <K extends keyof TextBranding>(key: K, value: TextBranding[K]) =>
    setText((prev) => ({ ...prev, [key]: value }));

  const saveSiteBranding = async () => {
    setSiteSaving(true);
    setSiteMsg('');
    try {
      await api.superadmin.updateSiteBranding(site as unknown as Record<string, unknown>);
      await reloadBranding();
      setSiteMsg('Gespeichert ✓');
    } catch (e: any) {
      setSiteMsg(`Fehler: ${e?.message || 'Unbekannt'}`);
    } finally {
      setSiteSaving(false);
      setTimeout(() => setSiteMsg(''), 4000);
    }
  };

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

  // Access guard: superadmin role (placed after all hooks)
  if (!user || user.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="superadmin">
      <div className="superadmin__inner">
        <div className="superadmin__header">
          <span className="superadmin__badge">Superadmin</span>
          <h1 className="superadmin__title">Konfiguration</h1>
        </div>
        <p className="superadmin__subtitle">
          Tenant-Branding und E-Mail-Erscheinungsbild konfigurieren
        </p>

        <div className="superadmin__tabs">
          <button type="button" className={`superadmin__tab ${activeTab === 'branding' ? 'superadmin__tab--active' : ''}`} onClick={() => setActiveTab('branding')}>
            Erscheinungsbild
          </button>
          <button type="button" className={`superadmin__tab ${activeTab === 'email' ? 'superadmin__tab--active' : ''}`} onClick={() => setActiveTab('email')}>
            E-Mail-Branding
          </button>
          <button type="button" className={`superadmin__tab ${activeTab === 'texts' ? 'superadmin__tab--active' : ''}`} onClick={() => setActiveTab('texts')}>
            Texte Sprechtag
          </button>
        </div>

        {activeTab === 'branding' && (
          <BrandingTab
            site={site}
            setSiteField={setSiteField}
            setSite={setSite}
            siteMsg={siteMsg}
            setSiteMsg={setSiteMsg}
            siteSaving={siteSaving}
            liveBranding={liveBranding}
            onSave={saveSiteBranding}
            onReset={() => { setSite({ ...liveBranding }); setSiteMsg(''); }}
          />
        )}

        {activeTab === 'email' && (
          <EmailBrandingTab
            emailBranding={emailBranding}
            setEb={setEb}
            emailMsg={emailMsg}
            setEmailMsg={setEmailMsg}
            emailSaving={emailSaving}
            previewEmail={previewEmail}
            setPreviewEmail={setPreviewEmail}
            previewSending={previewSending}
            onSave={saveEmailBranding}
            onReset={() => { setEmailBranding({ ...DEFAULT_EMAIL_BRANDING }); setEmailMsg(''); }}
            onSendPreview={sendPreview}
          />
        )}

        {activeTab === 'texts' && (
          <TextBrandingTab
            text={text}
            setTextField={setTextField}
            textMsg={textMsg}
            textSaving={textSaving}
            onSave={saveTextBranding}
            onReset={() => { setText({ ...liveTextBranding }); setTextMsg(''); }}
          />
        )}
      </div>
    </div>
  );
}
