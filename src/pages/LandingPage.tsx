import { Link } from 'react-router-dom';
import './LandingPage.css';

const modules = [
  {
    id: 'elternsprechtag',
    title: 'Eltern- und Ausbildersprechtag',
    description: 'Buchen Sie einen Gesprächstermin mit einer Lehrkraft.',
    icon: '🗓️',
    path: '/elternsprechtag',
  },
  // Weitere Module können hier ergänzt werden, z.B.:
  // { id: 'schulsozialarbeit', title: 'Schulsozialarbeit', description: '...', icon: '🤝', path: '/schulsozialarbeit' },
];

export function LandingPage() {
  return (
    <div className="landing">
      <div className="landing__inner">
        <h1 className="landing__title">Willkommen beim Buchungssystem</h1>
        <p className="landing__subtitle">Wählen Sie ein Thema, um einen Termin zu buchen.</p>

        <div className="landing__grid">
          {modules.map((mod) => (
            <Link key={mod.id} to={mod.path} className="landing__card">
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
