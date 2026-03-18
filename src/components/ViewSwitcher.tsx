import type { ActiveView } from '../contexts/AuthContextBase';
import './ViewSwitcher.css';

interface ViewSwitcherOption {
  value: ActiveView;
  label: string;
}

interface ViewSwitcherProps {
  options: ViewSwitcherOption[];
  activeValue: ActiveView;
  onChange: (value: ActiveView) => void;
}

export function ViewSwitcher({ options, activeValue, onChange }: ViewSwitcherProps) {
  return (
    <div className="viewSwitcher" aria-label="Ansicht wechseln">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={opt.value === activeValue}
          className={
            opt.value === activeValue
              ? 'viewSwitcher__option viewSwitcher__option--active'
              : 'viewSwitcher__option'
          }
          onClick={() => {
            if (opt.value !== activeValue) onChange(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
