import { useState, useCallback, useEffect } from 'react';
import type { TimeSlot, BookingFormData } from '../types';
import api from '../services/api';

export const useBooking = (selectedTeacherId: number | null, eventId?: number | null) => {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');
  const [bookingNoticeOpen, setBookingNoticeOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Lade Slots wenn Lehrkraft ausgewählt wird
  useEffect(() => {
    if (!selectedTeacherId || eventId === null) {
      setSlots([]);
      return;
    }

    const loadSlots = async () => {
      setLoading(true);
      setError('');
      try {
        const fetchedSlots = await api.getSlots(selectedTeacherId, eventId);
        setSlots(fetchedSlots);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Termine');
        setSlots([]);
      } finally {
        setLoading(false);
      }
    };

    loadSlots();
  }, [selectedTeacherId, eventId]);

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

    if (eventId === null) {
      setMessage('Buchungen sind aktuell nicht freigeschaltet.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.createBooking(selectedSlotId, formData);
      
      if (response.success && response.updatedSlot) {
        // Aktualisiere lokalen State
        setSlots((prevSlots) =>
          prevSlots.map((slot) =>
            slot.id === selectedSlotId ? response.updatedSlot! : slot
          )
        );
        setMessage('Danke für Ihre Buchungsanfrage!');
        setBookingNoticeOpen(true);
        setSelectedSlotId(null);
      } else {
        setMessage(response.message || 'Buchung fehlgeschlagen');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Fehler beim Buchen';
      setMessage(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [selectedSlotId, eventId]);

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
