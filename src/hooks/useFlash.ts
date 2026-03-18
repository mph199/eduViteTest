import { useState, useCallback, useRef } from 'react';

/**
 * Shows a flash message for `durationMs` milliseconds.
 * Replaces the repeated setFlash + setTimeout pattern.
 * Cleans up timers on re-invocation and unmount.
 */
export function useFlash(durationMs = 3000): [string, (msg: string) => void] {
  const [flash, setFlash] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showFlash = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFlash(msg);
    timerRef.current = setTimeout(() => setFlash(''), durationMs);
  }, [durationMs]);

  return [flash, showFlash];
}
