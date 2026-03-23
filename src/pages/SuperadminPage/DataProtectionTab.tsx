import { useDataSubjectActions } from './useDataSubjectActions';
import { useAuditLog } from './useAuditLog';

const TABLE_LABELS: Record<string, string> = {
  teachers: 'Lehrkraefte',
  users: 'Benutzer',
  booking_requests: 'Buchungsanfragen',
  slots: 'Zeitfenster',
  ssw_appointments: 'SSW-Termine',
  bl_appointments: 'BL-Termine',
  consent_receipts: 'Einwilligungen',
};

export function DataProtectionTab() {
  const ds = useDataSubjectActions();
  const audit = useAuditLog();

  return (
    <div className="sa-section">
      <h2 className="sa-section__title">Datenschutz – Betroffenenrechte</h2>
      <p className="sa-section__hint">
        Personenbezogene Daten suchen, exportieren, berichtigen, löschen oder einschränken (Art. 15-21 DSGVO).
      </p>

      {/* ── Search Bar ───────────────────────────────────── */}
      <div className="sa-field" style={{ marginBottom: '1.5rem' }}>
        <label className="sa-field__label">E-Mail-Adresse der betroffenen Person</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="email"
            className="sa-field__input"
            placeholder="person@example.com"
            value={ds.email}
            onChange={e => ds.setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ds.handleSearch()}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="sa-btn sa-btn--primary"
            onClick={ds.handleSearch}
            disabled={ds.searching}
          >
            {ds.searching ? 'Suche...' : 'Suchen'}
          </button>
        </div>
        {ds.searchMsg && <p className="sa-field__msg" style={{ color: 'var(--sa-error)', marginTop: '0.5rem' }}>{ds.searchMsg}</p>}
      </div>

      {/* ── Search Results ───────────────────────────────── */}
      {ds.searchResult && ds.searchResult.total_records > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 className="sa-section__subtitle" style={{ margin: 0 }}>
              {ds.searchResult.total_records} Datensaetze gefunden
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="sa-btn sa-btn--small" onClick={() => ds.handleExport('json')} disabled={ds.actionLoading}>
                Export JSON
              </button>
              <button type="button" className="sa-btn sa-btn--small" onClick={() => ds.handleExport('csv')} disabled={ds.actionLoading}>
                Export CSV
              </button>
              <button type="button" className="sa-btn sa-btn--small" onClick={() => ds.setShowCorrection(!ds.showCorrection)} disabled={ds.actionLoading}>
                Berichtigen
              </button>
              <button type="button" className="sa-btn sa-btn--small" onClick={() => ds.handleRestrict(true)} disabled={ds.actionLoading}>
                Einschraenken
              </button>
              <button type="button" className="sa-btn sa-btn--small" onClick={() => ds.handleRestrict(false)} disabled={ds.actionLoading}>
                Einschraenkung aufheben
              </button>
              <button
                type="button"
                className="sa-btn sa-btn--small"
                style={{ color: 'var(--sa-error)', borderColor: 'var(--sa-error)' }}
                onClick={ds.handleDelete}
                disabled={ds.actionLoading}
              >
                Löschen (Art. 17)
              </button>
            </div>
          </div>

          {ds.actionMsg && (
            <p className="sa-field__msg" style={{
              color: ds.actionMsg.includes('Fehler') ? 'var(--sa-error)' : 'var(--sa-success)',
              marginBottom: '0.75rem',
            }}>{ds.actionMsg}</p>
          )}

          {/* ── Correction Form ──────────────────────────── */}
          {ds.showCorrection && (
            <div className="sa-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
              <h4 style={{ color: 'var(--sa-text-bright)', marginBottom: '0.75rem' }}>Daten berichtigen (Art. 16)</h4>
              <p className="sa-field__hint" style={{ marginBottom: '0.75rem' }}>
                Felder eingeben, die korrigiert werden sollen. Leere Felder werden ignoriert.
              </p>
              {['parent_name', 'student_name', 'email', 'class_name', 'phone', 'student_class'].map(field => (
                <div className="sa-field" key={field} style={{ marginBottom: '0.5rem' }}>
                  <label className="sa-field__label">{field}</label>
                  <input
                    type="text"
                    className="sa-field__input"
                    value={ds.corrections[field] || ''}
                    onChange={e => {
                      const val = e.target.value;
                      ds.setCorrections(prev => {
                        const next = { ...prev };
                        if (val) next[field] = val;
                        else delete next[field];
                        return next;
                      });
                    }}
                    placeholder={`Neuer Wert für ${field}`}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button type="button" className="sa-btn sa-btn--primary" onClick={ds.handleCorrect} disabled={ds.actionLoading || Object.keys(ds.corrections).length === 0}>
                  Berichtigung speichern
                </button>
                <button type="button" className="sa-btn" onClick={() => { ds.setShowCorrection(false); ds.setCorrections({}); }}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* ── Data Tables ──────────────────────────────── */}
          {Object.entries(ds.searchResult.data).map(([tableName, rows]) => {
            const tableRows = Array.isArray(rows) ? rows : [];
            if (tableRows.length === 0) return null;
            const isExpanded = ds.expandedTables.has(tableName);

            return (
              <div key={tableName} className="sa-card" style={{ marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => ds.toggleTable(tableName)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sa-text-bright)',
                    width: '100%', textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 600,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span>{TABLE_LABELS[tableName] || tableName} ({tableRows.length})</span>
                  <span style={{ color: 'var(--sa-text-muted)' }}>{isExpanded ? 'Zuklappen' : 'Aufklappen'}</span>
                </button>
                {isExpanded && (
                  <div style={{ overflowX: 'auto', padding: '0 1rem 1rem' }}>
                    <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {Object.keys(tableRows[0]).map(col => (
                            <th key={col} style={{
                              textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--sa-text-muted)',
                              borderBottom: '1px solid var(--sa-border)', whiteSpace: 'nowrap',
                            }}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, idx) => (
                          <tr key={idx}>
                            {Object.values(row).map((val, colIdx) => (
                              <td key={colIdx} style={{
                                padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--sa-border-light)',
                                whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {val === null
                                  ? <span style={{ color: 'var(--sa-text-muted)' }}>NULL</span>
                                  : typeof val === 'object'
                                    ? JSON.stringify(val)
                                    : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Audit Log Section ────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--sa-border)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="sa-section__subtitle" style={{ margin: 0 }}>Audit-Log</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="sa-btn sa-btn--small" onClick={() => audit.load(1)} disabled={audit.loading}>
              {audit.loading ? 'Lade...' : 'Laden'}
            </button>
            <button type="button" className="sa-btn sa-btn--small" onClick={audit.exportCsv}>
              CSV-Export
            </button>
          </div>
        </div>

        {/* Audit filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <select
            className="sa-field__input"
            style={{ width: 'auto', minWidth: '140px' }}
            value={audit.filter.action}
            onChange={e => audit.setFilter(prev => ({ ...prev, action: e.target.value }))}
          >
            <option value="">Alle Aktionen</option>
            <option value="READ">READ</option>
            <option value="WRITE">WRITE</option>
            <option value="DELETE">DELETE</option>
            <option value="EXPORT">EXPORT</option>
            <option value="RESTRICT">RESTRICT</option>
            <option value="LOGIN_FAIL">LOGIN_FAIL</option>
            <option value="ACCESS_DENIED">ACCESS_DENIED</option>
          </select>
          <select
            className="sa-field__input"
            style={{ width: 'auto', minWidth: '140px' }}
            value={audit.filter.table}
            onChange={e => audit.setFilter(prev => ({ ...prev, table: e.target.value }))}
          >
            <option value="">Alle Tabellen</option>
            <option value="data_subject">data_subject</option>
            <option value="security">security</option>
            <option value="audit_log">audit_log</option>
          </select>
        </div>

        {(ds.actionMsg || audit.exportError) && (
          <p className="sa-field__msg" style={{ color: 'var(--sa-error)', marginBottom: '0.5rem' }}>
            {audit.exportError || ds.actionMsg}
          </p>
        )}

        {/* Audit entries */}
        {audit.entries.length > 0 && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Zeitpunkt', 'Benutzer', 'Aktion', 'Tabelle', 'IP', 'Details'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '0.4rem 0.6rem', color: 'var(--sa-text-muted)',
                        borderBottom: '1px solid var(--sa-border)', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.entries.map(entry => (
                    <tr key={entry.id}>
                      <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--sa-border-light)', whiteSpace: 'nowrap' }}>
                        {new Date(entry.created_at).toLocaleString('de-DE')}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--sa-border-light)' }}>
                        {entry.user_name || entry.user_id || '-'}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--sa-border-light)' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '3px', fontSize: '0.72rem', fontWeight: 600,
                          background: entry.action.includes('FAIL') || entry.action.includes('DENIED')
                            ? 'var(--sa-error-bg, rgba(248,113,113,0.15))' : 'var(--sa-badge-bg)',
                          color: entry.action.includes('FAIL') || entry.action.includes('DENIED')
                            ? 'var(--sa-error)' : 'var(--sa-text-mono)',
                        }}>{entry.action}</span>
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--sa-border-light)' }}>
                        {entry.table_name || '-'}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--sa-border-light)', color: 'var(--sa-text-muted)' }}>
                        {entry.ip_address || '-'}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--sa-border-light)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.details && Object.keys(entry.details).length > 0
                          ? JSON.stringify(entry.details).slice(0, 80)
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {audit.pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="sa-btn sa-btn--small"
                  disabled={audit.pagination.page <= 1}
                  onClick={() => audit.load(audit.pagination.page - 1)}
                >
                  Zurück
                </button>
                <span style={{ color: 'var(--sa-text-muted)', fontSize: '0.8rem', alignSelf: 'center' }}>
                  Seite {audit.pagination.page} von {audit.pagination.pages} ({audit.pagination.total} Eintraege)
                </span>
                <button
                  type="button"
                  className="sa-btn sa-btn--small"
                  disabled={audit.pagination.page >= audit.pagination.pages}
                  onClick={() => audit.load(audit.pagination.page + 1)}
                >
                  Weiter
                </button>
              </div>
            )}
          </>
        )}

        {audit.entries.length === 0 && !audit.loading && (
          <p style={{ color: 'var(--sa-text-muted)', fontSize: '0.85rem' }}>
            Klicken Sie auf "Laden" um das Audit-Log anzuzeigen.
          </p>
        )}
      </div>
    </div>
  );
}
