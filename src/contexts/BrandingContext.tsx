/**
 * BrandingProvider – Loads site_branding from the API on mount and
 * applies the values as CSS custom properties on :root.
 *
 * Exposes the branding object via React context so that components
 * (e.g. GlobalTopHeader, LandingPage) can read school name, texts etc.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import api from '../services/api';
import type { SiteBranding } from '../types';

export type { SiteBranding };

const DEFAULTS: SiteBranding = {
  school_name: 'BKSB',
  logo_url: '',
  primary_color: '#123C73',
  primary_dark: '#0B2545',
  primary_darker: '#081D38',
  secondary_color: '#5B8DEF',
  ink_color: '#0B2545',
  surface_1: '#F8FAFC',
  surface_2: '#D9E4F2',
  header_font_color: '',
  hero_title: 'Herzlich willkommen!',
  hero_text: 'Über dieses Portal können Sie Gesprächstermine für den Eltern- und Ausbildersprechtag anfragen.',
  step_1: 'Lehrkraft auswählen',
  step_2: 'Wunsch-Zeitfenster wählen',
  step_3: 'Daten eingeben und Anfrage absenden',
  tile_images: {},
  background_images: {},
};

/** Parse JSON image-map fields that may arrive as strings from the API. */
export function parseImageMaps(branding: SiteBranding): void {
  if (typeof branding.tile_images === 'string') {
    try { branding.tile_images = JSON.parse(branding.tile_images); } catch { branding.tile_images = {}; }
  }
  if (typeof branding.background_images === 'string') {
    try { branding.background_images = JSON.parse(branding.background_images); } catch { branding.background_images = {}; }
  }
}

/** Convert hex "#rrggbb" → "r, g, b" for rgba() usage */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return '';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/** Compute relative luminance (WCAG 2.1) from hex color */
function hexLuminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length < 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function applyToRoot(b: SiteBranding) {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', b.primary_color);
  root.style.setProperty('--brand-primary-dark', b.primary_dark);
  root.style.setProperty('--brand-primary-darker', b.primary_darker);
  root.style.setProperty('--brand-secondary', b.secondary_color);
  root.style.setProperty('--brand-ink', b.ink_color);
  root.style.setProperty('--brand-surface-1', b.surface_1);
  root.style.setProperty('--brand-surface-2', b.surface_2);

  // RGB helpers
  root.style.setProperty('--brand-primary-rgb', hexToRgb(b.primary_color));
  root.style.setProperty('--brand-primary-dark-rgb', hexToRgb(b.primary_dark));
  root.style.setProperty('--brand-primary-darker-rgb', hexToRgb(b.primary_darker));
  root.style.setProperty('--brand-ink-rgb', hexToRgb(b.ink_color));

  // Login colors derive from ink
  root.style.setProperty('--brand-login', b.ink_color);

  // Button text contrast: auto-switch based on primary color luminance
  const lum = hexLuminance(b.primary_color);
  root.style.setProperty('--brand-button-text', lum > 0.35 ? '#1a1a1a' : '#ffffff');
}

interface BrandingContextValue {
  branding: SiteBranding;
  reload: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULTS,
  reload: async () => {},
});

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<SiteBranding>(DEFAULTS);

  const load = useCallback(async () => {
    try {
      const data = await api.superadmin.getSiteBranding();
      if (data) {
        const merged: SiteBranding = { ...DEFAULTS };
        for (const key of Object.keys(DEFAULTS) as (keyof SiteBranding)[]) {
          if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (merged as any)[key] = data[key];
          }
        }
        parseImageMaps(merged);
        setBranding(merged);
        applyToRoot(merged);
      }
    } catch {
      // keep defaults — CSS variables from index.css remain active
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <BrandingContext.Provider value={{ branding, reload: load }}>
      {children}
    </BrandingContext.Provider>
  );
}
