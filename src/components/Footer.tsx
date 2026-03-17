import './Footer.css';

export const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-links">
          <span className="footer-link-disabled">Impressum</span>
          <span className="separator">|</span>
          <a href="/datenschutz" className="footer-link">Datenschutz</a>
          <span className="separator">|</span>
          <span className="footer-link-disabled">Kontakt</span>
        </div>
        <div className="footer-copyright">
          © {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
};
