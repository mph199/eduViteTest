import type { TextBranding } from '../../contexts/TextBrandingContext';

interface Props {
  text: TextBranding;
  setTextField: <K extends keyof TextBranding>(key: K, value: TextBranding[K]) => void;
  textMsg: string;
  textSaving: boolean;
  onSave: () => void;
  onReset: () => void;
}

export function TextBrandingTab({ text, setTextField, textMsg, textSaving, onSave, onReset }: Props) {
  return (
    <>
      {/* 1. Welcome-Bereich */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Willkommen-Bereich</h2>
        <div className="superadmin__grid">
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Titel</span>
            <input type="text" className="superadmin__input" value={text.booking_title} onChange={(e) => setTextField('booking_title', e.target.value)} placeholder="Herzlich willkommen!" />
          </div>
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Beschreibungstext (Absatztrennung mit Leerzeile)</span>
            <textarea className="superadmin__textarea" value={text.booking_text} onChange={(e) => setTextField('booking_text', e.target.value)} rows={5} />
          </div>
        </div>
      </section>

      {/* 2. Drei-Schritte-Anleitung */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Kurzanleitung (Sidebar)</h2>
        <div className="superadmin__grid">
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Titel</span>
            <input type="text" className="superadmin__input" value={text.booking_steps_title} onChange={(e) => setTextField('booking_steps_title', e.target.value)} placeholder="In drei Schritten zum Termin:" />
          </div>
          <div className="superadmin__field">
            <span className="superadmin__label">Schritt 1</span>
            <input type="text" className="superadmin__input" value={text.booking_step_1} onChange={(e) => setTextField('booking_step_1', e.target.value)} />
          </div>
          <div className="superadmin__field">
            <span className="superadmin__label">Schritt 2</span>
            <input type="text" className="superadmin__input" value={text.booking_step_2} onChange={(e) => setTextField('booking_step_2', e.target.value)} />
          </div>
          <div className="superadmin__field">
            <span className="superadmin__label">Schritt 3</span>
            <input type="text" className="superadmin__input" value={text.booking_step_3} onChange={(e) => setTextField('booking_step_3', e.target.value)} />
          </div>
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Hinweistext unter den Schritten</span>
            <textarea className="superadmin__textarea" value={text.booking_hint} onChange={(e) => setTextField('booking_hint', e.target.value)} rows={2} />
          </div>
        </div>
      </section>

      {/* 3. Event-Banner */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Event-Banner</h2>
        <div className="superadmin__grid">
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">
              Banner-Text (Platzhalter: {'{weekday}'}, {'{date}'}, {'{startTime}'}, {'{endTime}'})
            </span>
            <textarea className="superadmin__textarea" value={text.event_banner_template} onChange={(e) => setTextField('event_banner_template', e.target.value)} rows={2} />
          </div>
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Fallback-Text (wenn kein Event aktiv)</span>
            <input type="text" className="superadmin__input" value={text.event_banner_fallback} onChange={(e) => setTextField('event_banner_fallback', e.target.value)} />
          </div>
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Hinweis bei deaktivierten Buchungen</span>
            <input type="text" className="superadmin__input" value={text.booking_closed_text} onChange={(e) => setTextField('booking_closed_text', e.target.value)} />
          </div>
        </div>
      </section>

      {/* 4. Erfolgs-Modal */}
      <section className="superadmin__section">
        <h2 className="superadmin__section-title">Erfolgs-Dialog (nach Buchungsanfrage)</h2>
        <div className="superadmin__grid">
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Titel</span>
            <input type="text" className="superadmin__input" value={text.modal_title} onChange={(e) => setTextField('modal_title', e.target.value)} placeholder="Fast fertig!" />
          </div>
          <div className="superadmin__field superadmin__field--wide">
            <span className="superadmin__label">Nachricht (Absatztrennung mit Leerzeile)</span>
            <textarea className="superadmin__textarea" value={text.modal_text} onChange={(e) => setTextField('modal_text', e.target.value)} rows={5} />
          </div>
          <div className="superadmin__field">
            <span className="superadmin__label">Button-Text</span>
            <input type="text" className="superadmin__input" value={text.modal_button} onChange={(e) => setTextField('modal_button', e.target.value)} placeholder="Verstanden" />
          </div>
        </div>
      </section>

      {/* Status + Save */}
      {textMsg && (
        <div className={`superadmin__hint ${textMsg.startsWith('Fehler') ? 'superadmin__hint--error' : ''}`}>
          <span>{textMsg}</span>
        </div>
      )}
      <div className="superadmin__actions">
        <button type="button" className="superadmin__btn superadmin__btn--secondary" onClick={onReset}>Zurücksetzen</button>
        <button type="button" className="superadmin__btn superadmin__btn--primary" onClick={onSave} disabled={textSaving}>
          {textSaving ? 'Speichern\u2026' : 'Änderungen speichern'}
        </button>
      </div>
    </>
  );
}
