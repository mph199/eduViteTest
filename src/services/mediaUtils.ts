/**
 * Media URL resolution helpers.
 *
 * Resolves upload paths to full URLs, sanitized for safe CSS url() embedding.
 */

import { BACKEND_BASE } from './apiBase';

/**
 * Resolve an image path to a full URL, sanitized for safe CSS url() embedding.
 * Prevents CSS injection by encoding characters that could break out of url().
 * Returns a bare URL string (not wrapped in CSS url()).
 */
export function resolveCssUrl(value: string, uploadPrefix: string): string {
  if (!value) return '';
  let resolved: string;
  if (/^https?:\/\//i.test(value)) {
    resolved = value;
  } else if (value.startsWith('/uploads/') || value.startsWith('/api/')) {
    // Block path traversal (.. or percent-encoded variants)
    if (/\.\.|%2e/i.test(value)) return '';
    resolved = `${BACKEND_BASE}${value}`;
  } else if (/^[\w.\-]+$/.test(value)) {
    // Bare filename (alphanumerics, dots, hyphens, underscores only)
    resolved = `${BACKEND_BASE}${uploadPrefix}${value}`;
  } else {
    // Reject data:, javascript:, ftp:, path traversal, etc.
    return '';
  }
  // Encode chars that can break out of CSS url() context
  return resolved.replace(/[)"'\\(;\s{}]/g, (ch) => encodeURIComponent(ch));
}

/** Resolve a logo path to a full URL for preview (bare URL, not CSS-wrapped) */
export function resolveLogoUrl(logoUrl: string): string {
  if (!logoUrl) return '';
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  if (logoUrl.startsWith('/') && !/\.\.|%2e/i.test(logoUrl)) return `${BACKEND_BASE}${logoUrl}`;
  if (/^[\w.\-]+$/.test(logoUrl)) return `${BACKEND_BASE}/uploads/logos/${logoUrl}`;
  return '';
}

/** Resolve a background image path to a full URL, sanitized for CSS url() */
export function resolveBgUrl(bgUrl: string): string {
  return resolveCssUrl(bgUrl, '/uploads/bg/');
}

/** Resolve a tile image path to a full URL, sanitized for CSS url() */
export function resolveTileUrl(tileUrl: string): string {
  return resolveCssUrl(tileUrl, '/uploads/tiles/');
}
