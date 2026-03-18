import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import './CollapsibleNavGroup.css';

interface CollapsibleNavGroupProps {
  label: string;
  accentRgb?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleNavGroup({
  label,
  accentRgb,
  defaultOpen = true,
  children,
}: CollapsibleNavGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  // Empty string → no collapse wrapper, render children directly
  if (!label) {
    return (
      <div style={accentRgb ? { '--group-accent-rgb': accentRgb } as React.CSSProperties : undefined}>
        {children}
      </div>
    );
  }

  return (
    <div style={accentRgb ? { '--group-accent-rgb': accentRgb } as React.CSSProperties : undefined}>
      <button
        type="button"
        className="collapsibleNav__header dropdown__sectionTitle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span>{label}</span>
        <span
          className={open ? 'collapsibleNav__chevron' : 'collapsibleNav__chevron collapsibleNav__chevron--collapsed'}
          aria-hidden="true"
        />
      </button>
      <div
        id={bodyId}
        className={open ? 'collapsibleNav__body' : 'collapsibleNav__body collapsibleNav__body--collapsed'}
      >
        <div className="collapsibleNav__bodyInner">
          {children}
        </div>
      </div>
    </div>
  );
}
