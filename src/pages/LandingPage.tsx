import { Link } from 'react-router-dom';
import { modules } from '../modules/registry';
import './LandingPage.css';

export function LandingPage() {
  return (
    <div className="landing">
      <div className="landing__inner">
        <h1 className="landing__title">Willkommen beim Buchungssystem</h1>
        <p className="landing__subtitle">Wählen Sie ein Thema, um einen Termin zu buchen.</p>

        <div className="landing__grid">
          {modules.map((mod) => (
            <Link key={mod.id} to={mod.basePath} className="landing__card">
              <span className="landing__card-icon">{mod.icon}</span>
              <h2 className="landing__card-title">{mod.title}</h2>
              <p className="landing__card-desc">{mod.description}</p>
              <span className="landing__card-action">Termin buchen &rarr;</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
