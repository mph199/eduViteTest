import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type DropdownAlign = 'left' | 'right';

type DropdownRenderCtx = {
  close: () => void;
};

type DropdownProps = {
  label: string;
  ariaLabel?: string;
  align?: DropdownAlign;
  variant?: 'text' | 'icon';
  buttonClassName?: string;
  children: (ctx: DropdownRenderCtx) => ReactNode;
};

export function Dropdown({
  label,
  ariaLabel,
  align = 'right',
  variant = 'text',
  buttonClassName,
  children,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonId = useId();
  const menuId = useId();

  const close = () => setOpen(false);

  const menuClassName = useMemo(() => {
    const base = 'dropdown__menu';
    return align === 'left' ? base : `${base} dropdown__menu--right`;
  }, [align]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      if (!open) return;
      const root = rootRef.current;
      if (!root) return;
      const target = e.target as Node | null;
      if (target && !root.contains(target)) close();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const resolvedButtonClassName = useMemo(() => {
    if (buttonClassName) return buttonClassName;
    return variant === 'icon' ? 'dropdown__iconButton' : 'dropdown__button';
  }, [buttonClassName, variant]);

  const resolvedAriaLabel = ariaLabel ?? label;

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        id={buttonId}
        type="button"
        className={resolvedButtonClassName}
        aria-label={variant === 'icon' ? resolvedAriaLabel : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {variant === 'icon' ? (
          <span
            className={open ? 'dropdown__triangle dropdown__triangle--open' : 'dropdown__triangle'}
            aria-hidden
          >
            <svg viewBox="0 0 16 16" width="22" height="22" focusable="false" aria-hidden="true">
              <polygon
                points="5,3 12,8 5,13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : (
          <>
            {label}
            <span className="dropdown__caret" aria-hidden>
              ▾
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          className={menuClassName}
          role="menu"
          aria-labelledby={buttonId}
        >
          {children({ close })}
        </div>
      )}
    </div>
  );
}
