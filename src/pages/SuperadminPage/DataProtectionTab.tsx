import { useState, useCallback } from 'react';
import api from '../../services/api';
import type {
  DataSubjectSearchResult,
  AuditLogEntry,
  AuditLogResponse,
} from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TABLE_LABELS: Record<string, string> = {
  teachers: 'Lehrkraefte',
  users: 'Benutzer',
  booking_requests: 'Buchungsanfragen',
  slots: 'Zeitfenster',
  ssw_appointments: 'SSW-Termine',
  bl_appointments: 'BL-Termine',
  consent_receipts: 'Einwilligungen',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataProtectionTab() {
  // Search
  const [email, setEmail] = useState('');
  const [searchResult, setSearchResult] = useState<DataSubjectSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');

  // Actions
  const [actionMsg, setActionMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Correction modal
  const [showCorrection, setShowCorrection] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({});

  // Audit log
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState({ action: '', table: '' });

  // Expanded tables
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const clearMessages = () => { setSearchMsg(''); setActionMsg(''); };

  // ── Search ──────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!email.trim() || !email.includes('@')) {
      setSearchMsg('Bitte gueltige E-Mail-Adresse eingeben');
      return;
    }
    clearMessages();
    setSearching(true);
    setSearchResult(null);
    try {
      const result = await api.dataSubject.search(email.trim());
      setSearchResult(result);
      if (result.total_records === 0) setSearchMsg('Keine Daten gefunden');
    } catch (err: unknown) {
      setSearchMsg(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setSearching(false);
    }
  }, [email]);

  // ── Export ──────────────────────────────────────────────
  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    if (!email.trim()) return;
    setActionLoading(true);
    setActionMsg('');
    try {
      const response = await api.dataSubject.exportData(email.trim(), format);
      const blob = await response.blob();
      downloadBlob(blob, `datenauskunft-${email.trim()}.${format}`);
      setActionMsg(`${format.toUpperCase()}-Export heruntergeladen`);
    } catch (err: unknown) {
      setActionMsg(`Export-Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMsg(''), 4000);
    }
  }, [email]);

  // ── Delete ──────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!email.trim()) return;
    if (!window.confirm(`Alle personenbezogenen Daten fuer ${email.trim()} unwiderruflich anonymisieren?`)) return;
    setActionLoading(true);
    setActionMsg('');
    try {
      const result = await api.dataSubject.deleteData(email.trim());
      setActionMsg(result.message || 'Daten anonymisiert');
      // Refresh search results
      handleSearch();
    } catch (err: unknown) {
      setActionMsg(`Loeschfehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMsg(''), 6000);
    }
  }, [email, handleSearch]);

  // ── Correct ─────────────────────────────────────────────
  const handleCorrect = useCallback(async () => {
    if (!email.trim() || Object.keys(corrections).length === 0) return;
    setActionLoading(true);
    setActionMsg('');
    try {
      const result = await api.dataSubject.correctData(email.trim(), corrections);
      setActionMsg(result.message || 'Daten berichtigt');
      setShowCorrection(false);
      setCorrections({});
      handleSearch();
    } catch (err: unknown) {
      setActionMsg(`Berichtigungsfehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMsg(''), 6000);
    }
  }, [email, corrections, handleSearch]);

  // ── Restrict ────────────────────────────────────────────
  const handleRestrict = useCallback(async (restricted: boolean) => {
    if (!email.trim()) return;
    setActionLoading(true);
    setActionMsg('');
    try {
      const result = await api.dataSubject.restrict(email.trim(), restricted);
      setActionMsg(result.message || 'Einschraenkung gesetzt');
    } catch (err: unknown) {
      setActionMsg(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionMsg(''), 4000);
    }
  }, [email]);

  // ── Audit Log ───────────────────────────────────────────
  const loadAuditLog = useCallback(async (page = 1) => {
    setAuditLoading(true);
    try {
      const result: AuditLogResponse = await api.dataSubject.getAuditLog({
        page,
        limit: 20,
        action: auditFilter.action || undefined,
        table: auditFilter.table || undefined,
      });
      setAuditEntries(Array.isArray(result.entries) ? result.entries : []);
      setAuditPagination(result.pagination || { page: 1, pages: 1, total: 0 });
    } catch {
      setAuditEntries([]);
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilter]);

  const handleExportAuditLog = useCallback(async () => {
    try {
      const response = await api.dataSubject.exportAuditLog();
      const blob = await response.blob();
      downloadBlob(blob, `audit-log-${Date.now()}.csv`);
    } catch {
      setActionMsg('Audit-Log-Export fehlgeschlagen');
      setTimeout(() => setActionMsg(''), 4000);
    }
  }, []);

  const toggleTable = (table: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
  };

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="sa-section">
      <h2 className="sa-section__title">Datenschutz – Betroffenenrechte</h2>
      <p className="sa-section__hint">
        Personenbezogene Daten suchen, exportieren, berichtigen, loeschen oder einschraenken (Art. 15-21 DSGVO).
      </p>

      {/* ── Search Bar ───────────────────────────────────── */}
      <div className="sa-field" style={{ marginBottom: '1.5rem' }}>
        <label className="sa-field__label">E-Mail-Adresse der betroffenen Person</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="email"
            className="sa-field__input"
            placeholder="person@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="sa-btn sa-btn--primary"
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? 'Suche...' : 'Suchen'}
          </button>
        </div>
        {searchMsg && <p className="sa-field__msg" style={{ color: 'var(--sa-error)', marginTop: '0.5rem' }}>{searchMsg}</p>}
      </div>

      {/* ── Search Results ───────────────────────────────── */}
      {searchResult && searchResult.total_records > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 className="sa-section__subtitle" style={{ margin: 0 }}>
              {searchResult.total_records} Datensaetze gefunden
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="sa-btn sa-btn--small" onClick={() => handleExport('json')} disabled={actionLoading}>
                Export JSON
              </button>
              <button type="button" className="sa-btn sa-btn--small" onClick={() => handleExport('csv')} disabled={actionLoading}>
                Export CSV
              </button>
              <button type="button" className="sa-btn sa-btn--small" onClick={() => setShowCorrection(!showCorrection)} disabled={actionLoading}>
                Berichtigen
              </button>
              <button type="button" className="sa-btn sa-btn--small" onClick={() => handleRestrict(true)} disabled={actionLoading}>
                Einschraenken
              </button>
              <button type="button" className="sa-btn sa-btn--small" onClick={() => handleRestrict(false)} disabled={actionLoading}>
                Einschraenkung aufheben
              </button>
              <button
                type="button"
                className="sa-btn sa-btn--small"
                style={{ color: 'var(--sa-error)', borderColor: 'var(--sa-error)' }}
                onClick={handleDelete}
                disabled={actionLoading}
              >
                Loeschen (Art. 17)
              </button>
            </div>
          </div>

          {actionMsg && (
            <p className="sa-field__msg" style={{
              color: actionMsg.includes('Fehler') ? 'var(--sa-error)' : 'var(--sa-success)',
              marginBottom: '0.75rem',
            }}>{actionMsg}</p>
          )}

          {/* ── Correction Form ──────────────────────────── */}
          {showCorrection && (
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
                    value={corrections[field] || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setCorrections(prev => {
                        const next = { ...prev };
                        if (val) next[field] = val;
                        else delete next[field];
                        return next;
                      });
                    }}
                    placeholder={`Neuer Wert fuer ${field}`}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button type="button" className="sa-btn sa-btn--primary" onClick={handleCorrect} disabled={actionLoading || Object.keys(corrections).length === 0}>
                  Berichtigung speichern
                </button>
                <button type="button" className="sa-btn" onClick={() => { setShowCorrection(false); setCorrections({}); }}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* ── Data Tables ──────────────────────────────── */}
          {Object.entries(searchResult.data).map(([tableName, rows]) => {
            const tableRows = Array.isArray(rows) ? rows : [];
            if (tableRows.length === 0) return null;
            const isExpanded = expandedTables.has(tableName);

            return (
              <div key={tableName} className="sa-card" style={{ marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => toggleTable(tableName)}
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
                                {val === null ? <span style={{ color: 'var(--sa-text-muted)' }}>NULL</span> : String(val)}
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
            <button type="button" className="sa-btn sa-btn--small" onClick={() => loadAuditLog(1)} disabled={auditLoading}>
              {auditLoading ? 'Lade...' : 'Laden'}
            </button>
            <button type="button" className="sa-btn sa-btn--small" onClick={handleExportAuditLog}>
              CSV-Export
            </button>
          </div>
        </div>

        {/* Audit filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <select
            className="sa-field__input"
            style={{ width: 'auto', minWidth: '140px' }}
            value={auditFilter.action}
            onChange={e => setAuditFilter(prev => ({ ...prev, action: e.target.value }))}
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
            value={auditFilter.table}
            onChange={e => setAuditFilter(prev => ({ ...prev, table: e.target.value }))}
          >
            <option value="">Alle Tabellen</option>
            <option value="data_subject">data_subject</option>
            <option value="security">security</option>
            <option value="audit_log">audit_log</option>
          </select>
        </div>

        {/* Audit entries */}
        {auditEntries.length > 0 && (
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
                  {auditEntries.map(entry => (
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
                            ? 'rgba(248,113,113,0.15)' : 'var(--sa-badge-bg)',
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
            {auditPagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="sa-btn sa-btn--small"
                  disabled={auditPagination.page <= 1}
                  onClick={() => loadAuditLog(auditPagination.page - 1)}
                >
                  Zurueck
                </button>
                <span style={{ color: 'var(--sa-text-muted)', fontSize: '0.8rem', alignSelf: 'center' }}>
                  Seite {auditPagination.page} von {auditPagination.pages} ({auditPagination.total} Eintraege)
                </span>
                <button
                  type="button"
                  className="sa-btn sa-btn--small"
                  disabled={auditPagination.page >= auditPagination.pages}
                  onClick={() => loadAuditLog(auditPagination.page + 1)}
                >
                  Weiter
                </button>
              </div>
            )}
          </>
        )}

        {auditEntries.length === 0 && !auditLoading && (
          <p style={{ color: 'var(--sa-text-muted)', fontSize: '0.85rem' }}>
            Klicken Sie auf "Laden" um das Audit-Log anzuzeigen.
          </p>
        )}
      </div>
    </div>
  );
}
