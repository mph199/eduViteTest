import type { TimeSlot } from '../types';

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** Turn "DD.MM.YYYY" into "Freitag, 27.02.2027" */
function formatDateWithWeekday(dateStr: string): string {
  if (!dateStr) return 'Datum folgt';
  const parts = dateStr.split('.');
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${WEEKDAYS[d.getDay()]}, ${dateStr}`;
}

interface SlotListProps {
  slots: TimeSlot[];
  selectedSlotId: number | null;
  selectedTeacherId: number | null;
  selectedTeacherName?: string | null;
  eventId: number | null;
  onSelectSlot: (slotId: number) => void;
}

export const SlotList = ({
  slots,
  selectedSlotId,
  selectedTeacherId,
  selectedTeacherName,
  eventId,
  onSelectSlot,
}: SlotListProps) => {
  const emptyMessage = !selectedTeacherId
    ? 'Bitte wählen Sie eine Lehrkraft aus, um verfügbare Zeitfenster zu sehen.'
    : eventId === null
      ? 'Buchungen sind aktuell nicht freigeschaltet. Bitte versuchen Sie es später erneut.'
      : 'Für diese Lehrkraft sind aktuell keine Zeitfenster verfügbar. Bitte wählen Sie eine andere Lehrkraft oder versuchen Sie es später erneut.';

  const headline = selectedTeacherId && selectedTeacherName
    ? `Wunsch-Zeitfenster bei ${selectedTeacherName}`
    : 'Wunsch-Zeitfenster';

  return (
    <div className="slot-list" role="region" aria-label={headline}>
      <h2>{headline}</h2>
      <div className="slots-container" role="list">
        {slots.length === 0 ? (
          <p className="no-slots">
            {emptyMessage}
          </p>
        ) : (
          slots.map((slot) => (
            <button
              key={slot.id}
              className={`slot-card ${selectedSlotId === slot.id ? 'selected' : ''}`}
              type="button"
              onClick={() => onSelectSlot(slot.id)}
              role="listitem"
              aria-pressed={selectedSlotId === slot.id}
              aria-label={`Zeitfenster ${slot.time} am ${slot.date}`}
            >
              <div className="slot-kicker">Zeitraum</div>
              <div className="slot-time" aria-label="Zeitraum">
                {slot.time || 'Uhrzeit folgt'}
              </div>
              <div className="slot-meta" aria-label="Datum">
                <span className="slot-date">{formatDateWithWeekday(slot.date)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
