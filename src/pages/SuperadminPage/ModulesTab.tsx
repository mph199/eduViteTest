import { useState, useEffect, useCallback } from 'react';
import { allModuleDefinitions } from '../../modules/registry';
import api from '../../services/api';

export function ModulesTab() {
  const [moduleConfig, setModuleConfig] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      const rows = await api.superadmin.getModuleConfig();
      const map: Record<string, boolean> = {};
      for (const r of rows) map[r.module_id] = r.enabled;
      setModuleConfig(map);
    } catch {
      // keep empty — treat all as enabled
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleToggle = async (moduleId: string, currentEnabled: boolean) => {
    const next = !currentEnabled;
    setSaving(moduleId);
    setMsg('');
    try {
      await api.superadmin.setModuleEnabled(moduleId, next);
      setModuleConfig((prev) => ({ ...prev, [moduleId]: next }));
      setMsg(`${moduleId} ${next ? 'aktiviert' : 'deaktiviert'}`);
    } catch (e: unknown) {
      setMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`);
    } finally {
      setSaving(null);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  return (
    <>
      <div className="superadmin__hint">
        Übersicht aller registrierten Module. Aktivieren oder deaktivieren Sie Module über den Schalter.
        Deaktivierte Module sind für Benutzer nicht sichtbar.
      </div>

      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Registrierte Module</h2>
        <div className="superadmin__module-list">
          {allModuleDefinitions.map((mod) => {
            const isEnabled = moduleConfig[mod.id] !== false;
            return (
              <div key={mod.id} className={`superadmin__module-card ${isEnabled ? '' : 'superadmin__module-card--disabled'}`}>
                <div className="superadmin__module-icon" aria-hidden="true">{mod.icon}</div>
                <div className="superadmin__module-info">
                  <div className="superadmin__module-header">
                    <span className="superadmin__module-title">{mod.title}</span>
                    <span className={`superadmin__module-status ${isEnabled ? 'superadmin__module-status--active' : 'superadmin__module-status--inactive'}`}>
                      {isEnabled ? 'Aktiv' : 'Deaktiviert'}
                    </span>
                  </div>
                  <span className="superadmin__module-desc">{mod.description}</span>
                  <div className="superadmin__module-meta">
                    <span>Pfad: <code>{mod.basePath}</code></span>
                    <span>ID: <code>{mod.id}</code></span>
                    {mod.adminRoutes && mod.adminRoutes.length > 0 && (
                      <span>Admin-Routen: {mod.adminRoutes.length}</span>
                    )}
                    {mod.teacherRoutes && mod.teacherRoutes.length > 0 && (
                      <span>Lehrer-Routen: {mod.teacherRoutes.length}</span>
                    )}
                  </div>
                </div>
                <label className="superadmin__toggle">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    disabled={saving === mod.id}
                    onChange={() => handleToggle(mod.id, isEnabled)}
                  />
                  <span className="superadmin__toggle-slider" />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      {msg && (
        <div className={`superadmin__hint ${msg.startsWith('Fehler') ? 'superadmin__hint--error' : ''}`}>
          <span>{msg}</span>
        </div>
      )}
    </>
  );
}
