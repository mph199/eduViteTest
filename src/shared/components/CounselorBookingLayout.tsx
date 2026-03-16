import type { CSSProperties, ReactNode } from 'react';
import { useBranding } from '../../contexts/BrandingContext';
import api from '../../services/api';
import './CounselorBookingLayout.css';

interface Props {
  moduleId: string;
  children: ReactNode;
}

/**
 * Wrapper layout for counselor booking pages (SSW, BL).
 * Reads the module-specific background image from BrandingContext
 * and renders the same container style as the Elternsprechtag booking-app.
 */
export function CounselorBookingLayout({ moduleId, children }: Props) {
  const { branding } = useBranding();
  const bgUrl = branding.background_images?.[moduleId];

  return (
    <div
      className="cb-layout"
      style={bgUrl ? { '--cb-bg': `url(${api.superadmin.resolveBgUrl(bgUrl)})` } as CSSProperties : undefined}
    >
      <div className="cb-layout__inner">
        {children}
      </div>
    </div>
  );
}
