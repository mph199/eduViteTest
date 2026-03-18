import { useState, useMemo, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { SlotList } from './SlotList';
import { BookingForm } from './BookingForm';
import { TeacherCombobox } from './TeacherCombobox';
import { useBooking } from '../hooks/useBooking';
import { useTextBranding } from '../../../contexts/TextBrandingContext';
import { useBgStyle } from '../../../hooks/useBgStyle';
import type { Teacher, AdminEvent } from '../../../types';
import { teacherDisplayNameAccusative } from '../../../utils/teacherDisplayName';
import api from '../../../services/api';
import './BookingApp.css';

type ActiveEventResponse = {
  event: AdminEvent | null;
};

export const BookingApp = () => {
  const { textBranding: tb } = useTextBranding();
  const bookingBgStyle = useBgStyle('elternsprechtag', '--page-bg');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teachersLoading, setTeachersLoading] = useState<boolean>(true);
  const [teachersError, setTeachersError] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [activeEvent, setActiveEvent] = useState<AdminEvent | null>(null);
  const [eventLoading, setEventLoading] = useState<boolean>(true);
  const [eventError, setEventError] = useState<string>('');

  const slotListRef = useRef<HTMLDivElement>(null);
  const bookingFormRef = useRef<HTMLDivElement>(null);

  const scrollToRef = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const formattedEventBanner = useMemo<ReactNode>(() => {
    if (!activeEvent) return '';

    const starts = new Date(activeEvent.starts_at);
    const ends = new Date(activeEvent.ends_at);

    const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(starts);
    const date = new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(starts);
    const startTime = new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(starts);
    const endTime = new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(ends);

    const bannerText = tb.event_banner_template
      .replace('{weekday}', weekday)
      .replace('{date}', date)
      .replace('{startTime}', startTime)
      .replace('{endTime}', endTime);

    return bannerText;
  }, [activeEvent, tb.event_banner_template]);

  const selectedTeacher = useMemo(() => {
    if (!selectedTeacherId) return null;
    return teachers.find((t) => t.id === selectedTeacherId) ?? null;
  }, [teachers, selectedTeacherId]);

  const selectedTeacherAccusativeName = useMemo(() => {
    return selectedTeacher ? teacherDisplayNameAccusative(selectedTeacher) : null;
  }, [selectedTeacher]);

  const {
    slots,
    selectedSlotId,
    message,
    bookingNoticeOpen,
    loading: slotsLoading,
    error: slotsError,
    handleSelectSlot,
    handleBooking,
    resetSelection,
  } = useBooking(
    selectedTeacherId,
    activeEvent?.id ?? null,
    activeEvent?.starts_at ?? null,
    selectedTeacher?.available_from,
    selectedTeacher?.available_until
  );

  // Auto-scroll to slot list once slots have loaded after teacher selection
  const prevTeacherIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      selectedTeacherId !== null &&
      selectedTeacherId !== prevTeacherIdRef.current &&
      !slotsLoading &&
      slotListRef.current
    ) {
      scrollToRef(slotListRef);
    }
    prevTeacherIdRef.current = selectedTeacherId;
  }, [selectedTeacherId, slotsLoading, scrollToRef]);

  // Auto-scroll to booking form when a slot is selected
  useEffect(() => {
    if (selectedSlotId && bookingFormRef.current) {
      scrollToRef(bookingFormRef);
    }
  }, [selectedSlotId, scrollToRef]);

  // Lade Lehrkräfte beim Mount
  useEffect(() => {
    const loadActiveEvent = async () => {
      setEventLoading(true);
      setEventError('');
      try {
        const res = await api.events.getActive();
        setActiveEvent((res as ActiveEventResponse).event ?? null);
      } catch (e) {
        setEventError(e instanceof Error ? e.message : 'Fehler beim Laden des Eltern- und Ausbildersprechtags');
        setActiveEvent(null);
      } finally {
        setEventLoading(false);
      }
    };

    const loadTeachers = async () => {
      try {
        const fetchedTeachers = await api.getTeachers();
        setTeachers(fetchedTeachers);
      } catch (err) {
        setTeachersError(err instanceof Error ? err.message : 'Fehler beim Laden der Lehrkräfte');
      } finally {
        setTeachersLoading(false);
      }
    };

    loadActiveEvent();
    loadTeachers();
  }, []);

  const handleTeacherSelect = (teacherId: number) => {
    setSelectedTeacherId(teacherId);
    resetSelection();
  };

  const handleClearTeacher = () => {
    setSelectedTeacherId(null);
    resetSelection();
  };

  return (
    <div
      className="booking-app page-bg-overlay"
      style={bookingBgStyle}
    >
      {bookingNoticeOpen && (
        <div className="booking-notice-overlay" role="dialog" aria-modal="true" aria-label="Hinweis zur E-Mail-Bestätigung">
          <div className="booking-notice">
            <h3>{tb.modal_title}</h3>
            {tb.modal_text.split('\n\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
            <button type="button" className="btn btn-primary" onClick={resetSelection}>
              {tb.modal_button}
            </button>
          </div>
        </div>
      )}

      <section className="welcomeWindow" aria-label="Willkommen">
        <div className="welcomeWindow__inner">
          <div className="welcomeWindow__grid">
            <div className="welcomeWindow__main">
              <div className="welcomeWindow__headlineRow">
                <h1 className="welcomeWindow__title">{tb.booking_title}</h1>
              </div>

              {tb.booking_text.split('\n\n').map((paragraph, i) => (
                <p key={i} className="welcomeWindow__text">{paragraph}</p>
              ))}

              {(eventLoading || eventError || !activeEvent) && (
                <div className={`welcomeWindow__notice${eventError ? ' is-error' : ''}`} role="status">
                  {eventLoading ? 'Lade Eltern- und Ausbildersprechtag\u2026' : eventError ? eventError : tb.booking_closed_text}
                </div>
              )}
            </div>

            <aside className="welcomeWindow__side" aria-label="Kurzanleitung">
              <h2 className="welcomeWindow__sideTitle">{tb.booking_steps_title}</h2>
              <ol className="welcomeWindow__steps">
                <li>{tb.booking_step_1}</li>
                <li>{tb.booking_step_2}</li>
                <li>{tb.booking_step_3}</li>
              </ol>
              <p className="welcomeWindow__sideHint">{tb.booking_hint}</p>
            </aside>

            <div className="welcomeWindow__eventLine" aria-label="Termin">
              {formattedEventBanner ? formattedEventBanner : tb.event_banner_fallback}
            </div>
          </div>
        </div>
      </section>

      <div className="app-content">
        <aside className="sidebar">
          {teachersLoading && <p className="loading-message">Lade Lehrkräfte...</p>}
          {teachersError && <p className="error-message">{teachersError}</p>}
          {!teachersLoading && !teachersError && (
            <TeacherCombobox
              teachers={teachers}
              selectedTeacherId={selectedTeacherId}
              onSelectTeacher={handleTeacherSelect}
              onClearSelection={handleClearTeacher}
            />
          )}
        </aside>

        <main className="main-content">
          {slotsLoading && <p className="loading-message">Lade Termine...</p>}
          {slotsError && <p className="error-message">{slotsError}</p>}
          {!slotsLoading && !slotsError && (
            <div ref={slotListRef}>
              <SlotList
                slots={slots}
                selectedSlotId={selectedSlotId}
                selectedTeacherId={selectedTeacherId}
                selectedTeacherName={selectedTeacherAccusativeName}
                eventId={activeEvent?.id ?? null}
                onSelectSlot={handleSelectSlot}
              />
            </div>
          )}

          <div ref={bookingFormRef}>
            <BookingForm
              key={selectedTeacherId ?? 'no-teacher'}
              selectedSlotId={selectedSlotId}
              onSubmit={handleBooking}
              onCancel={resetSelection}
              message={message}
            />
          </div>
        </main>
      </div>
    </div>
  );
};
