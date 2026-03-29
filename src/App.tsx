import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, useMemo } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminTeachers } from './pages/AdminTeachers';
import { AdminEvents } from './pages/AdminEvents';
import { Impressum } from './pages/Impressum';
import { Datenschutz } from './pages/Datenschutz';
import { VerifyEmail } from './pages/VerifyEmail';
import { MaintenancePage } from './pages/MaintenancePage';
import { SuperadminPage } from './pages/SuperadminPage';
import { Footer } from './components/Footer';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { GlobalTopHeader } from './components/GlobalTopHeader';
import { AdminTeacherLayout } from './components/AdminTeacherLayout';
import { modules } from './modules/registry';
import { useModuleConfig } from './contexts/ModuleConfigContext';
import './App.css'

// Maintenance-Modus via Env: VITE_MAINTENANCE_MODE=true|1|yes
const MAINTENANCE_MODE = (() => {
  const env = import.meta.env as unknown as Record<string, unknown>;
  const raw = env?.VITE_MAINTENANCE_MODE;
  return typeof raw === 'string' && /^(1|true|yes)$/i.test(raw);
})();

function App() {
  const { isModuleEnabled } = useModuleConfig();
  const activeModules = useMemo(() => modules.filter((m) => isModuleEnabled(m.id)), [isModuleEnabled]);

  return (
    <BrowserRouter>
      <AuthProvider>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <GlobalTopHeader />
          <div style={{ flex: 1 }}>
            <AppErrorBoundary>
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Laden…</div>}>
            <Routes>
              {/* Login ist immer erreichbar, auch im Maintenance-Modus */}
              <Route path="/login" element={<LoginPage />} />

              {/* Landing Page mit Modul-Kacheln */}
              <Route path="/" element={MAINTENANCE_MODE ? <MaintenancePage /> : <LandingPage />} />
              <Route path="/impressum" element={MAINTENANCE_MODE ? <MaintenancePage /> : <Impressum />} />
              <Route path="/datenschutz" element={MAINTENANCE_MODE ? <MaintenancePage /> : <Datenschutz />} />
              <Route path="/verify" element={<VerifyEmail />} />

              {/* Dynamische Modul-Routen (nur Module mit PublicPage) */}
              {activeModules.filter((mod) => mod.PublicPage).map((mod) => {
                const Page = mod.PublicPage!;
                return (
                  <Route
                    key={mod.id}
                    path={mod.basePath}
                    element={MAINTENANCE_MODE ? <MaintenancePage /> : <Page />}
                  />
                );
              })}

              {/* ══ Authentifizierter Bereich mit Sidebar-Layout ══════════ */}
              <Route element={<AdminTeacherLayout />}>

                {/* Geschützter Teacher-Bereich (aus Modulen) */}
                {activeModules
                  .filter((mod) => mod.teacherLayout && mod.teacherRoutes)
                  .map((mod) => {
                    const Layout = mod.teacherLayout!;
                    const basePath = mod.teacherBasePath || '/teacher';
                    return (
                      <Route
                        key={`teacher-${mod.id}`}
                        path={basePath}
                        element={
                          <ProtectedRoute allowedModules={mod.requiredModule ? [mod.requiredModule] : undefined}>
                            <Layout />
                          </ProtectedRoute>
                        }
                      >
                        {mod.teacherRoutes!.map((tr, i) =>
                          tr.index ? (
                            <Route key={i} index element={<tr.Component />} />
                          ) : (
                            <Route key={i} path={tr.path} element={<tr.Component />} />
                          )
                        )}
                        <Route path="*" element={<Navigate to={basePath} replace />} />
                      </Route>
                    );
                  })}

                {/* Admin-Bereich */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/teachers"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                      <AdminTeachers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/events"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                      <AdminEvents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                      <Navigate to="/admin/teachers" replace />
                    </ProtectedRoute>
                  }
                />
                {/* Admin-Routen aus Modulen */}
                {activeModules.flatMap((mod) =>
                  (mod.adminRoutes ?? []).map((ar) => (
                    <Route
                      key={ar.path}
                      path={ar.path}
                      element={
                        <ProtectedRoute
                          allowedRoles={mod.requiredModule ? undefined : ['admin', 'superadmin']}
                          allowedModules={mod.requiredModule ? [mod.requiredModule] : undefined}
                        >
                          <ar.Component />
                        </ProtectedRoute>
                      }
                    />
                  ))
                )}

                {/* Superadmin (im selben Layout) */}
                <Route
                  path="/superadmin"
                  element={
                    <ProtectedRoute allowedRoles={['superadmin']}>
                      <SuperadminPage />
                    </ProtectedRoute>
                  }
                />

              </Route>
              {/* ══ Ende authentifizierter Bereich ════════════════════════ */}

              {/* Catch-All: leite unbekannte Pfade auf die Startseite um */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
            </AppErrorBoundary>
          </div>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
