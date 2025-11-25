import './LegalPage.css';

export const Impressum = () => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Impressum</h1>
        
        <section>
          <h2>Angaben gemäß § 5 TMG</h2>
          <p>
            <strong>Berufskolleg kaufmännische Schulen Bergisch Gladbach</strong><br />
            [Straße und Hausnummer]<br />
            [PLZ] [Ort]
          </p>
        </section>

        <section>
          <h2>Kontakt</h2>
          <p>
            Telefon: [Telefonnummer]<br />
            E-Mail: [E-Mail-Adresse]<br />
            Website: [Website-URL]
          </p>
        </section>

        <section>
          <h2>Vertretungsberechtigt</h2>
          <p>
            Schulleitung: [Name]<br />
            Stellvertretung: [Name]
          </p>
        </section>

        <section>
          <h2>Aufsichtsbehörde</h2>
          <p>
            [Zuständige Schulbehörde]<br />
            [Adresse]<br />
            [PLZ] [Ort]
          </p>
        </section>

        <section>
          <h2>Haftungsausschluss</h2>
          
          <h3>Haftung für Inhalte</h3>
          <p>
            Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, 
            Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
          </p>

          <h3>Haftung für Links</h3>
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen 
            Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter 
            oder Betreiber der Seiten verantwortlich.
          </p>

          <h3>Urheberrecht</h3>
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen 
            dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art 
            der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen 
            Zustimmung des jeweiligen Autors bzw. Erstellers.
          </p>
        </section>

        <a href="/" className="back-link">← Zurück zur Startseite</a>
      </div>
    </div>
  );
};
