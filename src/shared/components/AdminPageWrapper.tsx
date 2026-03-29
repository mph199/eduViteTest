import type { CSSProperties, ReactNode } from 'react';

interface AdminPageWrapperProps {
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Shared wrapper for all admin pages.
 * Encapsulates the repeated div stack:
 *   admin-dashboard admin-dashboard--admin page-bg-overlay page-bg-overlay--subtle
 */
export function AdminPageWrapper({ style, children }: AdminPageWrapperProps) {
  return (
    <div
      className="admin-dashboard admin-dashboard--admin page-bg-overlay page-bg-overlay--subtle"
      style={style}
    >
      <div className="admin-main">
        {children}
      </div>
    </div>
  );
}
