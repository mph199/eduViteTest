/**
 * PopoverMenu — Portal-basiertes Kontextmenü.
 *
 * Rendert das Menü via createPortal in document.body, um overflow-Clipping
 * durch Elterncontainer zu vermeiden. Positioniert sich per position:fixed
 * relativ zum Trigger-Button und flippt nach oben wenn am Viewport-Rand.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface PopoverMenuProps {
  /** Ref to the trigger button for positioning */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** Called when menu should close (click outside, scroll, Escape) */
  onClose: () => void;
  children: ReactNode;
}

export function PopoverMenu({ triggerRef, onClose, children }: PopoverMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ position: 'fixed', opacity: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const viewportHeight = window.innerHeight;

    // Flip upward if menu would overflow viewport bottom
    const spaceBelow = viewportHeight - rect.bottom;
    const openUpward = spaceBelow < menuHeight + 8 && rect.top > menuHeight + 8;

    setStyle({
      position: 'fixed',
      right: window.innerWidth - rect.right,
      ...(openUpward
        ? { bottom: viewportHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      opacity: 1,
    });
  }, [triggerRef]);

  useEffect(() => {
    updatePosition();
  }, [updatePosition]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, triggerRef]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on scroll of any ancestor
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [onClose]);

  return createPortal(
    <div
      className="um-context-menu um-context-menu--portal"
      ref={menuRef}
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
}
