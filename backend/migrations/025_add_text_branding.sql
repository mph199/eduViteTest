-- Migration 025: Text-Branding für Elternsprechtag-Buchungsoberfläche
-- Ermöglicht dem Superadmin, alle Kerntexte der öffentlichen Buchungs-UI anzupassen.

CREATE TABLE IF NOT EXISTS text_branding (
  id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  booking_title   VARCHAR(255) NOT NULL DEFAULT 'Herzlich willkommen!',
  booking_text    TEXT NOT NULL DEFAULT 'Über dieses Portal können Sie Gesprächstermine für den Eltern- und Ausbildersprechtag anfragen.

Wählen Sie die gewünschte Lehrkraft und Ihren bevorzugten Zeitraum aus. Die Lehrkraft wird versuchen, Ihnen einen Termin im gewünschten Zeitfenster zuzuweisen.

Sobald Ihr Termin bestätigt wurde, erhalten Sie eine E-Mail mit allen Details.',
  booking_steps_title VARCHAR(255) NOT NULL DEFAULT 'In drei Schritten zum Termin:',
  booking_step_1  VARCHAR(255) NOT NULL DEFAULT 'Lehrkraft auswählen',
  booking_step_2  VARCHAR(255) NOT NULL DEFAULT 'Wunsch-Zeitfenster wählen',
  booking_step_3  VARCHAR(255) NOT NULL DEFAULT 'Daten eingeben und Anfrage absenden',
  booking_hint    TEXT NOT NULL DEFAULT 'Die Lehrkraft vergibt nach Möglichkeit einen Termin in Ihrem Wunschzeitraum – Sie werden per E-Mail benachrichtigt.',
  event_banner_template TEXT NOT NULL DEFAULT 'Der nächste Eltern- und Ausbildersprechtag findet am {weekday}, den {date} von {startTime} bis {endTime} Uhr statt.',
  event_banner_fallback TEXT NOT NULL DEFAULT 'Der nächste Eltern- und Ausbildersprechtag: Termine folgen.',
  modal_title     VARCHAR(255) NOT NULL DEFAULT 'Fast fertig!',
  modal_text      TEXT NOT NULL DEFAULT 'Vielen Dank für Ihre Terminanfrage!

Bitte bestätigen Sie zunächst Ihre E-Mail-Adresse über den zugesandten Link (ggf. im Spam-Ordner prüfen). Anschließend wird die Lehrkraft Ihnen einen Termin im gewünschten Zeitfenster zuweisen. Sie erhalten eine Bestätigungs-E-Mail mit Datum, Uhrzeit und Raum.',
  modal_button    VARCHAR(100) NOT NULL DEFAULT 'Verstanden',
  booking_closed_text TEXT NOT NULL DEFAULT 'Buchungen sind aktuell noch nicht freigeschaltet.',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO text_branding (id) VALUES (1) ON CONFLICT DO NOTHING;
