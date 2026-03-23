import { useState, useEffect } from 'react';
import type { BrandingData } from '../types';
import api from '../services/api';
import './LegalPage.css';

export const Datenschutz = () => {
  const [b, setB] = useState<BrandingData>({});

  useEffect(() => {
    api.superadmin.getSiteBranding()
      .then(data => setB(data || {}))
      .catch(() => {});
  }, []);

  const isValidEmail = (v?: string) => !!v && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Datenschutzerklärung</h1>

        <section>
          <h2>1. Datenschutz auf einen Blick</h2>

          <h3>Allgemeine Hinweise</h3>
          <p>
            Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren
            personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene
            Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
          </p>

          <h3>Datenerfassung auf dieser Website</h3>
          <p>
            <strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong><br />
            Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber.
            {b.responsible_name && <> Verantwortlich: {b.responsible_name}.</>}
          </p>
        </section>

        <section>
          <h2>2. Hosting</h2>
          <p>
            Diese Website wird auf eigenen Servern (Self-Hosting via Docker) betrieben.
            Dabei werden technisch notwendige Daten wie IP-Adresse, Browserinformationen,
            Betriebssystem und Zugriffszeitpunkt in Server-Logfiles erfasst.
          </p>
        </section>

        <section>
          <h2>3. Verantwortliche Stelle und Datenschutzbeauftragter</h2>

          <h3>Verantwortliche Stelle</h3>
          <p>
            {b.responsible_name || '[Name der Schule / des Schulträgers]'}<br />
            {b.responsible_address || '[Adresse]'}<br />
            {b.responsible_phone && <>Telefon: {b.responsible_phone}<br /></>}
            {b.responsible_email && <>E-Mail: {b.responsible_email}</>}
          </p>

          {(b.dsb_name || b.dsb_email) && (
            <>
              <h3>Datenschutzbeauftragter</h3>
              <p>
                {b.dsb_name && <>{b.dsb_name}<br /></>}
                {isValidEmail(b.dsb_email) && <>E-Mail: <a href={`mailto:${b.dsb_email}`}>{b.dsb_email}</a></>}
              </p>
            </>
          )}

          {b.supervisory_authority && (
            <>
              <h3>Aufsichtsbehörde</h3>
              <p>{b.supervisory_authority}</p>
            </>
          )}
        </section>

        <section>
          <h2>4. Datenerfassung bei Buchungsvorgängen</h2>

          <h3>4.1 Elternsprechtag</h3>
          <p>Bei der Buchung eines Eltern- und Ausbildersprechtags erheben wir:</p>
          <ul>
            <li>Name der erziehungsberechtigten Person oder des Firmenvertreters</li>
            <li>Name des/der Schülers/Schülerin oder Auszubildenden</li>
            <li>Klasse</li>
            <li>E-Mail-Adresse</li>
            <li>Gewählter Termin und Lehrkraft</li>
            <li>Optionale Nachricht</li>
          </ul>
          <p>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung – Schulverhältnis).
          </p>
          <p>
            <strong>Speicherdauer:</strong> Automatische Anonymisierung nach Event-Abschluss
            (konfigurierbar, Standard: 180 Tage). Stornierte Buchungen: 30 Tage.
          </p>

          <h3>4.2 Schulsozialarbeit (SSW)</h3>
          <p>Bei der Buchung eines Beratungstermins erheben wir:</p>
          <ul>
            <li>Name</li>
            <li>Klasse</li>
            <li>E-Mail-Adresse, Telefonnummer</li>
            <li>Beratungskategorie, Dringlichkeit</li>
          </ul>
          <p>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
            Die Einwilligung kann jederzeit widerrufen werden.
          </p>
          <p>
            <strong>Speicherdauer:</strong> Automatische Anonymisierung nach konfigurierter
            Frist (Standard: 365 Tage). Bei Widerruf: sofortige Anonymisierung.
          </p>

          <h3>4.3 Beratungslehrer (BL)</h3>
          <p>Identisch zu Schulsozialarbeit (siehe 4.2).</p>
        </section>

        <section>
          <h2>5. Einwilligung und Widerruf</h2>
          <p>
            Für die Buchung von Beratungsterminen (SSW/BL) ist Ihre ausdrückliche Einwilligung
            erforderlich. Diese erteilen Sie durch Aktivieren der Einwilligungs-Checkbox im
            Buchungsformular.
          </p>
          <p>
            Die Einwilligung wird mit Version, Zeitstempel, IP-Adresse und Zweck nachweisbar
            gespeichert (Art. 7 Abs. 1 DSGVO).
          </p>
          <p>
            <strong>Widerruf:</strong> Sie können Ihre Einwilligung jederzeit mit Wirkung für
            die Zukunft widerrufen. Bei einem Widerruf werden Ihre Buchungsdaten anonymisiert.
            Der Nachweis der erteilten Einwilligung bleibt erhalten.
          </p>
        </section>

        <section>
          <h2>6. Ihre Rechte</h2>
          <p>Sie haben folgende Rechte:</p>
          <ul>
            <li>Recht auf Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO)</li>
            <li>Recht auf Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
            <li>Recht auf Löschung (Art. 17 DSGVO)</li>
            <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruchsrecht (Art. 21 DSGVO)</li>
            <li>Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
          </ul>
          {b.dsb_email && (
            <p>
              Zur Ausübung Ihrer Rechte wenden Sie sich bitte an den Datenschutzbeauftragten: {' '}
              {isValidEmail(b.dsb_email) && <a href={`mailto:${b.dsb_email}`}>{b.dsb_email}</a>}
            </p>
          )}
        </section>

        <section>
          <h2>7. Cookies</h2>
          <p>
            Diese Website verwendet ausschließlich technisch notwendige Session-Cookies
            (httpOnly JWT) für den Verwaltungsbereich. Diese Cookies sind für den Betrieb
            der Anwendung erforderlich und werden nach Beendigung Ihrer Sitzung gelöscht.
          </p>
          <p>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der
            Funktionsfähigkeit der Website).
          </p>
        </section>

        <section>
          <h2>8. Server-Log-Dateien</h2>
          <p>
            Der Server erhebt und speichert automatisch Informationen in Server-Log-Dateien:
          </p>
          <ul>
            <li>Browsertyp und Browserversion</li>
            <li>Verwendetes Betriebssystem</li>
            <li>Referrer URL</li>
            <li>Hostname des zugreifenden Rechners</li>
            <li>Uhrzeit der Serveranfrage</li>
            <li>IP-Adresse</li>
          </ul>
          <p>
            Diese Daten werden nicht mit anderen Datenquellen zusammengeführt und dienen
            ausschließlich dem Betrieb und der Sicherheit der Anwendung.
          </p>
        </section>

        <a href="/" className="back-link">Zurück zur Startseite</a>
      </div>
    </div>
  );
};
