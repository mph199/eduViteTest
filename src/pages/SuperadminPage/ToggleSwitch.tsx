/**
 * ToggleSwitch — Barrierefreier Toggle mit role="switch".
 */

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  'aria-label'?: string;
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, 'aria-label': ariaLabel, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`toggle-switch${checked ? ' toggle-switch--on' : ''}${disabled ? ' toggle-switch--disabled' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-switch__thumb" />
    </button>
  );
}
