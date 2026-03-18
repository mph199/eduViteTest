import type { Counselor, ScheduleEntry } from '../../../types';
import { WEEKDAY_SHORT } from '../../../shared/constants/weekdays';

interface Props {
  counselors: Counselor[];
  schedulesMap: Record<number, ScheduleEntry[]>;
}

export function BLCounselorsTab({ counselors, schedulesMap }: Props) {
  return (
    <>
      <div className="admin-section-header">
        <h3>Alle Beratungslehrkräfte</h3>
      </div>

      <div className="info-banner">
        <p>
          Beratungslehrkräfte werden über <strong>Benutzer &amp; Rechte</strong> angelegt und bearbeitet.
          Aktivieren Sie dort beim Anlegen oder Bearbeiten eines Nutzers die Sektion &quot;Beratungslehrkräfte&quot;.
        </p>
      </div>

      <div className="admin-resp-table-container">
        <table className="admin-resp-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Raum</th>
              <th>Zeiten</th>
            </tr>
          </thead>
          <tbody>
            {counselors.length === 0 ? (
              <tr><td colSpan={4}>Keine Beratungslehrkräfte vorhanden.</td></tr>
            ) : counselors.map(c => (
              <tr key={c.id}>
                <td data-label="Name">{c.salutation ? `${c.salutation} ` : ''}{c.name}</td>
                <td data-label="E-Mail">{c.email || '--'}</td>
                <td data-label="Raum">{c.room || '--'}</td>
                <td data-label="Zeiten">
                  {(() => {
                    const sch = (schedulesMap[c.id] || []).filter(s => s.active);
                    if (sch.length === 0) return `${c.available_from?.toString().slice(0, 5) || '--'} -- ${c.available_until?.toString().slice(0, 5) || '--'}`;
                    return sch.map(s => `${WEEKDAY_SHORT[s.weekday - 1] || '?'} ${s.start_time?.toString().slice(0, 5)}--${s.end_time?.toString().slice(0, 5)}`).join(', ');
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
