import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useBranding } from '../contexts/BrandingContext';
import api from '../services/api';

/**
 * Returns an inline style object that sets a CSS custom property
 * to the resolved branding background image URL.
 *
 * Returns `undefined` when no image is configured for the given key,
 * so the `::before` overlay simply has no `background-image`.
 */
export function useBgStyle(
  imageKey: string,
  cssVar: string,
): CSSProperties | undefined {
  const { branding } = useBranding();
  return useMemo(() => {
    const path = branding.background_images?.[imageKey];
    if (!path) return undefined;
    return { [cssVar]: `url(${api.superadmin.resolveBgUrl(path)})` } as CSSProperties;
  }, [branding.background_images, imageKey, cssVar]);
}
