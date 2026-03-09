import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { BookingRequest } from '../types';
import './TeacherRequestsTableSandbox.css';

function buildAssignableSlots(timeWindow: string): string[] {
  const m = String(timeWindow || '').trim().match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
  if (!m) return [];

  const start = Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
  const end = Number.parseInt(m[3], 10) * 60 + Number.parseInt(m[4], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  const fmt = (mins: number) => {
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Infer slot duration from the window size
  const windowSize = end - start;
  const dur = windowSize <= 30 ? windowSize : 15;

  const result: string[] = [];
  for (let t = start; t + dur <= end; t += dur) {
    result.push(`${fmt(t)} - ${fmt(t + dur)}`);
  }
  return result;
}

function parseTimeWindowToMinutes(timeWindow: string): { start: number; end: number } | null {
  const raw = String(timeWindow || '').trim();
  if (!raw) return null;

  const normalized = raw.replace(/[–—]/g, '-');

  const rangeMatch = normalized.match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1], 10) * 60 + Number.parseInt(rangeMatch[2], 10);
    const end = Number.parseInt(rangeMatch[3], 10) * 60 + Number.parseInt(rangeMatch[4], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return { start, end };
  }

  const pointMatch = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!pointMatch) return null;

  const start = Number.parseInt(pointMatch[1], 10) * 60 + Number.parseInt(pointMatch[2], 10);
  if (!Number.isFinite(start)) return null;
  // For a bare point time, assume a minimal 10-min slot
  return { start, end: start + 10 };
}

function splitTimesByRequestedWindow(times: string[], requestedWindow: string) {
  const requested = parseTimeWindowToMinutes(requestedWindow);
  if (!requested) {
    return { inside: times, outside: [] as string[] };
  }

  const inside: string[] = [];
  const outside: string[] = [];

  for (const time of times) {
    const parsed = parseTimeWindowToMinutes(time);
    if (!parsed) {
      outside.push(time);
      continue;
    }

    if (parsed.start >= requested.start && parsed.end <= requested.end) {
      inside.push(time);
    } else {
      outside.push(time);
    }
  }

  return { inside, outside };
}

function getAssignableTimes(request: BookingRequest): string[] {
  if (Array.isArray(request.availableTimes) && request.availableTimes.length > 0) {
    return request.availableTimes.filter((value) => typeof value === 'string' && value.trim().length > 0);
  }
  if (Array.isArray(request.assignableTimes)) {
    return request.assignableTimes.filter((value) => typeof value === 'string' && value.trim().length > 0);
  }
  return buildAssignableSlots(request.requestedTime);
}

/**
 * Enforce that selected slots are always consecutive.
 * When toggling a slot, only allow it if the resulting selection forms a contiguous block
 * within the ordered list of all slots.
 */
function toggleConsecutiveSlot(allSlots: string[], currentSelection: string[], slot: string): string[] {
  const isChecked = currentSelection.includes(slot);

  if (isChecked) {
    // Always allow removal — unless it would break consecutiveness (middle slot removal).
    // For simplicity, allow removal from edges only.
    const indices = currentSelection.map((s) => allSlots.indexOf(s)).sort((a, b) => a - b);
    const slotIndex = allSlots.indexOf(slot);
    if (indices.length <= 1) return [];
    if (slotIndex === indices[0] || slotIndex === indices[indices.length - 1]) {
      return currentSelection.filter((s) => s !== slot);
    }
    // Middle removal — strip down to just this slot (restart)
    return [slot];
  }

  // Adding a slot — must be adjacent to current selection
  if (currentSelection.length === 0) return [slot];

  const slotIndex = allSlots.indexOf(slot);
  const indices = currentSelection.map((s) => allSlots.indexOf(s)).sort((a, b) => a - b);
  const minIdx = indices[0];
  const maxIdx = indices[indices.length - 1];

  if (slotIndex === minIdx - 1 || slotIndex === maxIdx + 1) {
    return [...currentSelection, slot];
  }

  // Not adjacent — restart with just this slot
  return [slot];
}

function formatCreatedAt(createdAt?: string): string {
  if (!createdAt) return '-';
  const time = new Date(createdAt).getTime();
  if (!Number.isFinite(time)) return createdAt;

  const diffMs = Date.now() - time;
  if (diffMs < 60_000) return 'gerade eben';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `vor ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  return `vor ${days}d`;
}

type TeacherRequestsTableSandboxProps = {
  requests: BookingRequest[];
  selectedAssignTimes: Record<number, string[]>;
  teacherMessages: Record<number, string>;
  onAssignTimeChange: (requestId: number, values: string[]) => void;
  onTeacherMessageChange: (requestId: number, value: string) => void;
  onAcceptRequest: (requestId: number, assignedTimes?: string[]) => void;
  onDeclineRequest: (requestId: number) => void;
};

export function TeacherRequestsTableSandbox({
  requests,
  selectedAssignTimes,
  teacherMessages,
  onAssignTimeChange,
  onTeacherMessageChange,
  onAcceptRequest,
  onDeclineRequest,
}: TeacherRequestsTableSandboxProps) {
  const CARD_ACCENT_CLASSES = ['is-accent-1', 'is-accent-2', 'is-accent-3', 'is-accent-4'];

  const [expandedMessageIds, setExpandedMessageIds] = useState<Record<number, boolean>>({});
  const [slotPickerOpenIds, setSlotPickerOpenIds] = useState<Record<number, boolean>>({});
  const [modalOpenIndex, setModalOpenIndex] = useState<number | null>(null);

  const total = requests.length;

  /* ── helper: render full card content (reused in modal) ── */
  const renderFullCard = (request: BookingRequest) => {
    const assignableSlots = getAssignableTimes(request);
    const groupedTimes = splitTimesByRequestedWindow(assignableSlots, request.requestedTime);
    const selectedTimes = selectedAssignTimes[request.id] || [];
    const teacherMessage = teacherMessages[request.id] || '';
    const isParent = request.visitorType === 'parent';
    const contactName = isParent
      ? (request.parentName || '-')
      : [request.companyName || '-', request.representativeName ? `(${request.representativeName})` : '']
          .filter(Boolean)
          .join(' ');
    const personLabel = isParent ? (request.studentName || '-') : (request.traineeName || '-');
    const requestMessage = request.message || '-';
    const isExpandableMessage = requestMessage !== '-' && (requestMessage.length > 170 || requestMessage.includes('\n'));
    const isMessageExpanded = !!expandedMessageIds[request.id];

    return (
      <>
        <header className="sandbox-card__head">
          <div className="sandbox-card__preview-info">
            <span className="sandbox-request-indicator">{isParent ? 'Erziehungsberechtigte' : 'Ausbildungsbetrieb'}</span>
            <h3 className="sandbox-card__name">{contactName}</h3>
            <div className="sandbox-card__preview-row">
              <span className="sandbox-card__preview-detail">{personLabel} · {request.className}</span>
              <span className="sandbox-card__preview-time">{request.date} · {request.requestedTime}</span>
            </div>
            <p className="sandbox-card__meta">Eingegangen {formatCreatedAt(request.createdAt)}</p>
          </div>
        </header>

        <div className="sandbox-card__content">
          <dl className="sandbox-card__dl">
            <div className="sandbox-card__row">
              <dt>Schüler*in/Azubi</dt>
              <dd>{personLabel}</dd>
            </div>
            <div className="sandbox-card__row">
              <dt>Klasse</dt>
              <dd>{request.className}</dd>
            </div>
            <div className="sandbox-card__row">
              <dt>Kontaktkanal</dt>
              <dd>Mail</dd>
            </div>
            <div className="sandbox-card__row">
              <dt>E-Mail</dt>
              <dd>
                <a className="sandbox-mail-link" href={`mailto:${request.email}`}>{request.email}</a>
              </dd>
            </div>
          </dl>

          <div className="sandbox-card__message">
            <span>Eingegangene Nachricht</span>
            <p className={isMessageExpanded ? 'is-expanded' : ''}>{requestMessage}</p>
            {isExpandableMessage && (
              <button
                type="button"
                className="sandbox-more"
                onClick={() => {
                  setExpandedMessageIds((prev) => ({
                    ...prev,
                    [request.id]: !prev[request.id],
                  }));
                }}
              >
                {isMessageExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
              </button>
            )}

            <div className="sandbox-card__teacher-note">
              <span>Nachricht an den Ausbildungsbetrieb/Erziehungsberechtigten</span>
              <textarea
                className="sandbox-textarea"
                value={teacherMessage}
                onChange={(event) => onTeacherMessageChange(request.id, event.target.value)}
                placeholder="Wird in der Bestätigungs-E-Mail angezeigt"
                maxLength={1000}
                rows={3}
              />
            </div>
          </div>

          {assignableSlots.length > 0 && (
            <div className="sandbox-card__assign-section">
              <button
                type="button"
                className="sandbox-card__assign-toggle"
                onClick={() => setSlotPickerOpenIds((prev) => ({ ...prev, [request.id]: !prev[request.id] }))}
                aria-expanded={!!slotPickerOpenIds[request.id]}
              >
                <span>Zeitraum festlegen{selectedTimes.length > 0 && <span className="sandbox-slot-count"> ({selectedTimes.length} gewählt)</span>}</span>
                <span className={`sandbox-card__chevron ${slotPickerOpenIds[request.id] ? 'is-open' : ''}`} aria-hidden="true">›</span>
              </button>
              {slotPickerOpenIds[request.id] && (
                <div className="sandbox-card__assign-picker">
                  <div className="sandbox-multi-select" role="listbox" aria-multiselectable="true" aria-label="Zeitslots auswählen">
                    {groupedTimes.inside.length > 0 && (
                      <>
                        <div className="sandbox-multi-select__group-label">Innerhalb des angefragten Zeitraums</div>
                        {groupedTimes.inside.map((slot) => {
                          const isChecked = selectedTimes.includes(slot);
                          return (
                            <label
                              key={slot}
                              className={`sandbox-multi-select__item${isChecked ? ' is-selected' : ''} is-inside`}
                              onPointerDown={(e) => {
                                e.preventDefault();
                                const next = toggleConsecutiveSlot(assignableSlots, selectedTimes, slot);
                                onAssignTimeChange(request.id, next);
                              }}
                            >
                              <input type="checkbox" checked={isChecked} readOnly tabIndex={-1} className="sandbox-multi-select__checkbox" />
                              <span className="sandbox-multi-select__label">{slot}</span>
                            </label>
                          );
                        })}
                      </>
                    )}
                    {groupedTimes.outside.length > 0 && (
                      <>
                        <div className="sandbox-multi-select__group-label">Außerhalb des angefragten Zeitraums</div>
                        {groupedTimes.outside.map((slot) => {
                          const isChecked = selectedTimes.includes(slot);
                          return (
                            <label
                              key={slot}
                              className={`sandbox-multi-select__item${isChecked ? ' is-selected' : ''} is-outside`}
                              onPointerDown={(e) => {
                                e.preventDefault();
                                const next = toggleConsecutiveSlot(assignableSlots, selectedTimes, slot);
                                onAssignTimeChange(request.id, next);
                              }}
                            >
                              <input type="checkbox" checked={isChecked} readOnly tabIndex={-1} className="sandbox-multi-select__checkbox" />
                              <span className="sandbox-multi-select__label">{slot}</span>
                            </label>
                          );
                        })}
                      </>
                    )}
                  </div>
                  <p className="sandbox-card__assign-hint">Nur zusammenhängende Zeitslots können ausgewählt werden.</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="sandbox-card__footer">
          <div className="sandbox-card__actions">
            <button
              type="button"
              className="sandbox-decline-btn"
              onClick={() => onDeclineRequest(request.id)}
            >
              Ablehnen
            </button>
            <button
              type="button"
              className="sandbox-action-btn"
              onClick={() => onAcceptRequest(request.id, selectedTimes.length > 0 ? selectedTimes : undefined)}
              disabled={!request.verifiedAt || (assignableSlots.length > 0 && selectedTimes.length === 0)}
              title={
                !request.verifiedAt
                  ? 'Erst möglich, wenn die E-Mail-Adresse bestätigt wurde'
                  : assignableSlots.length > 0 && selectedTimes.length === 0
                    ? 'Bitte zuerst mindestens einen Zeitslot auswählen'
                    : selectedTimes.length > 1
                      ? `${selectedTimes.length} Zeiträume festlegen`
                      : undefined
              }
            >
              {selectedTimes.length > 1
                ? `${selectedTimes.length} Zeiträume festlegen`
                : 'Zeitraum festlegen'}
            </button>
          </div>
        </div>
      </>
    );
  };

  /* ── Modal portal ────────────────────────────────────── */
  const modalRequest = modalOpenIndex !== null ? requests[modalOpenIndex] : null;
  const modalContent = modalOpenIndex !== null && modalRequest ? createPortal(
    <div
      className="sandbox-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) setModalOpenIndex(null); }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setModalOpenIndex(null);
        if (e.key === 'ArrowLeft' && modalOpenIndex > 0) setModalOpenIndex(modalOpenIndex - 1);
        if (e.key === 'ArrowRight' && modalOpenIndex < total - 1) setModalOpenIndex(modalOpenIndex + 1);
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Anfrage ${modalOpenIndex + 1} von ${total}`}
      tabIndex={-1}
      ref={(el) => el?.focus()}
    >
      <div className="sandbox-modal">
        <div className="sandbox-modal__header">
          <span className="sandbox-modal__progress">Anfrage {modalOpenIndex + 1} von {total}</span>
          <button type="button" className="sandbox-modal__close" onClick={() => setModalOpenIndex(null)} aria-label="Schließen">✕</button>
        </div>
        <div className="sandbox-modal__nav">
          <button
            type="button"
            className="sandbox-nav-btn sandbox-nav-arrow"
            onClick={() => setModalOpenIndex(Math.max(0, modalOpenIndex - 1))}
            disabled={modalOpenIndex <= 0}
            aria-label="Vorherige Anfrage"
          >{'<'}</button>
          <div className={`sandbox-modal__card sandbox-card ${CARD_ACCENT_CLASSES[modalOpenIndex % CARD_ACCENT_CLASSES.length]} is-expanded`}>
            {renderFullCard(modalRequest)}
          </div>
          <button
            type="button"
            className="sandbox-nav-btn sandbox-nav-arrow"
            onClick={() => setModalOpenIndex(Math.min(total - 1, modalOpenIndex + 1))}
            disabled={modalOpenIndex >= total - 1}
            aria-label="Nächste Anfrage"
          >{'>'}</button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <section className="sandbox-table" aria-label="Anfragen-Kartenansicht">
      <div className="sandbox-popup-view">
        {requests.length === 0 ? (
          <div className="sandbox-empty-state">Keine Anfragen vorhanden</div>
        ) : (
          <div className="sandbox-popup-grid">
            {requests.map((request, index) => {
              const isParent = request.visitorType === 'parent';
              const accentClass = CARD_ACCENT_CLASSES[index % CARD_ACCENT_CLASSES.length];
              const contactName = isParent
                ? (request.parentName || '-')
                : [request.companyName || '-', request.representativeName ? `(${request.representativeName})` : '']
                    .filter(Boolean)
                    .join(' ');
              const personLabel = isParent ? (request.studentName || '-') : (request.traineeName || '-');

              return (
                <article key={request.id} className={`sandbox-popup-card ${accentClass}`}>
                  <span className="sandbox-request-indicator">{isParent ? 'Erziehungsberechtigte' : 'Ausbildungsbetrieb'}</span>
                  <h3 className="sandbox-popup-card__name">{contactName}</h3>
                  <div className="sandbox-popup-card__info">
                    <span>{personLabel} · {request.className}</span>
                    <span className="sandbox-popup-card__time">{request.date} · {request.requestedTime}</span>
                  </div>
                  <p className="sandbox-popup-card__meta">Eingegangen {formatCreatedAt(request.createdAt)}</p>
                  <button
                    type="button"
                    className="sandbox-popup-card__open-btn"
                    onClick={() => setModalOpenIndex(index)}
                  >
                    Anfrage anzeigen
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {modalContent}
    </section>
  );
}
