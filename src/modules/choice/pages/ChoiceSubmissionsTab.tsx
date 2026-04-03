import type { ChoiceSubmission } from '../../../types';
import api from '../../../services/api';

interface Props {
  groupId: string;
  submissions: ChoiceSubmission[];
  showFlash: (msg: string) => void;
}

export function ChoiceSubmissionsTab({ groupId, submissions, showFlash }: Props) {
  const handleExportCSV = async () => {
    try {
      const response = await api.choice.exportSubmissionsCSV(groupId);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wahlen-${groupId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showFlash('CSV-Export fehlgeschlagen');
    }
  };

  const submittedCount = submissions.filter((s) => s.status === 'submitted').length;
  const draftCount = submissions.filter((s) => s.status === 'draft').length;

  return (
    <div>
      <div className="choice-toolbar">
        <button className="btn-primary" onClick={handleExportCSV} disabled={submissions.length === 0}>
          CSV exportieren
        </button>
        <span className="choice-toolbar__info">
          {submittedCount} abgegeben, {draftCount} Entwürfe, {submissions.length} gesamt
        </span>
      </div>

      <div className="admin-resp-table-container">
        <table className="admin-resp-table">
          <thead>
            <tr>
              <th>Nachname</th>
              <th>Vorname</th>
              <th>E-Mail</th>
              <th>Klasse</th>
              <th>Status</th>
              <th>Abgabe am</th>
              <th>Wahlen</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 && (
              <tr><td colSpan={7} className="choice-empty">Keine Abgaben vorhanden</td></tr>
            )}
            {submissions.map((s) => (
              <tr key={s.id} className={s.status === 'draft' ? 'choice-row--inactive' : ''}>
                <td className="cell-bold">{s.last_name || '–'}</td>
                <td>{s.first_name || '–'}</td>
                <td>{s.email || '–'}</td>
                <td>{s.audience_label || '–'}</td>
                <td>
                  <span className={`choice-status choice-status--${s.status}`}>
                    {s.status === 'submitted' ? 'Abgegeben' : 'Entwurf'}
                  </span>
                </td>
                <td>{s.submitted_at ? new Date(s.submitted_at).toLocaleString('de-DE') : '–'}</td>
                <td>
                  <div className="choice-submission-items">
                    {(s.items || []).map((item, i) => (
                      <span key={i} className="choice-submission-pill">
                        {item.option_title || item.option_id}
                        <small className="choice-priority-hint">P{item.priority}</small>
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
