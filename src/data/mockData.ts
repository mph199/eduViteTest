import type { Teacher, TimeSlot } from '../types';

export const TEACHERS: Teacher[] = [
  { id: 1, name: 'Frau Müller', subject: 'Mathematik' },
  { id: 2, name: 'Herr Schmidt', subject: 'Deutsch' },
  { id: 3, name: 'Frau Weber', subject: 'Englisch' },
  { id: 4, name: 'Herr Fischer', subject: 'Biologie' },
  { id: 5, name: 'Frau Huhn', subject: 'Dermatologie' },
];

// INITIAL_SLOTS nicht mehr benötigt - Daten kommen vom Backend
export const INITIAL_SLOTS: TimeSlot[] = [];
