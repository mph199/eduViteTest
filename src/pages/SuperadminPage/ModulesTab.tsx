import { useState, useEffect, useCallback } from 'react';
import { allModuleDefinitions } from '../../modules/registry';
import { useModuleConfig } from '../../contexts/ModuleConfigContext';
import api from '../../services/api';

interface ConfirmState {
  moduleId: string;
  moduleTitle: string;
  enabling: boolean;
}

const ENABLE_CHECKS = [
  'Die Aktivierung ist mit dem/der internen Projektverantwortlichen abgesprochen.',
  'Schulverantwortliche wissen, dass dieses Modul gestartet wird.',
  'Die notwendigen Daten (z.B. Lehrkraefte, Konfiguration) sind vorbereitet.',
] as const;

const DISABLE_CHECKS = [
  'Die Deaktivierung ist mit dem/der internen Projektverantwortlichen abgesprochen.',
  'Schulverantwortliche wissen, dass dieses Modul deaktiviert wird.',
  'Es ist bekannt, dass bestehende Daten des Moduls erhalten bleiben, aber nicht mehr zugaenglich sind.',
] as const;

export function ModulesTab() {
  const [moduleConfig, setModuleConfig] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const { reload: reloadGlobalConfig } = useModuleConfig();

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);

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

  const requestToggle = (moduleId: string, currentEnabled: boolean) => {
    const modDef = allModuleDefinitions.find((m) => m.id === moduleId);
    const checks = currentEnabled ? DISABLE_CHECKS : ENABLE_CHECKS;
    setConfirm({
      moduleId,
      moduleTitle: modDef?.title ?? moduleId,
      enabling: !currentEnabled,
    });
    setChecked(new Array(checks.length).fill(false));
  };

  const cancelConfirm = () => {
    setConfirm(null);
    setChecked([]);
  };

  const executeToggle = async () => {
    if (!confirm) return;
    const { moduleId, enabling, moduleTitle } = confirm;
    setSaving(moduleId);
    setMsg('');
    try {
      await api.superadmin.setModuleEnabled(moduleId, enabling);
      setModuleConfig((prev) => ({ ...prev, [moduleId]: enabling }));
      await reloadGlobalConfig();
      setConfirm(null);
      setChecked([]);
      setMsg(`${moduleTitle} ${enabling ? 'aktiviert' : 'deaktiviert'}`);
    } catch (e: unknown) {
      setMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`);
    } finally {
      setSaving(null);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const toggleCheck = (idx: number) => {
    setChecked((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const allChecked = checked.length > 0 && checked.every(Boolean);
  const activeChecks = confirm?.enabling ? ENABLE_CHECKS : DISABLE_CHECKS;

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
                    onChange={() => requestToggle(mod.id, isEnabled)}
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

      {confirm && (
        <div className="superadmin__confirm-overlay" onClick={cancelConfirm}>
          <div className="superadmin__confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="superadmin__confirm-title">
              {confirm.enabling ? 'Modul aktivieren' : 'Modul deaktivieren'}: {confirm.moduleTitle}
            </h3>
            <p className="superadmin__confirm-hint">
              Bitte bestätige alle Punkte, bevor du fortfährst:
            </p>
            <ul className="superadmin__confirm-checks">
              {activeChecks.map((label, idx) => (
                <li key={idx} className="superadmin__confirm-check-item">
                  <label className="superadmin__confirm-check-label">
                    <input
                      type="checkbox"
                      checked={checked[idx] ?? false}
                      onChange={() => toggleCheck(idx)}
                    />
                    <span>{label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="superadmin__confirm-actions">
              <button
                className="superadmin__confirm-btn superadmin__confirm-btn--cancel"
                onClick={cancelConfirm}
              >
                Abbrechen
              </button>
              <button
                className="superadmin__confirm-btn superadmin__confirm-btn--confirm"
                disabled={!allChecked}
                onClick={executeToggle}
              >
                {confirm.enabling ? 'Aktivieren' : 'Deaktivieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
