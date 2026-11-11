import { useEffect, useState, type FormEvent } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { apiGet, apiPost } from '../api/client';
import PasswordChangeForm from '../components/PasswordChangeForm';
import PasswordField from '../components/PasswordField';
import { validatePassword } from '../utils/validation';
import { NavLink } from 'react-router-dom';
import {
  ArrowUpRight,
  Activity,
  Building2,
  Check,
  ClipboardList,
  Eye,
  EyeOff,
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
  items: Array<{ label: string; to: string }>;
}

const ROLE_SETTINGS: Record<UserRole, RoleSetting> = {
  admin: {
    label: 'Administration workspace',
    description: 'Clinic patients, appointments, medical records, and pharmacy inventory.',
    icon: ShieldCheck,
    items: [
      { label: 'Patients', to: '/patients' },
      { label: 'Appointments', to: '/appointments' },
      { label: 'Medical records', to: '/records' },
      { label: 'Pharmacy & inventory', to: '/pharmacy' },
    ],
  },
  receptionist: {
    label: 'Reception workspace',
    description: 'Keep patient registration and OPD requests moving quickly.',
    icon: ClipboardList,
    items: [
      { label: 'Patient cards', to: '/patients' },
      { label: 'OPD requests', to: '/reception' },
      { label: 'Medical records', to: '/records' },
      { label: 'Appointments', to: '/appointments' },
    ],
  },
  opd: {
    label: 'OPD workspace',
    description: 'Focus on consultations, referrals, and patient records.',
    icon: Activity,
    items: [
      { label: 'Consultation queue', to: '/opd' },
      { label: 'Medical records', to: '/records' },
      { label: 'Appointments', to: '/appointments' },
    ],
  },
  emergency: {
    label: 'Emergency workspace',
    description: 'Keep triage and urgent patient movement visible.',
    icon: Activity,
    items: [
      { label: 'Emergency queue', to: '/emergency' },
      { label: 'Patient cards', to: '/patients' },
      { label: 'Medical records', to: '/records' },
    ],
  },
  pharmacy: {
    label: 'Pharmacy workspace',
    description: 'Process prescriptions and monitor dispensary stock.',
    icon: Pill,
    items: [
      { label: 'Prescription queue', to: '/pharmacy-board' },
      { label: 'Inventory', to: '/pharmacy' },
      { label: 'Medical records', to: '/records' },
    ],
  },
  laboratory: {
    label: 'Laboratory workspace',
    description: 'Track diagnostic work and release verified results.',
    icon: FlaskConical,
    items: [
      { label: 'Laboratory queue', to: '/laboratory' },
      { label: 'Medical records', to: '/records' },
      { label: 'Patient cards', to: '/patients' },
    ],
  },
};

const themeOptions = [
  { id: 'light', label: 'Light', description: 'Bright clinic workspace', icon: Sun },
  { id: 'dark', label: 'Dark', description: 'Low-glare workspace', icon: Moon },
] as const;

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, role, token } = useAuth();
  const roleSetting = ROLE_SETTINGS[role];
  const RoleIcon = roleSetting.icon;
  const [defaultPassword, setDefaultPassword] = useState('');
  const [defaultPasswordConfigured, setDefaultPasswordConfigured] = useState(false);
  const [defaultPasswordValue, setDefaultPasswordValue] = useState<string | null>(null);
  const [showDefaultPassword, setShowDefaultPassword] = useState(false);
  const [defaultPasswordMessage, setDefaultPasswordMessage] = useState('');
  const [defaultPasswordError, setDefaultPasswordError] = useState('');
  const [savingDefaultPassword, setSavingDefaultPassword] = useState(false);

  useEffect(() => {
    if (role !== 'admin') return;
    apiGet<{ configured: boolean; password?: string | null }>('/admin/default-password', token)
      .then(result => {
        setDefaultPasswordConfigured(result.configured);
        setDefaultPasswordValue(result.password ?? null);
      })
      .catch(error => setDefaultPasswordError(error instanceof Error ? error.message : 'Could not load default password status.'));
  }, [role, token]);

  const saveDefaultPassword = async (event: FormEvent) => {
    event.preventDefault();
    setDefaultPasswordError('');
    setDefaultPasswordMessage('');
    const passwordError = validatePassword(defaultPassword, 'Default password');
    if (passwordError) {
      setDefaultPasswordError(passwordError);
      return;
    }
    setSavingDefaultPassword(true);
    const savedPassword = defaultPassword;
    try {
      const result = await apiPost<{ message: string }>('/admin/default-password', { password: savedPassword }, token);
      setDefaultPasswordConfigured(true);
      setDefaultPasswordValue(savedPassword);
      setDefaultPassword('');
      setDefaultPasswordMessage(result.message);
    } catch (error) {
      setDefaultPasswordError(error instanceof Error ? error.message : 'Could not update the default password.');
    } finally {
      setSavingDefaultPassword(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header settings-page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Personal preferences.</p>
        </div>
        <div className="settings-header-status" aria-label={`${theme} theme active`}>
          <span /> {theme === 'dark' ? 'Dark mode' : 'Light mode'}
        </div>
      </div>

      <div className="settings-layout">
        <section className="card card-outline card-primary settings-card settings-appearance-card">
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

        <section className="card card-outline card-success settings-card settings-account-card">
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

        </section>

        <PasswordChangeForm />

        {role === 'admin' && (
          <section className="card card-outline card-warning settings-card">
            <div className="settings-card-heading">
              <div className="settings-icon settings-icon-orange"><KeyRound size={18} /></div>
              <div>
                <h2>Default staff password</h2>
                <p>New staff accounts use this temporary password and must change it at first sign-in.</p>
              </div>
            </div>

            {/* Current default password display */}
            <div className="mb-3">
              <span className="form-label d-block" style={{ marginBottom: 4 }}>Current default password</span>
              {defaultPasswordConfigured ? (
                defaultPasswordValue ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <code
                      style={{
                        flex: '1 1 180px',
                        padding: '0.4rem 0.65rem',
                        borderRadius: 6,
                        border: '1px solid var(--clr-border)',
                        background: 'var(--clr-bg-hover)',
                        color: 'var(--clr-text-primary)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: '0.84rem',
                        overflowWrap: 'anywhere',
                        letterSpacing: showDefaultPassword ? 'normal' : '0.14em',
                      }}
                    >
                      {showDefaultPassword ? defaultPasswordValue : '•'.repeat(Math.min(defaultPasswordValue.length, 16))}
                    </code>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowDefaultPassword(current => !current)}
                      aria-pressed={showDefaultPassword}
                      aria-label={showDefaultPassword ? 'Hide default password' : 'Show default password'}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      {showDefaultPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showDefaultPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                ) : (
                  <div className="alert alert-info py-2 mb-0" style={{ fontSize: '0.78rem' }}>
                    A default password is configured but was saved before it could be displayed here. Save a new one below to see it.
                  </div>
                )
              ) : (
                <div className="alert alert-warning py-2 mb-0" style={{ fontSize: '0.78rem' }}>
                  No default password is set. New staff accounts will not be able to sign in until one is configured.
                </div>
              )}
            </div>

            {defaultPasswordError && <div className="alert alert-danger py-2" role="alert">{defaultPasswordError}</div>}
            {defaultPasswordMessage && <div className="alert alert-success py-2" role="status">{defaultPasswordMessage}</div>}
            <form onSubmit={saveDefaultPassword} noValidate>
              <label className="form-label" htmlFor="default-staff-password">New default password</label>
              <PasswordField id="default-staff-password" className="form-control mb-3" autoComplete="new-password" value={defaultPassword} onChange={event => setDefaultPassword(event.target.value)} minLength={10} required />
              <button type="submit" className="btn btn-warning" disabled={savingDefaultPassword}>{savingDefaultPassword ? 'Saving…' : 'Save default password'}</button>
            </form>
          </section>
        )}

        <section className="card card-outline card-info settings-card settings-role-card">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-purple"><RoleIcon size={18} /></div>
            <div>
              <h2>{roleSetting.label}</h2>
              <p>{roleSetting.description}</p>
            </div>
          </div>

          <div className="settings-role-list">
            {roleSetting.items.map(item => (
              <NavLink className="settings-role-item" key={item.to} to={item.to}>
                <span>{item.label}</span>
                <ArrowUpRight size={14} />
              </NavLink>
            ))}
          </div>
        </section>

        <section className="card card-outline card-warning settings-card settings-clinic-card">
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

      </div>
    </div>
  );
}
