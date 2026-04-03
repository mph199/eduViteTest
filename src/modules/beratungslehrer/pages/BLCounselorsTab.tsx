import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Counselor, ScheduleEntry } from '../../../types';
import { WEEKDAY_SHORT } from '../../../shared/constants/weekdays';
import { groupAlphabetically, getInitialsFromName } from '../../../shared/utils/groupAlphabetically';
import '../../../shared/styles/um-components.css';
import './bl-counselors.css';

function getCounselorLastName(c: Counselor): string {
  if (c.last_name) return c.last_name;
  const parts = (c.name || '').trim().split(/\s+/);
  return parts[parts.length - 1] || '';
}

interface Props {
  counselors: Counselor[];
  schedulesMap: Record<number, ScheduleEntry[]>;
}

export function BLCounselorsTab({ counselors, schedulesMap }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);
  const groups = useMemo(() => groupAlphabetically(counselors, getCounselorLastName), [counselors]);

  return (
    <>
      <div className="um-header">
        <div className="um-header__left">
          <h2 className="um-header__title">Beratungslehrkräfte</h2>
          <span className="um-header__count">{counselors.length}</span>
        </div>
      </div>

      <div className="bl-info-banner">
        Beratungslehrkräfte werden über <strong>Benutzer &amp; Rechte</strong> angelegt und bearbeitet.
        Aktivieren Sie dort beim Anlegen oder Bearbeiten eines Nutzers die Sektion &quot;Beratungslehrkräfte&quot;.
      </div>

      {counselors.length === 0 ? (
        <div className="um-empty">Keine Beratungslehrkräfte vorhanden.</div>
      ) : (
        <div className="um-list">
          {groups.map((group) => (
            <div key={group.letter}>
              <div className="um-alpha-divider">
                <span className="um-alpha-divider__letter">{group.letter}</span>
                <span className="um-alpha-divider__line" />
              </div>
              {group.items.map((c) => {
                const isOpen = openId === c.id;
                const scheduleEntries = (schedulesMap[c.id] || []).filter(s => s.active);
                return (
                  <div key={c.id} className="um-row-wrapper">
                    <div className="um-row" onClick={() => setOpenId(isOpen ? null : c.id)}>
                      <div className="bl-avatar">{getInitialsFromName(c.name || '')}</div>
                      <div className="um-info">
                        <span className="um-name">
                          {c.salutation ? `${c.salutation} ` : ''}{c.name}
                        </span>
                        <span className="um-email">{c.email || '--'}</span>
                      </div>
                      {c.room && <span className="bl-room-badge">Raum {c.room}</span>}
                      <ChevronDown
                        size={16}
                        className={`tb-chevron${isOpen ? ' tb-chevron--open' : ''}`}
                      />
                    </div>

                    <div className={`um-detail-panel${isOpen ? ' um-detail-panel--open' : ''}`}>
                      <div className="um-detail-panel__inner">
                        <div className="um-detail-grid">
                          <div className="um-detail-item">
                            <span className="um-detail-label">E-Mail</span>
                            <span className="um-detail-value">
                              {c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '--'}
                            </span>
                          </div>
                          <div className="um-detail-item">
                            <span className="um-detail-label">Raum</span>
                            <span className="um-detail-value">{c.room || '--'}</span>
                          </div>
                          <div className="um-detail-item" style={{ gridColumn: '1 / -1' }}>
                            <span className="um-detail-label">Sprechzeiten</span>
                            <span className="um-detail-value">
                              {scheduleEntries.length === 0 ? (
                                `${c.available_from?.toString().slice(0, 5) || '--'} – ${c.available_until?.toString().slice(0, 5) || '--'}`
                              ) : (
                                <div className="bl-schedule-list">
                                  {scheduleEntries.map((s) => (
                                    <div key={s.weekday} className="bl-schedule-item">
                                      <span className="bl-schedule-item__day">{WEEKDAY_SHORT[s.weekday - 1] || '?'}</span>
                                      <span className="bl-schedule-item__time">
                                        {s.start_time?.toString().slice(0, 5)} – {s.end_time?.toString().slice(0, 5)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
