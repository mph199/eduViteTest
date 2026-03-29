/**
 * AdminTeacherLayout — Wrapper für den gesamten Admin/Teacher/Superadmin-Bereich.
 *
 * Rendert die permanente Sidebar (Desktop, >1024px) und den Content-Bereich.
 * Auf Mobile (<=1024px) verschwindet die Sidebar per CSS; der Hamburger-Drawer
 * in GlobalTopHeader übernimmt die Navigation.
 */

import { Outlet } from 'react-router-dom';
import { AdminTeacherSidebar } from './AdminTeacherSidebar';
import './AdminTeacherLayout.css';

export function AdminTeacherLayout() {
  return (
    <div className="atl">
      <AdminTeacherSidebar />
      <main className="atl__content">
        <Outlet />
      </main>
    </div>
  );
}
