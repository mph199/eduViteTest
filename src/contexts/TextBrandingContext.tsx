/**
 * TextBrandingProvider – Loads text_branding from the API on mount.
 * Provides configurable texts for the Elternsprechtag booking UI.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import api from '../services/api';
import type { TextBranding } from '../types';

export type { TextBranding };

const DEFAULTS: TextBranding = {
  booking_title: 'Herzlich willkommen!',
  booking_text: 'Über dieses Portal können Sie Gesprächstermine für den Eltern- und Ausbildersprechtag anfragen.\n\nWählen Sie die gewünschte Lehrkraft und Ihren bevorzugten Zeitraum aus. Die Lehrkraft wird versuchen, Ihnen einen Termin im gewünschten Zeitfenster zuzuweisen.\n\nSobald Ihr Termin bestätigt wurde, erhalten Sie eine E-Mail mit allen Details.',
  booking_steps_title: 'In drei Schritten zum Termin:',
  booking_step_1: 'Lehrkraft auswählen',
  booking_step_2: 'Wunsch-Zeitfenster wählen',
  booking_step_3: 'Daten eingeben und Anfrage absenden',
  booking_hint: 'Die Lehrkraft vergibt nach Möglichkeit einen Termin in Ihrem Wunschzeitraum – Sie werden per E-Mail benachrichtigt.',
  event_banner_template: 'Der nächste Eltern- und Ausbildersprechtag findet am {weekday}, den {date} von {startTime} bis {endTime} Uhr statt.',
  event_banner_fallback: 'Der nächste Eltern- und Ausbildersprechtag: Termine folgen.',
  modal_title: 'Fast fertig!',
  modal_text: 'Vielen Dank für Ihre Terminanfrage!\n\nBitte bestätigen Sie zunächst Ihre E-Mail-Adresse über den zugesandten Link (ggf. im Spam-Ordner prüfen). Anschließend wird die Lehrkraft Ihnen einen Termin im gewünschten Zeitfenster zuweisen. Sie erhalten eine Bestätigungs-E-Mail mit Datum, Uhrzeit und Raum.',
  modal_button: 'Verstanden',
  booking_closed_text: 'Buchungen sind aktuell noch nicht freigeschaltet.',
};

interface TextBrandingContextValue {
  textBranding: TextBranding;
  reload: () => Promise<void>;
}

const TextBrandingContext = createContext<TextBrandingContextValue>({
  textBranding: DEFAULTS,
  reload: async () => {},
});

export function useTextBranding() {
  return useContext(TextBrandingContext);
}

export function TextBrandingProvider({ children }: { children: ReactNode }) {
  const [textBranding, setTextBranding] = useState<TextBranding>(DEFAULTS);

  const load = useCallback(async () => {
    try {
      const data = await api.superadmin.getTextBranding();
      if (data) {
        const merged: TextBranding = { ...DEFAULTS };
        for (const key of Object.keys(DEFAULTS) as (keyof TextBranding)[]) {
          if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
            merged[key] = data[key];
          }
        }
        setTextBranding(merged);
      }
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <TextBrandingContext.Provider value={{ textBranding, reload: load }}>
      {children}
    </TextBrandingContext.Provider>
  );
}
