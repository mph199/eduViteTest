import './Footer.css';

export const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-links">
          <a href="/impressum">Impressum</a>
          <span className="separator">|</span>
          <a href="/datenschutz">Datenschutz</a>
          <span className="separator">|</span>
          <a href="/kontakt">Kontakt</a>
        </div>
        <div className="footer-copyright">
          © {new Date().getFullYear()} Berufskolleg kaufmännische Schulen Bergisch Gladbach
        </div>
      </div>
    </footer>
  );
};
