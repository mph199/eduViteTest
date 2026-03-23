import './ConsentCheckbox.css';

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  moduleId: 'elternsprechtag' | 'schulsozialarbeit' | 'beratungslehrer';
}

export const CONSENT_VERSIONS: Record<string, string> = {
  elternsprechtag: 'est-v2',
  schulsozialarbeit: 'ssw-v2',
  beratungslehrer: 'bl-v2',
};

const MODULE_TEXTS: Record<string, string> = {
  elternsprechtag:
    'Name, Klasse und E-Mail-Adresse werden zur Terminvergabe verarbeitet und nach Abschluss des Sprechtags gelöscht.',
  schulsozialarbeit:
    'Name, Klasse und Kontaktdaten werden vertraulich verarbeitet und nur der Beratungsperson zugaenglich gemacht.',
  beratungslehrer:
    'Name, Klasse und Kontaktdaten werden vertraulich verarbeitet und nur der Beratungslehrkraft zugaenglich gemacht.',
};

export function ConsentCheckbox({ checked, onChange, moduleId }: ConsentCheckboxProps) {
  return (
    <label className="consent-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
      />
      <span className="consent-checkbox__text">
        {MODULE_TEXTS[moduleId] || MODULE_TEXTS.elternsprechtag}{' '}
        Ich stimme der{' '}
        <a href="/datenschutz" target="_blank" rel="noopener noreferrer">
          Datenschutzerklaerung
        </a>{' '}
        zu.
      </span>
    </label>
  );
}
