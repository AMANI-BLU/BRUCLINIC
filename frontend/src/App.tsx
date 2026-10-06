import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClinicProvider } from './context/ClinicContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Appointments from './pages/Appointments';
import MedicalRecords from './pages/MedicalRecords';
import Pharmacy from './pages/Pharmacy';
import Doctors from './pages/Doctors';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import ReceptionDashboard from './pages/dashboards/ReceptionDashboard';
import OpdDashboard from './pages/dashboards/OpdDashboard';
import EmergencyDashboard from './pages/dashboards/EmergencyDashboard';
import PharmacyDashboard from './pages/dashboards/PharmacyDashboard';
import LaboratoryDashboard from './pages/dashboards/LaboratoryDashboard';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/reception" element={<ReceptionDashboard />} />
                <Route path="/opd" element={<OpdDashboard />} />
                <Route path="/emergency" element={<EmergencyDashboard />} />
                <Route path="/pharmacy-board" element={<PharmacyDashboard />} />
                <Route path="/laboratory" element={<LaboratoryDashboard />} />

                <Route path="/patients" element={<Patients />} />
                <Route path="/appointments" element={<Appointments />} />
                <Route path="/records" element={<MedicalRecords />} />
                <Route path="/pharmacy" element={<Pharmacy />} />
                <Route path="/doctors" element={<Doctors />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
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
          <ClinicProvider>
            <AppRoutes />
          </ClinicProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
