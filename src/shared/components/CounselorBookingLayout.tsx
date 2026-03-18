import type { ReactNode } from 'react';
import { useBgStyle } from '../../hooks/useBgStyle';
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
  const cbBgStyle = useBgStyle(moduleId, '--page-bg');

  return (
    <div
      className="cb-layout page-bg-overlay"
      style={cbBgStyle}
    >
      <div className="cb-layout__inner">
        {children}
      </div>
    </div>
  );
}
