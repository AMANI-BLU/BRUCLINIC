import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { apiGet, apiPatch, apiPost } from '../api/client';
import defaultLoginBackground from '../assets/bg.jpg';
import PasswordChangeForm from '../components/PasswordChangeForm';
import PasswordField from '../components/PasswordField';
import LoadingButton from '../components/LoadingButton';
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
  Camera,
  Trash2,
  Languages,
} from 'lucide-react';
import { LANGUAGE_OPTIONS, useLanguage } from '../context/LanguageContext';
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
  ict: {
    label: 'ICT & Systems workspace',
    description: 'System accounts, security center, database backups, and clinic platform config.',
    icon: ShieldCheck,
    items: [
      { label: 'Staff accounts', to: '/staff-accounts' },
      { label: 'Security center', to: '/security' },
      { label: 'Backup & restore', to: '/backup' },
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

function resizeProfileImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;
      const cropSize = Math.min(sourceWidth, sourceHeight);
      if (!cropSize) {
        reject(new Error('That image has invalid dimensions.'));
        return;
      }
      const cropX = (sourceWidth - cropSize) / 2;
      const cropY = (sourceHeight - cropSize) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 320;
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('Could not prepare that image.')); return; }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, cropX, cropY, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      if (dataUrl.length > 600000) {
        reject(new Error('That image is too large. Please choose a smaller photo.'));
        return;
      }
      resolve(dataUrl);
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('That image could not be read.')); };
    image.src = objectUrl;
  });
}

function resizeLoginBackground(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      reject(new Error('Choose a JPEG, PNG, or WebP image.'));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      reject(new Error('Choose an image smaller than 20 MB.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('That image has invalid dimensions.'));
        return;
      }
      const contextCanvas = document.createElement('canvas');
      const context = contextCanvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not prepare that image.'));
        return;
      }

      for (const maxEdge of [1600, 1400, 1200, 1000, 800, 640]) {
        const scale = Math.min(maxEdge / Math.max(image.naturalWidth, image.naturalHeight), 1);
        contextCanvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        contextCanvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        context.fillStyle = '#0b1b2e';
        context.fillRect(0, 0, contextCanvas.width, contextCanvas.height);
        context.drawImage(image, 0, 0, contextCanvas.width, contextCanvas.height);
        for (const quality of [0.82, 0.72, 0.62, 0.52]) {
          const dataUrl = contextCanvas.toDataURL('image/jpeg', quality);
          if (dataUrl.length <= 580000) {
            resolve(dataUrl);
            return;
          }
        }
      }
      reject(new Error('That image could not be compressed enough. Choose a simpler image.'));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('That image could not be read.')); };
    image.src = objectUrl;
  });
}

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { currentUser, role, token, updateProfile } = useAuth();
  const roleSetting = ROLE_SETTINGS[role];
  const RoleIcon = roleSetting.icon;
  const [defaultPassword, setDefaultPassword] = useState('');
  const [defaultPasswordConfigured, setDefaultPasswordConfigured] = useState(false);
  const [defaultPasswordValue, setDefaultPasswordValue] = useState<string | null>(null);
  const [showDefaultPassword, setShowDefaultPassword] = useState(false);
  const [defaultPasswordMessage, setDefaultPasswordMessage] = useState('');
  const [defaultPasswordError, setDefaultPasswordError] = useState('');
  const [savingDefaultPassword, setSavingDefaultPassword] = useState(false);
  const [savingProfilePicture, setSavingProfilePicture] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [loginBackground, setLoginBackground] = useState<string | null>(null);
  const [savingLoginBackground, setSavingLoginBackground] = useState(false);
  const [loginBackgroundMessage, setLoginBackgroundMessage] = useState('');
  const [loginBackgroundError, setLoginBackgroundError] = useState('');

  useEffect(() => {
    if (role !== 'admin' && role !== 'ict') return;
    apiGet<{ configured: boolean; password?: string | null }>('/admin/default-password', token)
      .then(result => {
        setDefaultPasswordConfigured(result.configured);
        setDefaultPasswordValue(result.password ?? null);
      })
      .catch(error => setDefaultPasswordError(error instanceof Error ? error.message : 'Could not load default password status.'));
  }, [role, token]);

  useEffect(() => {
    if (role !== 'admin' && role !== 'ict') return;
    apiGet<{ data?: { image?: string | null } }>('/admin/login-background', token)
      .then(result => setLoginBackground(result.data?.image || null))
      .catch(error => setLoginBackgroundError(error instanceof Error ? error.message : 'Could not load the login background.'));
  }, [role, token]);

  const saveDefaultPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (savingDefaultPassword) return;
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

  const handleProfilePicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProfileMessage('');
    setProfileError('');
    setSavingProfilePicture(true);
    try {
      const avatarUrl = await resizeProfileImage(file);
      const result = await updateProfile({ avatarUrl });
      if (!result.success) throw new Error(result.error || 'Could not update your profile picture.');
      setProfileMessage('Profile picture updated.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not update your profile picture.');
    } finally {
      setSavingProfilePicture(false);
    }
  };

  const removeProfilePicture = async () => {
    setProfileMessage('');
    setProfileError('');
    setSavingProfilePicture(true);
    try {
      const result = await updateProfile({ avatarUrl: null });
      if (!result.success) throw new Error(result.error || 'Could not remove your profile picture.');
      setProfileMessage('Profile picture removed.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not remove your profile picture.');
    } finally {
      setSavingProfilePicture(false);
    }
  };

  const handleLoginBackground = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLoginBackgroundMessage('');
    setLoginBackgroundError('');
    setSavingLoginBackground(true);
    try {
      const image = await resizeLoginBackground(file);
      const result = await apiPatch<{ data?: { image?: string | null } }>('/admin/login-background', { image }, token);
      setLoginBackground(result.data?.image || null);
      setLoginBackgroundMessage('Login background updated.');
    } catch (error) {
      setLoginBackgroundError(error instanceof Error ? error.message : 'Could not update the login background.');
    } finally {
      setSavingLoginBackground(false);
    }
  };

  const restoreLoginBackground = async () => {
    setLoginBackgroundMessage('');
    setLoginBackgroundError('');
    setSavingLoginBackground(true);
    try {
      const result = await apiPatch<{ data?: { image?: string | null } }>('/admin/login-background', { image: null }, token);
      setLoginBackground(result.data?.image || null);
      setLoginBackgroundMessage('Default login background restored.');
    } catch (error) {
      setLoginBackgroundError(error instanceof Error ? error.message : 'Could not restore the default login background.');
    } finally {
      setSavingLoginBackground(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header settings-page-header">
        <div>
          <h1 className="page-title">{t('Settings')}</h1>
          <p className="page-subtitle">{t('Personal preferences.')}</p>
        </div>
        <div className="settings-header-status" aria-label={`${theme === 'dark' ? t('Dark') : t('Light')} ${t('theme active')}`}>
          <span /> {theme === 'dark' ? t('Dark mode') : t('Light mode')}
        </div>
      </div>

      <div className="settings-layout">
        <section className="card card-outline card-primary settings-card settings-appearance-card">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-blue"><Sun size={18} /></div>
            <div>
              <h2>{t('Appearance')}</h2>
              <p>{t('Choose the theme for this device.')}</p>
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
                    <strong>{t(label)}</strong>
                    <small>{t(description)}</small>
                  </span>
                  {selected && <Check className="settings-choice-check" size={16} />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="card card-outline card-info settings-card settings-language-card">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-purple"><Languages size={18} /></div>
            <div>
              <h2>{t('Language')}</h2>
              <p>{t('Choose the language for this device.')}</p>
            </div>
          </div>
          <label className="settings-language-control">
            <span>{t('Language')}</span>
            <select value={language} onChange={event => setLanguage(event.target.value as typeof language)} aria-label={t('Language')}>
              {LANGUAGE_OPTIONS.map(option => <option key={option.code} value={option.code}>{option.nativeName}</option>)}
            </select>
          </label>
        </section>

        <section className="card card-outline card-success settings-card settings-account-card">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-green"><UserRound size={18} /></div>
            <div>
              <h2>{t('Your account')}</h2>
              <p>{t('Signed-in staff profile from the database.')}</p>
            </div>
          </div>

          <div className="settings-account-summary">
            <div className="settings-account-avatar" style={{ backgroundColor: currentUser?.badgeColor || '#007bff' }}>
              {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt={t('Your profile')} /> : (currentUser?.avatarInitials || 'ST')}
            </div>
            <div className="settings-account-name">
              <strong>{currentUser?.name || 'Staff User'}</strong>
              <span>{t(currentUser?.roleTitle || 'Clinic staff')}</span>
            </div>
          </div>

          <div className="settings-profile-picture-actions">
            <label className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: savingProfilePicture ? 'wait' : 'pointer' }}>
              <Camera size={14} /> {savingProfilePicture ? t('Saving…') : currentUser?.avatarUrl ? t('Change picture') : t('Add profile picture')}
              <input type="file" accept="image/*" onChange={handleProfilePicture} disabled={savingProfilePicture} hidden />
            </label>
            {currentUser?.avatarUrl && (
              <button type="button" className="btn btn-link btn-sm" onClick={removeProfilePicture} disabled={savingProfilePicture}>
                <Trash2 size={13} /> {t('Remove')}
              </button>
            )}
          </div>
          {profileError && <div className="alert alert-danger py-1 px-2 mt-2 mb-0" role="alert">{t(profileError)}</div>}
          {profileMessage && <div className="alert alert-success py-1 px-2 mt-2 mb-0" role="status">{t(profileMessage)}</div>}

          <dl className="settings-details">
            <div><dt>{t('Username')}</dt><dd>{currentUser?.username || '—'}</dd></div>
            <div><dt>{t('Email')}</dt><dd>{currentUser?.email || '—'}</dd></div>
            <div><dt>{t('Phone')}</dt><dd>{currentUser?.phone || '—'}</dd></div>
            <div><dt>{t('Gender')}</dt><dd>{t(currentUser?.gender || '—')}</dd></div>
            <div><dt>{t('Department')}</dt><dd>{t(currentUser?.department || '—')}</dd></div>
          </dl>

        </section>

        <PasswordChangeForm />

        {(role === 'admin' || role === 'ict') && (
          <section className="card card-outline card-primary settings-card settings-login-background-card">
            <div className="settings-card-heading">
              <div className="settings-icon settings-icon-blue"><Camera size={18} /></div>
              <div>
                <h2>{t('Login page background')}</h2>
                <p>{t('Choose the image shown behind the sign-in form for everyone.')}</p>
              </div>
            </div>
            <div
              className="settings-login-background-preview"
              style={{ backgroundImage: `linear-gradient(90deg, rgba(4, 18, 35, 0.42), rgba(4, 18, 35, 0.08)), url("${loginBackground || defaultLoginBackground}")` }}
            >
              <strong>{t(loginBackground ? 'Current custom background' : 'Built-in background')}</strong>
              <span>{t('Preview')}</span>
            </div>
            <div className="settings-login-background-actions">
              <label className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: savingLoginBackground ? 'wait' : 'pointer' }}>
                <Camera size={14} /> {savingLoginBackground ? t('Saving…') : t('Upload background image')}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLoginBackground} disabled={savingLoginBackground} hidden />
              </label>
              {loginBackground && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={restoreLoginBackground} disabled={savingLoginBackground}>
                  <Trash2 size={13} /> {t('Restore built-in background')}
                </button>
              )}
            </div>
            <small className="settings-note">{t('JPEG, PNG, or WebP. The image is resized before saving.')}</small>
            {loginBackgroundError && <div className="alert alert-danger py-1 px-2 mt-2 mb-0" role="alert">{t(loginBackgroundError)}</div>}
            {loginBackgroundMessage && <div className="alert alert-success py-1 px-2 mt-2 mb-0" role="status">{t(loginBackgroundMessage)}</div>}
          </section>
        )}

        {(role === 'admin' || role === 'ict') && (
          <section className="card card-outline card-warning settings-card">
            <div className="settings-card-heading">
              <div className="settings-icon settings-icon-orange"><KeyRound size={18} /></div>
              <div>
              <h2>{t('Default staff password')}</h2>
              <p>{t('New staff accounts use this temporary password and must change it at first sign-in.')}</p>
              </div>
            </div>

            {/* Current default password display */}
            <div className="mb-3">
              <span className="form-label d-block" style={{ marginBottom: 4 }}>{t('Current default password')}</span>
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
                    {t('A default password is configured but was saved before it could be displayed here. Save a new one below to see it.')}
                  </div>
                )
              ) : (
                <div className="alert alert-warning py-2 mb-0" style={{ fontSize: '0.78rem' }}>
                  {t('No default password is set. New staff accounts will not be able to sign in until one is configured.')}
                </div>
              )}
            </div>

            {defaultPasswordError && <div className="alert alert-danger py-2" role="alert">{t(defaultPasswordError)}</div>}
            {defaultPasswordMessage && <div className="alert alert-success py-2" role="status">{t(defaultPasswordMessage)}</div>}
            <form onSubmit={saveDefaultPassword} noValidate>
              <label className="form-label" htmlFor="default-staff-password">{t('New default password')}</label>
              <PasswordField id="default-staff-password" className="form-control mb-3" autoComplete="new-password" value={defaultPassword} onChange={event => setDefaultPassword(event.target.value)} minLength={10} required />
              <LoadingButton type="submit" className="btn btn-warning" loading={savingDefaultPassword} loadingLabel={t('Saving…')}>{t('Save default password')}</LoadingButton>
            </form>
          </section>
        )}

        <section className="card card-outline card-info settings-card settings-role-card">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-purple"><RoleIcon size={18} /></div>
            <div>
              <h2>{t(roleSetting.label)}</h2>
              <p>{t(roleSetting.description)}</p>
            </div>
          </div>

          <div className="settings-role-list">
            {roleSetting.items.map(item => (
              <NavLink className="settings-role-item" key={item.to} to={item.to}>
                <span>{t(item.label)}</span>
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
              <p>{t('Shared clinic information.')}</p>
            </div>
          </div>

          <div className="settings-details settings-clinic-details">
            <div><span>{t('Facility')}</span><strong>Borana University Clinic</strong></div>
            <div><span>{t('Location')}</span><strong>Yabelo, Oromia, Ethiopia</strong></div>
            <div><span>{t('Database')}</span><strong className="settings-status"><span /> {t('Connected through API')}</strong></div>
          </div>
        </section>

      </div>
    </div>
  );
}
