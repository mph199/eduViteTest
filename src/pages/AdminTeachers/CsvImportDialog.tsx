import type { CsvImportResult, CsvImportedTeacher, CsvSkippedRow } from '../../types';

interface Props {
  csvImport: { show: boolean; uploading: boolean; result: CsvImportResult | null };
  onClose: () => void;
  onImportAnother: () => void;
}

export function CsvImportDialog({ csvImport, onClose, onImportAnother }: Props) {
  if (!csvImport.show) return null;

  return (
    <div className="teacher-form-container" style={{ marginBottom: '1.5rem' }}>
      <h3>CSV Import</h3>
      {csvImport.uploading && <p>Import wird verarbeitet…</p>}
      {csvImport.result?.error && (
        <div style={{ color: 'var(--color-error, #dc2626)', marginBottom: '1rem' }}>
          <strong>Fehler:</strong> {csvImport.result.error}
          {csvImport.result.hint && <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{csvImport.result.hint}</div>}
        </div>
      )}
      {csvImport.result?.success && (
        <div>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div><strong>{csvImport.result.imported}</strong> importiert</div>
            <div><strong>{csvImport.result.skipped}</strong> übersprungen</div>
            <div><strong>{csvImport.result.total}</strong> Zeilen gesamt</div>
          </div>

          {(csvImport.result.details?.imported?.length ?? 0) > 0 && (
            <details open style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '0.5rem' }}>
                Importierte Lehrkräfte ({csvImport.result.details!.imported!.length})
              </summary>
              <div className="admin-resp-table-container">
                <table className="admin-resp-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>E-Mail</th>
                      <th>Username</th>
                      <th>Passwort</th>
                      <th>Slots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvImport.result.details!.imported!.map((t: CsvImportedTeacher) => (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td>{t.email}</td>
                        <td><code>{t.username}</code></td>
                        <td><code>{t.tempPassword}</code></td>
                        <td>{t.slotsCreated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="btn-secondary btn-secondary--sm"
                style={{ marginTop: '0.5rem' }}
                onClick={() => {
                  const imported = csvImport.result?.details?.imported ?? [];
                  const lines = ['Name;Email;Username;Passwort'];
                  for (const t of imported) {
                    lines.push(`${t.name};${t.email};${t.username};${t.tempPassword}`);
                  }
                  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'import-zugangsdaten.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Zugangsdaten als CSV herunterladen
              </button>
            </details>
          )}

          {(csvImport.result.details?.skipped?.length ?? 0) > 0 && (
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-warning, #b45309)' }}>
                Übersprungene Zeilen ({csvImport.result.details!.skipped!.length})
              </summary>
              <ul style={{ fontSize: '0.85rem', paddingLeft: '1.2rem' }}>
                {csvImport.result.details!.skipped!.map((s: CsvSkippedRow, i: number) => (
                  <li key={i}>Zeile {s.line}: {s.reason}{s.name ? ` (${s.name})` : ''}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button className="btn-secondary" onClick={onClose}>
          Schließen
        </button>
        {csvImport.result?.success && (
          <button className="btn-secondary" onClick={onImportAnother}>
            Weitere Datei importieren
          </button>
        )}
      </div>
      <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--brand-surface-2, #f0f0f0)', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
        <strong>CSV-Format:</strong> Semikolon- oder kommagetrennt, mit Kopfzeile.<br />
        Pflicht-Spalten: <code>Nachname</code>, <code>Email</code><br />
        Optional: <code>Vorname</code>, <code>Anrede</code>, <code>Raum</code>, <code>Fach</code>
      </div>
    </div>
  );
}
