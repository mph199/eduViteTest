import type { ActiveView } from '../contexts/AuthContextBase';

type ViewModeToggleProps = {
  value: ActiveView;
  onChange: (next: ActiveView) => void;
};

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="view-toggle" role="group" aria-label="Ansicht umschalten">
      <button
        type="button"
        className={value === 'teacher' ? 'view-toggle__btn view-toggle__btn--active' : 'view-toggle__btn'}
        onClick={() => onChange('teacher')}
        aria-pressed={value === 'teacher'}
        title="Lehrkraft-Ansicht"
      >
        Lehrkraft
      </button>
      <button
        type="button"
        className={value === 'admin' ? 'view-toggle__btn view-toggle__btn--active' : 'view-toggle__btn'}
        onClick={() => onChange('admin')}
        aria-pressed={value === 'admin'}
        title="Admin-Ansicht"
      >
        Admin
      </button>
    </div>
  );
}
