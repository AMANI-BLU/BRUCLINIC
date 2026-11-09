import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClinicProvider }  from './context/ClinicContext';
import { ThemeProvider }   from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MaintenanceProvider, useMaintenance } from './context/MaintenanceContext';
import MaintenancePage     from './components/Maintenance/MaintenancePage';
import Layout              from './components/Layout/Layout';
import ProtectedRoute, { roleLandingPage } from './components/ProtectedRoute';

import Login               from './pages/Login';
import Dashboard           from './pages/Dashboard';
import Patients            from './pages/Patients';
import Appointments        from './pages/Appointments';
import MedicalRecords      from './pages/MedicalRecords';
import Pharmacy            from './pages/Pharmacy';
import Doctors             from './pages/Doctors';
import Reports             from './pages/Reports';
import Settings            from './pages/Settings';
import StaffAccounts       from './pages/StaffAccounts';
import ReceptionDashboard  from './pages/dashboards/ReceptionDashboard';
import OpdDashboard        from './pages/dashboards/OpdDashboard';
import EmergencyDashboard  from './pages/dashboards/EmergencyDashboard';
import PharmacyDashboard   from './pages/dashboards/PharmacyDashboard';
import LaboratoryDashboard from './pages/dashboards/LaboratoryDashboard';
import SecurityCenter      from './pages/SecurityCenter';
import AdminBackup         from './pages/AdminBackup';
import PasswordChangeForm  from './components/PasswordChangeForm';
import Messages            from './pages/Messages';

// ── Role permission map ───────────────────────────────────────────
//
// Each entry maps a route to the set of roles that may access it.
// Roles not listed are redirected to their own landing page.
//
//  admin        – full system access
//  receptionist – patient registration, appointments, basic records view
//  opd          – OPD workspace, patients, records, appointments
//  emergency    – emergency board, patients, records
//  pharmacy     – pharmacy board, prescriptions (read records)
//  laboratory   – lab board, patients, records

const ROLE = {
  ADMIN_ONLY:       ['admin']                                                          ,
  ADMIN_RECEPTION:  ['admin', 'receptionist']                                         ,
  CLINICAL:         ['admin', 'opd', 'emergency']                                     ,
  CLINICAL_FULL:    ['admin', 'receptionist', 'opd', 'emergency']                     ,
  ALL:              ['admin', 'receptionist', 'opd', 'emergency', 'pharmacy', 'laboratory'] ,
} as const;

// ─────────────────────────────────────────────────────────────────

function AppRoutes() {
  const { isAuthenticated, currentUser, authLoading } = useAuth();
  const { enabled: maintenance, message: maintenanceMessage, checking: maintenanceChecking, refresh: refreshMaintenance } = useMaintenance();
  const [adminSignIn, setAdminSignIn] = useState(false);

  useEffect(() => {
    if (!maintenance) setAdminSignIn(false);
  }, [maintenance]);

  if (authLoading || maintenanceChecking) {
    return (
      <div className="clinic-bootstrap-skeleton" role="status" aria-label="Loading clinic">
        <div className="clinic-skeleton-topbar">
          <span className="clinic-skeleton-block clinic-skeleton-brand" />
          <span className="clinic-skeleton-block clinic-skeleton-top-actions" />
        </div>
        <div className="clinic-skeleton-workspace">
          <aside className="clinic-skeleton-sidebar">
            {Array.from({ length: 6 }, (_, index) => <span className="clinic-skeleton-block clinic-skeleton-nav-item" key={index} />)}
          </aside>
          <main className="page-visit-skeleton clinic-skeleton-main" aria-hidden="true">
            <span className="page-skeleton-block page-skeleton-heading" />
            <div className="page-skeleton-metrics">
              {Array.from({ length: 4 }, (_, index) => <span className="page-skeleton-block" key={index} />)}
            </div>
            <div className="page-skeleton-content">
              <span className="page-skeleton-block page-skeleton-subheading" />
              <span className="page-skeleton-block page-skeleton-line" />
              <span className="page-skeleton-block page-skeleton-line" />
              <span className="page-skeleton-block page-skeleton-line page-skeleton-line-short" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Maintenance mode is a full stop for staff: no routes, data or actions.
  // Administrators keep access so they can finish the work and switch it off.
  if (maintenance && currentUser?.role !== 'admin') {
    if (adminSignIn && !isAuthenticated) return <Login />;
    return (
      <MaintenancePage
        message={maintenanceMessage}
        onRefresh={refreshMaintenance}
        onAdminAccess={() => setAdminSignIn(true)}
      />
    );
  }

  const landingPage = roleLandingPage(currentUser?.role);

  if (isAuthenticated && currentUser?.mustChangePassword) {
    return <PasswordChangeForm forced />;
  }

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={landingPage} replace /> : <Login />}
      />

      {/* Protected shell — all routes inside require authentication */}
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <Layout>
              <Routes>

                {/* Generic dashboard — shows a role-appropriate summary */}
                <Route path="/" element={currentUser?.role === 'admin' ? <Navigate to="/patients" replace /> : <Dashboard />} />

                {/* ── Role-specific dashboards ─────────────────────── */}
                <Route
                  path="/admin"
                  element={<Navigate to="/patients" replace />}
                />
                <Route
                  path="/reception"
                  element={
                    <ProtectedRoute allowed={['admin', 'receptionist']}>
                      <ReceptionDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/opd"
                  element={
                    <ProtectedRoute allowed={['admin', 'opd']}>
                      <OpdDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/emergency"
                  element={
                    <ProtectedRoute allowed={['admin', 'emergency']}>
                      <EmergencyDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pharmacy-board"
                  element={
                    <ProtectedRoute allowed={['admin', 'pharmacy']}>
                      <PharmacyDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/laboratory"
                  element={
                    <ProtectedRoute allowed={['admin', 'laboratory']}>
                      <LaboratoryDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* ── Admin-only management pages ──────────────────── */}
                <Route
                  path="/staff-accounts"
                  element={
                    <ProtectedRoute allowed={[...ROLE.ADMIN_ONLY]}>
                      <StaffAccounts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/staff"
                  element={<Navigate to="/staff-accounts" replace />}
                />
                <Route
                  path="/security"
                  element={
                    <ProtectedRoute allowed={[...ROLE.ADMIN_ONLY]}>
                      <SecurityCenter />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/backup"
                  element={
                    <ProtectedRoute allowed={[...ROLE.ADMIN_ONLY]}>
                      <AdminBackup />
                    </ProtectedRoute>
                  }
                />

                {/* ── Clinical shared pages ────────────────────────── */}
                {/*
                  Patients: admin, receptionist, opd, emergency can all view/add patients.
                  Pharmacy and laboratory see patients via their own dashboards, not this page.
                */}
                <Route
                  path="/patients"
                  element={
                    <ProtectedRoute allowed={[...ROLE.CLINICAL_FULL]}>
                      <Patients />
                    </ProtectedRoute>
                  }
                />
                {/*
                  Appointments: admin, receptionist, opd can manage appointments.
                */}
                <Route
                  path="/appointments"
                  element={
                    <ProtectedRoute allowed={['admin', 'receptionist', 'opd']}>
                      <Appointments />
                    </ProtectedRoute>
                  }
                />
                {/*
                  Medical Records: clinical staff + pharmacy (to read prescriptions) + lab (to read orders).
                */}
                <Route
                  path="/records"
                  element={
                    <ProtectedRoute allowed={[...ROLE.ALL]}>
                      <MedicalRecords />
                    </ProtectedRoute>
                  }
                />
                {/*
                  Pharmacy page: admin + pharmacy staff.
                */}
                <Route
                  path="/pharmacy"
                  element={
                    <ProtectedRoute allowed={['admin', 'pharmacy']}>
                      <Pharmacy />
                    </ProtectedRoute>
                  }
                />
                {/*
                  Doctors directory: clinical staff who need to assign/consult doctors.
                */}
                <Route
                  path="/doctors"
                  element={
                    <ProtectedRoute allowed={['admin', 'receptionist', 'opd', 'emergency']}>
                      <Doctors />
                    </ProtectedRoute>
                  }
                />
                {/*
                  Reports: admin + receptionist (administrative reports).
                */}
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute allowed={['admin', 'receptionist']}>
                      <Reports />
                    </ProtectedRoute>
                  }
                />
                {/*
                  Settings: all authenticated users can manage their own settings.
                */}
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute allowed={[...ROLE.ALL]}>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/messages"
                  element={
                    <ProtectedRoute allowed={[...ROLE.ALL]}>
                      <Messages />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all → role home */}
                <Route path="*" element={<Navigate to={landingPage} replace />} />

              </Routes>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <MaintenanceProvider>
            <ClinicProvider>
              <AppRoutes />
            </ClinicProvider>
          </MaintenanceProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
