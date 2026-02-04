import type { TimeSlot } from '../types';

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
    ? 'Bitte wählen Sie eine Lehrkraft aus, um Termine zu sehen.'
    : eventId === null
      ? 'Buchungen sind aktuell nicht freigeschaltet. Bitte versuchen Sie es später erneut.'
      : 'Für diese Lehrkraft sind aktuell keine Termine verfügbar. Bitte wählen Sie eine andere Lehrkraft oder versuchen Sie es später erneut.';

  const headline = selectedTeacherId && selectedTeacherName
    ? `Verfügbare Termine bei ${selectedTeacherName}`
    : 'Verfügbare Termine';

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
              className={`slot-card ${slot.booked ? 'booked' : 'available'} ${
                selectedSlotId === slot.id ? 'selected' : ''
              }`}
              type="button"
              onClick={() => onSelectSlot(slot.id)}
              role="listitem"
              disabled={slot.booked}
              aria-pressed={selectedSlotId === slot.id}
              aria-label={`Termin ${slot.time} am ${slot.date}${slot.booked ? ' - bereits gebucht' : ' - verfügbar'}`}
            >
              <div className="slot-time">
                {slot.time}
              </div>
              <div className="slot-date">{slot.date}</div>
              {slot.booked ? (
                <div className={`slot-status ${slot.status === 'reserved' ? 'reserved-status' : 'booked-status'}`}>
                  <span className="status-badge">{slot.status === 'reserved' ? 'Reserviert' : 'Gebucht'}</span>
                </div>
              ) : (
                <div className="slot-status available-status">
                  <span className="status-badge">Verfügbar</span>
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
