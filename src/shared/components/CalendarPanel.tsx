import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { CounselorAppointment as Appointment } from '../../types';
import { normalizeDate } from '../utils/appointmentDate';
import { WEEKDAY_SHORT_FULL } from '../constants/weekdays';

export interface CalendarPanelProps {
  calMonth: { year: number; month: number };
  setCalMonth: Dispatch<SetStateAction<{ year: number; month: number }>>;
  appointments: Appointment[];
  loading: boolean;
  selectedDate: string | null;
  setSelectedDate: Dispatch<SetStateAction<string | null>>;
  selectedIds: Set<number>;
  setSelectedIds: Dispatch<SetStateAction<Set<number>>>;
  deleting: boolean;
  onDeleteSelected: () => void;
  statusLabel: (s: string) => string;
  today: string;
  /** Column label for the detail table (default: "Thema"). */
  detailColumnLabel?: string;
  /** Accessor for detail column value (default: a.topic_name). */
  detailColumnValue?: (a: Appointment) => string | undefined;
}

export function CalendarPanel({
  calMonth,
  setCalMonth,
  appointments,
  loading,
  selectedDate,
  setSelectedDate,
  selectedIds,
  setSelectedIds,
  deleting,
  onDeleteSelected,
  statusLabel,
  today,
  detailColumnLabel = 'Thema',
  detailColumnValue,
}: CalendarPanelProps) {
  const { year, month } = calMonth;
  const getDetailValue = detailColumnValue ?? ((a: Appointment) => a.topic_name);

  return (
    <>
      {/* Month navigator */}
      <div className="cal-nav">
        <button className="btn-secondary" onClick={() => setCalMonth(prev => {
          const d = new Date(prev.year, prev.month - 1, 1);
          return { year: d.getFullYear(), month: d.getMonth() };
        })}>&lt;</button>
        <span className="cal-nav__label">
          {new Date(year, month).toLocaleString('de-DE', { month: 'long', year: 'numeric' })}
        </span>
        <button className="btn-secondary" onClick={() => setCalMonth(prev => {
          const d = new Date(prev.year, prev.month + 1, 1);
          return { year: d.getFullYear(), month: d.getMonth() };
        })}>&gt;</button>
      </div>

      {loading ? (
        <p>Lade Termine...</p>
      ) : (
        <>
          {(() => {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0).getDate();
            let startOffset = firstDay.getDay() - 1;
            if (startOffset < 0) startOffset = 6;

            const byDate: Record<string, Appointment[]> = {};
            for (const a of appointments) {
              const ds = normalizeDate(a.date);
              (byDate[ds] ||= []).push(a);
            }

            const cells: ReactNode[] = [];
            for (const label of WEEKDAY_SHORT_FULL) {
              cells.push(
                <div key={`h-${label}`} className="cal-grid__header">
                  {label}
                </div>
              );
            }
            for (let i = 0; i < startOffset; i++) {
              cells.push(<div key={`e-${i}`} />);
            }
            for (let d = 1; d <= lastDay; d++) {
              const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const dayAppts = byDate[ds] || [];
              const count = dayAppts.length;
              const isSelected = selectedDate === ds;
              const hasBooked = dayAppts.some(a => a.status !== 'available');
              const isPast = ds < today;

              const dayCls = ['cal-day',
                count > 0 && 'cal-day--has-appts',
                isSelected && 'cal-day--selected',
                isPast && 'cal-day--past',
              ].filter(Boolean).join(' ');

              cells.push(
                <div
                  key={d}
                  onClick={() => { setSelectedDate(isSelected ? null : ds); setSelectedIds(new Set()); }}
                  className={dayCls}
                >
                  <div className="cal-day__number">{d}</div>
                  {count > 0 && (
                    <div className="cal-day__count">
                      <span className="cal-day__count-text">{count} Termin{count !== 1 ? 'e' : ''}</span>
                      {hasBooked && <span className="cal-day__booked-marker">*</span>}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className="cal-grid">
                {cells}
              </div>
            );
          })()}

          {/* Selected day detail */}
          {selectedDate && (() => {
            const dayAppts = appointments
              .filter(a => normalizeDate(a.date) === selectedDate)
              .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

            if (dayAppts.length === 0) return (
              <div className="cal-day-panel">
                <strong>{new Date(selectedDate + 'T00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                <p style={{ marginTop: '0.5rem', color: 'var(--color-gray-500)' }}>Keine Termine an diesem Tag.</p>
              </div>
            );

            const allSelected = dayAppts.every(a => selectedIds.has(a.id));

            return (
              <div className="cal-day-panel">
                <div className="cal-day-panel__header">
                  <strong>{new Date(selectedDate + 'T00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                  <div className="cal-day-panel__actions">
                    <label className="cal-day-panel__select-all">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => {
                          if (allSelected) setSelectedIds(new Set());
                          else setSelectedIds(new Set(dayAppts.map(a => a.id)));
                        }}
                      />
                      Alle
                    </label>
                    {selectedIds.size > 0 && (
                      <button
                        className="btn-secondary btn--sm btn--danger"
                        disabled={deleting}
                        onClick={onDeleteSelected}
                      >
                        {deleting ? 'Lösche...' : `${selectedIds.size} löschen`}
                      </button>
                    )}
                  </div>
                </div>

                <div className="admin-resp-table-container">
                  <table className="admin-resp-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Uhrzeit</th>
                        <th>Status</th>
                        <th>Schüler/in</th>
                        <th>{detailColumnLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayAppts.map(a => (
                        <tr key={a.id} className={selectedIds.has(a.id) ? 'row--selected' : undefined}>
                          <td data-label="">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(a.id)}
                              onChange={() => setSelectedIds(prev => {
                                const next = new Set(prev);
                                if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                                return next;
                              })}
                            />
                          </td>
                          <td data-label="Uhrzeit" className="cell-bold">{a.time?.toString().slice(0, 5)}</td>
                          <td data-label="Status">{statusLabel(a.status)}</td>
                          <td data-label="Name">{[a.first_name, a.last_name].filter(Boolean).join(' ') || '--'}</td>
                          <td data-label={detailColumnLabel}>{getDetailValue(a) || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </>
  );
}
