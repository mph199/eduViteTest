import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminTeachers } from './pages/AdminTeachers';
import { AdminEvents } from './pages/AdminEvents';
import { AdminFeedback } from './pages/AdminFeedback';
import { Impressum } from './pages/Impressum';
import { Datenschutz } from './pages/Datenschutz';
import { VerifyEmail } from './pages/VerifyEmail';
import { MaintenancePage } from './pages/MaintenancePage';
import { SuperadminPage } from './pages/SuperadminPage';
import { Footer } from './components/Footer';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { GlobalTopHeader } from './components/GlobalTopHeader';
import { modules } from './modules/registry';
import './App.css'

// Maintenance-Modus via Env: VITE_MAINTENANCE_MODE=true|1|yes
const MAINTENANCE_MODE = (() => {
  const env = import.meta.env as unknown as Record<string, unknown>;
  const raw = env?.VITE_MAINTENANCE_MODE;
  return typeof raw === 'string' && /^(1|true|yes)$/i.test(raw);
})();

function App() {
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

              {/* Dynamische Modul-Routen */}
              {modules.map((mod) => (
                <Route
                  key={mod.id}
                  path={mod.basePath}
                  element={MAINTENANCE_MODE ? <MaintenancePage /> : <mod.PublicPage />}
                />
              ))}

              {/* Geschützter Teacher-Bereich (aus Modulen) */}
              {modules
                .filter((mod) => mod.teacherLayout && mod.teacherRoutes)
                .map((mod) => {
                  const Layout = mod.teacherLayout!;
                  return (
                    <Route
                      key={`teacher-${mod.id}`}
                      path="/teacher"
                      element={
                        <ProtectedRoute>
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
                      <Route path="*" element={<Navigate to="/teacher" replace />} />
                    </Route>
                  );
                })}

              {/* Admin-Bereich – Shared Kernel */}
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
              {/* Admin-Routen aus Modulen */}
              {modules.flatMap((mod) =>
                (mod.adminRoutes ?? []).map((ar) => (
                  <Route
                    key={ar.path}
                    path={ar.path}
                    element={
                      <ProtectedRoute allowedModules={mod.requiredModule ? [mod.requiredModule] : undefined}>
                        <ar.Component />
                      </ProtectedRoute>
                    }
                  />
                ))
              )}
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
                element={<Navigate to="/admin/teachers" replace />} 
              />
              <Route 
                path="/admin/feedback" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <AdminFeedback />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/superadmin" 
                element={
                  <ProtectedRoute allowedRoles={['superadmin']}>
                    <SuperadminPage />
                  </ProtectedRoute>
                } 
              />
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
