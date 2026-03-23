/**
 * EduViteLogo – Inline-Logo-Komponente für Fließtexte.
 *
 * Rendert "edu" in Textfarbe und "Vite" in Markenblau.
 * Das "V" wird initial als animierter Checkmark gezeichnet
 * und fadet dann zum Buchstaben "V".
 *
 * Props:
 *  - size: CSS font-size (default: '1em' = erbt vom Elternelement)
 */

import './EduViteLogo.css';

interface EduViteLogoProps {
  size?: string;
}

export function EduViteLogo({ size = '1em' }: EduViteLogoProps) {
  return (
    <span className="ev-logo" style={{ fontSize: size }} aria-label="eduVite">
      <span className="ev-logo__edu">edu</span>
      <span className="ev-logo__vite">
        <span className="ev-logo__v-wrap">
          <svg
            className="ev-logo__check-svg"
            viewBox="0 0 42 72"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              className="ev-logo__check-path"
              d="M 3 26 L 20 56 L 39 10"
            />
          </svg>
          <span className="ev-logo__v-letter">V</span>
        </span>
        <span className="ev-logo__rest">ite</span>
      </span>
    </span>
  );
}
