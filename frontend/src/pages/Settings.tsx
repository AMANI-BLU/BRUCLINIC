import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import {
  Activity,
  BarChart3,
  Building2,
  Check,
  ClipboardList,
  Clock3,
  FileText,
  FlaskConical,
  KeyRound,
  Moon,
  Pill,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
} from 'lucide-react';
import './Settings.css';

interface RoleSetting {
  label: string;
  description: string;
  icon: typeof Users;
  items: string[];
}

const ROLE_SETTINGS: Record<UserRole, RoleSetting> = {
  admin: {
    label: 'Administration workspace',
    description: 'Manage clinic access, operational setup, and reporting.',
    icon: ShieldCheck,
    items: ['Staff accounts', 'Clinic-wide reports', 'Department access'],
  },
  receptionist: {
    label: 'Reception workspace',
    description: 'Keep patient registration and OPD requests moving quickly.',
    icon: ClipboardList,
    items: ['Patient cards', 'OPD requests', 'Appointments'],
  },
  opd: {
    label: 'OPD workspace',
    description: 'Focus on consultations, referrals, and patient records.',
    icon: Activity,
    items: ['Consultation queue', 'Medical records', 'Laboratory requests'],
  },
  emergency: {
    label: 'Emergency workspace',
    description: 'Keep triage and urgent patient movement visible.',
    icon: Activity,
    items: ['Emergency queue', 'Triage status', 'Patient history'],
  },
  pharmacy: {
    label: 'Pharmacy workspace',
    description: 'Process prescriptions and monitor dispensary stock.',
    icon: Pill,
    items: ['Prescription queue', 'Inventory', 'Dispensing history'],
  },
  laboratory: {
    label: 'Laboratory workspace',
    description: 'Track diagnostic work and release verified results.',
    icon: FlaskConical,
    items: ['Pending tests', 'Specimen workflow', 'Results verification'],
  },
};

const themeOptions = [
  { id: 'light', label: 'Light', description: 'Bright clinic workspace', icon: Sun },
  { id: 'dark', label: 'Dark', description: 'Low-glare workspace', icon: Moon },
] as const;

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, role } = useAuth();
  const roleSetting = ROLE_SETTINGS[role];
  const RoleIcon = roleSetting.icon;

  return (
    <div className="settings-page">
      <div className="page-header settings-page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Personal preferences and {roleSetting.label.toLowerCase()}.</p>
        </div>
      </div>

      <div className="settings-layout">
        <section className="card settings-card settings-appearance-card">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-blue"><Sun size={18} /></div>
            <div>
              <h2>Appearance</h2>
              <p>Choose the theme for this device.</p>
            </div>
          </div>

          <div className="settings-choice-grid">
            {themeOptions.map(({ id, label, description, icon: Icon }) => {
              const selected = theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`settings-choice ${selected ? 'selected' : ''}`}
                  onClick={() => { if (theme !== id) toggleTheme(); }}
                  aria-pressed={selected}
                >
                  <span className="settings-choice-icon"><Icon size={20} /></span>
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  {selected && <Check className="settings-choice-check" size={16} />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="card settings-card settings-account-card">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-green"><UserRound size={18} /></div>
            <div>
              <h2>Your account</h2>
              <p>Signed-in staff profile from the database.</p>
            </div>
          </div>

          <div className="settings-account-summary">
            <div className="settings-account-avatar" style={{ backgroundColor: currentUser?.badgeColor || '#007bff' }}>
              {currentUser?.avatarInitials || 'ST'}
            </div>
            <div className="settings-account-name">
              <strong>{currentUser?.name || 'Staff User'}</strong>
              <span>{currentUser?.roleTitle || 'Clinic staff'}</span>
            </div>
          </div>

          <dl className="settings-details">
            <div><dt>Username</dt><dd>{currentUser?.username || '—'}</dd></div>
            <div><dt>Email</dt><dd>{currentUser?.email || '—'}</dd></div>
            <div><dt>Department</dt><dd>{currentUser?.department || '—'}</dd></div>
          </dl>

          <div className="settings-note">
            <KeyRound size={15} /> Password changes are managed by an administrator.
          </div>
        </section>

        <section className="card settings-card settings-role-card">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-purple"><RoleIcon size={18} /></div>
            <div>
              <h2>{roleSetting.label}</h2>
              <p>{roleSetting.description}</p>
            </div>
          </div>

          <div className="settings-role-list">
            {roleSetting.items.map(item => (
              <div className="settings-role-item" key={item}>
                <Check size={15} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card settings-card settings-clinic-card">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-orange"><Building2 size={18} /></div>
            <div>
              <h2>Clinic workspace</h2>
              <p>Shared clinic information.</p>
            </div>
          </div>

          <div className="settings-details settings-clinic-details">
            <div><span>Facility</span><strong>Borana University Clinic</strong></div>
            <div><span>Location</span><strong>Yabelo, Oromia, Ethiopia</strong></div>
            <div><span>Database</span><strong className="settings-status"><span /> Connected through API</strong></div>
          </div>
        </section>

        <section className="card settings-card settings-help-card">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-gray"><Clock3 size={18} /></div>
            <div>
              <h2>Quick access</h2>
              <p>Use the sidebar for your available clinic tools.</p>
            </div>
          </div>
          <div className="settings-quick-links">
            <span><Users size={15} /> Staff directory</span>
            <span><FileText size={15} /> Patient records</span>
            <span><BarChart3 size={15} /> Reports</span>
          </div>
        </section>
      </div>
    </div>
  );
}
