import { modules } from '../../modules/registry';
import { allModuleDefinitions } from '../../modules/registry';

export function ModulesTab() {
  return (
    <>
      <div className="superadmin__hint">
        Uebersicht aller registrierten Module. Module werden ueber die Umgebungsvariable
        <code style={{ margin: '0 4px', padding: '2px 6px', background: 'rgba(148, 163, 184, 0.12)', borderRadius: 4, fontSize: '0.82rem' }}>
          VITE_ENABLED_MODULES
        </code>
        (Frontend) und
        <code style={{ margin: '0 4px', padding: '2px 6px', background: 'rgba(148, 163, 184, 0.12)', borderRadius: 4, fontSize: '0.82rem' }}>
          ENABLED_MODULES
        </code>
        (Backend) gesteuert.
      </div>

      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Registrierte Module</h2>
        <div className="superadmin__module-list">
          {allModuleDefinitions.map((mod) => {
            const isEnabled = modules.some((m) => m.id === mod.id);
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
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
