import { useState, useCallback, useEffect } from 'react';
import type { TimeSlot, BookingFormData } from '../../../types';
import api from '../../../services/api';
import { getTimeWindowsForTeacher, formatDateDE } from '../../../utils/timeWindows';

type CreateBookingRequestResponse = {
  success?: boolean;
  message?: string;
};

export const useBooking = (
  selectedTeacherId: number | null,
  eventId?: number | null,
  eventStartsAt?: string | null,
  selectedTeacherAvailableFrom?: string,
  selectedTeacherAvailableUntil?: string,
) => {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');
  const [bookingNoticeOpen, setBookingNoticeOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Build fixed time windows when teacher is selected and event is active
  useEffect(() => {
    if (!selectedTeacherId || eventId === null) {
      setSlots([]);
      setSelectedSlotId(null);
      return;
    }
    setLoading(false);
    setError('');

    const date = formatDateDE(eventStartsAt);
    const times = getTimeWindowsForTeacher(selectedTeacherAvailableFrom, selectedTeacherAvailableUntil);
    const fixedSlots: TimeSlot[] = times.map((time, idx) => ({
      id: idx + 1,
      teacherId: selectedTeacherId,
      time,
      date,
      booked: false,
    }));
    setSlots(fixedSlots);
  }, [selectedTeacherId, eventId, eventStartsAt, selectedTeacherAvailableFrom, selectedTeacherAvailableUntil]);

  const handleSelectSlot = useCallback((slotId: number) => {
    setSelectedSlotId(slotId);
    setMessage('');
    setBookingNoticeOpen(false);
  }, []);

  const handleBooking = useCallback(async (formData: BookingFormData) => {
    if (!selectedSlotId) {
      setMessage('Bitte wählen Sie einen Zeitslot aus.');
      return;
    }

    if (!selectedTeacherId) {
      setMessage('Bitte wählen Sie zuerst eine Lehrkraft aus.');
      return;
    }

    if (eventId === null) {
      setMessage('Buchungen sind aktuell nicht freigeschaltet.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const selectedSlot = slots.find((s) => s.id === selectedSlotId);
      const requestedTime = selectedSlot?.time;
      if (!requestedTime) {
        setMessage('Bitte wählen Sie einen Zeitslot aus.');
        return;
      }

      const response = (await api.createBookingRequest(
        selectedTeacherId,
        requestedTime,
        formData
      )) as CreateBookingRequestResponse | null;

      if (response?.success) {
        setMessage('Danke für Ihre Buchungsanfrage!');
        setBookingNoticeOpen(true);
        setSelectedSlotId(null);
      } else {
        setMessage(response?.message || 'Buchung fehlgeschlagen');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Fehler beim Buchen';
      setMessage(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [selectedSlotId, selectedTeacherId, eventId, slots]);

  const resetSelection = useCallback(() => {
    setSelectedSlotId(null);
    setMessage('');
    setBookingNoticeOpen(false);
  }, []);

  return {
    slots,
    selectedSlotId,
    message,
    bookingNoticeOpen,
    loading,
    error,
    handleSelectSlot,
    handleBooking,
    resetSelection,
  };
};
