import { useAuth } from '../context/AuthContext';
import AdminDashboard from './dashboards/AdminDashboard';
import ReceptionDashboard from './dashboards/ReceptionDashboard';
import OpdDashboard from './dashboards/OpdDashboard';
import EmergencyDashboard from './dashboards/EmergencyDashboard';
import PharmacyDashboard from './dashboards/PharmacyDashboard';
import LaboratoryDashboard from './dashboards/LaboratoryDashboard';
import './Dashboard.css';

export default function Dashboard() {
  const { role } = useAuth();

  return (
    <div className="dashboard">
      {role === 'admin' && <AdminDashboard />}
      {role === 'receptionist' && <ReceptionDashboard />}
      {role === 'opd' && <OpdDashboard />}
      {role === 'emergency' && <EmergencyDashboard />}
      {role === 'pharmacy' && <PharmacyDashboard />}
      {role === 'laboratory' && <LaboratoryDashboard />}
    </div>
  );
}
