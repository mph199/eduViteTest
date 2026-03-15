import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '../components/AdminSidebar';
import './AdminLayout.css';

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="adminLayout">
      {/* Desktop: persistent sidebar */}
      <AdminSidebar />

      {/* Mobile: slide-out sidebar */}
      <AdminSidebar mobile open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Mobile hamburger trigger (hidden on desktop via CSS) */}
      <button
        type="button"
        className="adminLayout__mobileMenuBtn"
        onClick={() => setMobileOpen(true)}
        aria-label="Navigation oeffnen"
      >
        <svg viewBox="0 0 20 20" width="22" height="22" focusable="false" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <main className="adminLayout__content">
        <Outlet />
      </main>
    </div>
  );
}
