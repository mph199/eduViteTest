import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Sidebar.css';

type SidebarSide = 'left' | 'right';

type SidebarRenderCtx = {
  close: () => void;
};

type SidebarProps = {
  label: string;
  ariaLabel?: string;
  side?: SidebarSide;
  variant?: 'text' | 'icon';
  buttonClassName?: string;
  noWrapper?: boolean;
  icon?: ReactNode;
  footer?: ReactNode;
  children: (ctx: SidebarRenderCtx) => ReactNode;
};

const ANIMATION_MS = 220;

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const nodes = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(nodes).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
}

export function Sidebar({
  label,
  ariaLabel,
  side = 'left',
  variant = 'text',
  buttonClassName,
  noWrapper = false,
  icon,
  footer,
  children,
}: SidebarProps) {
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [active, setActive] = useState(false);
  const [closeTimerId, setCloseTimerId] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  const buttonId = useId();
  const panelId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setActive(false);
    if (closeTimerId) window.clearTimeout(closeTimerId);
    const t = window.setTimeout(() => setRendered(false), ANIMATION_MS);
    setCloseTimerId(t);
  }, [closeTimerId]);

  const openSidebar = () => {
    lastActiveElementRef.current = document.activeElement as HTMLElement | null;
    if (closeTimerId) window.clearTimeout(closeTimerId);
    if (closeTimerId) setCloseTimerId(null);
    setRendered(true);
    setOpen(true);
    window.requestAnimationFrame(() => setActive(true));
  };

  useEffect(() => {
    return () => {
      if (closeTimerId) window.clearTimeout(closeTimerId);
    };
  }, [closeTimerId]);

  useEffect(() => {
    if (!rendered) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (!active) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = getFocusable(panelRef.current);
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!current || current === first || !panelRef.current?.contains(current)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!current || current === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [active, close, rendered]);

  useEffect(() => {
    if (!active) return;

    // Give the panel one frame to mount, then move focus.
    const raf = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [active]);

  useEffect(() => {
    if (rendered) return;
    // Restore focus when the sidebar is fully unmounted.
    try {
      lastActiveElementRef.current?.focus();
    } catch {
      // ignore
    }
  }, [rendered]);

  const resolvedButtonClassName = useMemo(() => {
    if (buttonClassName) return buttonClassName;
    return variant === 'icon' ? 'sidebar__iconButton' : 'dropdown__button';
  }, [buttonClassName, variant]);

  const resolvedAriaLabel = ariaLabel ?? label;

  const overlayClassName = useMemo(() => {
    const base = 'sidebar__overlay';
    const sideClass = side === 'right' ? 'sidebar__overlay--right' : 'sidebar__overlay--left';
    return active ? `${base} ${sideClass} sidebar__overlay--open` : `${base} ${sideClass}`;
  }, [active, side]);

  const panelClassName = useMemo(() => {
    const base = 'sidebar__panel';
    const sideClass = side === 'right' ? 'sidebar__panel--right' : 'sidebar__panel--left';
    return active ? `${base} ${sideClass} sidebar__panel--open` : `${base} ${sideClass}`;
  }, [active, side]);

  const hamburgerIcon = (
    <svg viewBox="0 0 20 20" width="22" height="22" focusable="false" aria-hidden="true">
      <path
        d="M3 5h14M3 10h14M3 15h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  const closeIcon = (
    <svg viewBox="0 0 20 20" width="20" height="20" focusable="false" aria-hidden="true">
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  const buttonProps: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'ref'> = {
    id: buttonId,
    type: 'button',
    className: resolvedButtonClassName,
    'aria-label': variant === 'icon' ? resolvedAriaLabel : undefined,
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': panelId,
    onClick: () => (open ? close() : openSidebar()),
  };

  const resolvedIcon = icon ?? hamburgerIcon;
  const triggerNode = (
    <button {...buttonProps}>
      {variant === 'icon' ? resolvedIcon : label}
    </button>
  );

  const portalNode =
    rendered &&
    createPortal(
      <div className={overlayClassName} role="presentation" onPointerDown={() => close()}>
        <aside
          id={panelId}
          className={panelClassName}
          role="dialog"
          aria-modal="true"
          aria-labelledby={buttonId}
          ref={(node) => {
            panelRef.current = node;
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="sidebar__header">
            <div className="sidebar__title">{label}</div>
            <button
              ref={closeButtonRef}
              type="button"
              className="sidebar__close"
              onClick={() => close()}
              aria-label="Schließen"
            >
              {closeIcon}
            </button>
          </div>
          <div className="sidebar__content">{children({ close })}</div>
          {footer ? <div className="sidebar__footer">{footer}</div> : null}
        </aside>
      </div>,
      document.body
    );

  if (noWrapper) {
    return (
      <>
        {triggerNode}
        {portalNode}
      </>
    );
  }

  return (
    <div className="sidebar" ref={rootRef}>
      {triggerNode}
      {portalNode}
    </div>
  );
}
