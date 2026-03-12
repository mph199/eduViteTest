import { Link } from 'react-router-dom';
import { modules } from '../modules/registry';
import { useBranding } from '../contexts/BrandingContext';
import api from '../services/api';
import './LandingPage.css';

export function LandingPage() {
  const { branding } = useBranding();

  return (
    <div className="landing">
      <div className="landing__inner">
        <h1 className="landing__title">{branding.hero_title}</h1>
        <p className="landing__subtitle">{branding.hero_text}</p>

        {/* Kurzanleitung */}
        <div className="landing__steps">
          <div className="landing__step"><span className="landing__step-num">1</span> {branding.step_1}</div>
          <div className="landing__step"><span className="landing__step-num">2</span> {branding.step_2}</div>
          <div className="landing__step"><span className="landing__step-num">3</span> {branding.step_3}</div>
        </div>

        <div className="landing__grid">
          {modules.map((mod) => {
            const tileUrl = branding.tile_images?.[mod.id];
            return (
              <Link key={mod.id} to={mod.basePath} className="landing__card">
                {tileUrl ? (
                  <img
                    src={api.superadmin.resolveTileUrl(tileUrl)}
                    alt={mod.title}
                    className="landing__card-img"
                    onError={(e) => {
                      // fallback to emoji if image fails
                      const el = e.target as HTMLImageElement;
                      el.style.display = 'none';
                      el.nextElementSibling?.classList.remove('landing__card-icon--hidden');
                    }}
                  />
                ) : null}
                <span className={`landing__card-icon${tileUrl ? ' landing__card-icon--hidden' : ''}`}>{mod.icon}</span>
                <h2 className="landing__card-title">{mod.title}</h2>
                <p className="landing__card-desc">{mod.description}</p>
                <span className="landing__card-action">Termin buchen &rarr;</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
