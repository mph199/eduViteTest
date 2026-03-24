import { useState, useEffect, useCallback } from 'react';
import type { OAuthProviderFull, OAuthProviderFormData } from '../../types';
import api from '../../services/api';
import { useFlash } from '../../hooks/useFlash';

const EMPTY_FORM: OAuthProviderFormData = {
  providerKey: '',
  displayName: '',
  clientId: '',
  clientSecret: '',
  discoveryUrl: '',
  scopes: 'openid profile email',
  emailClaim: 'email',
  nameClaim: 'name',
  allowedDomains: '',
  autoProvisioning: false,
  enabled: false,
};

export function OAuthTab() {
  const [providers, setProviders] = useState<OAuthProviderFull[]>([]);
  const [msg, flash] = useFlash(4000);
  const [saving, setSaving] = useState(false);

  // Form state
  const [mode, setMode] = useState<'create' | 'edit' | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<OAuthProviderFormData>({ ...EMPTY_FORM });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<OAuthProviderFull | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      const res = await api.superadmin.getOAuthProviders();
      setProviders(res);
    } catch {
      flash('Fehler beim Laden der Provider');
    }
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  const setField = <K extends keyof OAuthProviderFormData>(key: K, value: OAuthProviderFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setMode('create');
  };

  const openEdit = (p: OAuthProviderFull) => {
    setForm({
      providerKey: p.provider_key,
      displayName: p.display_name,
      clientId: p.client_id,
      clientSecret: '',
      discoveryUrl: p.discovery_url,
      scopes: p.scopes,
      emailClaim: p.email_claim,
      nameClaim: p.name_claim,
      allowedDomains: p.allowed_domains ?? '',
      autoProvisioning: p.auto_provisioning,
      enabled: p.enabled,
    });
    setEditId(p.id);
    setMode('edit');
  };

  const closeForm = () => {
    setMode(null);
    setEditId(null);
  };

  const handleSave = async () => {
    if (!form.displayName.trim() || !form.clientId.trim() || !form.discoveryUrl.trim()) {
      flash('Fehler: Anzeigename, Client-ID und Discovery-URL sind Pflichtfelder');
      return;
    }
    if (mode === 'create' && (!form.providerKey.trim() || !form.clientSecret.trim())) {
      flash('Fehler: Provider-Key und Client-Secret sind Pflichtfelder');
      return;
    }

    setSaving(true);
    flash('');
    try {
      if (mode === 'create') {
        await api.superadmin.createOAuthProvider(form as unknown as Record<string, unknown>);
        flash('Provider erstellt');
      } else if (mode === 'edit' && editId !== null) {
        const payload: Record<string, unknown> = { ...form };
        if (!form.clientSecret) delete payload.clientSecret;
        delete payload.providerKey;
        await api.superadmin.updateOAuthProvider(editId, payload);
        flash('Provider aktualisiert');
      }
      closeForm();
      await loadProviders();
    } catch (e: unknown) {
      flash(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.superadmin.deleteOAuthProvider(deleteTarget.id);
      setDeleteTarget(null);
      flash('Provider gelöscht');
      await loadProviders();
    } catch (e: unknown) {
      flash(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="superadmin__hint">
        Verwalten Sie OAuth/OIDC-Provider für Single Sign-On. Aktive Provider werden als
        Anmeldebutton auf der Login-Seite angezeigt.
      </div>

      <section className="superadmin__section">
        <h2 className="superadmin__section-title">OAuth-Provider</h2>

        {providers.length === 0 && !mode && (
          <p style={{ color: 'var(--sa-text-muted)', fontSize: '0.88rem', margin: '0 0 1rem' }}>
            Noch keine Provider konfiguriert. Erstellen Sie einen Provider, um SSO zu aktivieren.
          </p>
        )}

        {/* Provider list */}
        {providers.map((p) => (
          <div
            key={p.id}
            className={`superadmin__module-card ${p.enabled ? '' : 'superadmin__module-card--disabled'}`}
            style={{ marginBottom: '0.75rem' }}
          >
            <div className="superadmin__module-info">
              <div className="superadmin__module-header">
                <span className="superadmin__module-title">{p.display_name}</span>
                <span className={`superadmin__module-status ${p.enabled ? 'superadmin__module-status--active' : 'superadmin__module-status--inactive'}`}>
                  {p.enabled ? 'Aktiv' : 'Deaktiviert'}
                </span>
              </div>
              <div className="superadmin__module-meta">
                <span>Key: <code>{p.provider_key}</code></span>
                <span>Client-ID: <code>{p.client_id.length > 16 ? `${p.client_id.substring(0, 16)}...` : p.client_id}</code></span>
                {p.allowed_domains && <span>Domains: <code>{p.allowed_domains}</code></span>}
                {p.auto_provisioning && <span>Auto-Provisioning: aktiv</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="superadmin__btn superadmin__btn--secondary"
                onClick={() => openEdit(p)}
                disabled={saving}
              >
                Bearbeiten
              </button>
              <button
                type="button"
                className="superadmin__btn superadmin__btn--secondary"
                style={{ color: 'var(--sa-error)' }}
                onClick={() => setDeleteTarget(p)}
                disabled={saving}
              >
                Löschen
              </button>
            </div>
          </div>
        ))}

        {/* Add button */}
        {!mode && (
          <div className="superadmin__actions" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="superadmin__btn superadmin__btn--primary"
              onClick={openCreate}
            >
              Neuen Provider hinzufuegen
            </button>
          </div>
        )}
      </section>

      {/* Create / Edit form */}
      {mode && (
        <section className="superadmin__section">
          <h2 className="superadmin__section-title">
            {mode === 'create' ? 'Neuen Provider erstellen' : `Provider bearbeiten: ${form.providerKey}`}
          </h2>

          <div className="superadmin__grid">
            <div className="superadmin__field">
              <label className="superadmin__label">Anzeigename *</label>
              <input
                className="superadmin__input"
                value={form.displayName}
                onChange={(e) => setField('displayName', e.target.value)}
                placeholder="z.B. Mit Microsoft anmelden"
              />
            </div>

            <div className="superadmin__field">
              <label className="superadmin__label">
                Provider-Key *{mode === 'edit' ? ' (nicht änderbar)' : ''}
              </label>
              <input
                className="superadmin__input"
                value={form.providerKey}
                onChange={(e) => setField('providerKey', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="z.B. microsoft"
                readOnly={mode === 'edit'}
                style={mode === 'edit' ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              />
            </div>

            <div className="superadmin__field">
              <label className="superadmin__label">Client-ID *</label>
              <input
                className="superadmin__input"
                value={form.clientId}
                onChange={(e) => setField('clientId', e.target.value)}
                placeholder="OAuth Client ID"
              />
            </div>

            <div className="superadmin__field">
              <label className="superadmin__label">
                Client-Secret *{mode === 'edit' ? ' (leer lassen = unverändert)' : ''}
              </label>
              <input
                className="superadmin__input"
                type="password"
                value={form.clientSecret}
                onChange={(e) => setField('clientSecret', e.target.value)}
                placeholder={mode === 'edit' ? 'Nur eingeben wenn ändern' : 'OAuth Client Secret'}
              />
            </div>

            <div className="superadmin__field superadmin__field--wide">
              <label className="superadmin__label">Discovery-URL *</label>
              <input
                className="superadmin__input"
                value={form.discoveryUrl}
                onChange={(e) => setField('discoveryUrl', e.target.value)}
                placeholder="https://login.microsoftonline.com/{tenant}/.well-known/openid-configuration"
              />
            </div>

            <div className="superadmin__field">
              <label className="superadmin__label">Scopes</label>
              <input
                className="superadmin__input"
                value={form.scopes}
                onChange={(e) => setField('scopes', e.target.value)}
                placeholder="openid profile email"
              />
            </div>

            <div className="superadmin__field">
              <label className="superadmin__label">Erlaubte Domains (kommagetrennt)</label>
              <input
                className="superadmin__input"
                value={form.allowedDomains}
                onChange={(e) => setField('allowedDomains', e.target.value)}
                placeholder="schule.de, bksb.de (leer = alle)"
              />
            </div>

            <div className="superadmin__field">
              <label className="superadmin__label">E-Mail-Claim</label>
              <input
                className="superadmin__input"
                value={form.emailClaim}
                onChange={(e) => setField('emailClaim', e.target.value)}
                placeholder="email"
              />
            </div>

            <div className="superadmin__field">
              <label className="superadmin__label">Name-Claim</label>
              <input
                className="superadmin__input"
                value={form.nameClaim}
                onChange={(e) => setField('nameClaim', e.target.value)}
                placeholder="name"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--sa-text-label)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.autoProvisioning}
                onChange={(e) => setField('autoProvisioning', e.target.checked)}
              />
              Auto-Provisioning (neue Benutzer automatisch anlegen)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--sa-text-label)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setField('enabled', e.target.checked)}
              />
              Aktiv (auf Login-Seite anzeigen)
            </label>
          </div>

          <div className="superadmin__actions" style={{ marginTop: '1.2rem' }}>
            <button
              type="button"
              className="superadmin__btn superadmin__btn--primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Speichern...' : mode === 'create' ? 'Erstellen' : 'Speichern'}
            </button>
            <button
              type="button"
              className="superadmin__btn superadmin__btn--secondary"
              onClick={closeForm}
              disabled={saving}
            >
              Abbrechen
            </button>
          </div>
        </section>
      )}

      {msg && (
        <div className={`superadmin__hint ${msg.startsWith('Fehler') ? 'superadmin__hint--error' : ''}`}>
          <span>{msg}</span>
        </div>
      )}

      {/* Delete confirmation overlay */}
      {deleteTarget && (
        <div className="superadmin__confirm-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="superadmin__confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="superadmin__confirm-title">
              Provider löschen: {deleteTarget.display_name}
            </h3>
            <p className="superadmin__confirm-hint">
              Der Provider <strong>{deleteTarget.display_name}</strong> ({deleteTarget.provider_key}) wird
              unwiderruflich gelöscht. Bestehende Benutzerverknüpfungen gehen verloren.
            </p>
            <div className="superadmin__confirm-actions">
              <button
                className="superadmin__confirm-btn superadmin__confirm-btn--cancel"
                onClick={() => setDeleteTarget(null)}
              >
                Abbrechen
              </button>
              <button
                className="superadmin__confirm-btn superadmin__confirm-btn--confirm"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? '��schen...' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
