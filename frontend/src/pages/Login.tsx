import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, KeyRound, Sun, Moon, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { UserRole } from '../types';
import { validateRequired, validateTextLength } from '../utils/validation';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getValidationErrors = () => {
    const requiredErrors = validateRequired(
      { username: username.trim(), password },
      { username: 'Username', password: 'Password' },
    );
    const usernameError = validateTextLength(username, 'Username', { min: 3, max: 60, required: true });
    const passwordError = validateTextLength(password, 'Password', { min: 1, max: 128, required: true });
    return {
      ...requiredErrors,
      ...(usernameError ? { username: usernameError } : {}),
      ...(passwordError ? { password: passwordError } : {}),
    };
  };

  const validateField = (field: 'username' | 'password') => {
    const errors = getValidationErrors();
    setFieldErrors(previous => ({ ...previous, [field]: errors[field] || '' }));
  };

  const getRoleLandingPage = (role?: UserRole): string => {
    switch (role) {
      case 'admin': return '/admin';
      case 'receptionist': return '/reception';
      case 'opd': return '/opd';
      case 'emergency': return '/emergency';
      case 'pharmacy': return '/pharmacy-board';
      case 'laboratory': return '/laboratory';
      default: return '/';
    }
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    const validationErrors = getValidationErrors();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage(Object.values(validationErrors)[0]);
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await login(username, password);
      if (res.success && res.user) {
        navigate(getRoleLandingPage(res.user.role));
      } else {
        setErrorMessage(res.error || 'Invalid credentials. Please verify username and password.');
      }
    } catch {
      setErrorMessage('Could not connect to the authentication service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page-container">
      <button
        type="button"
        onClick={toggleTheme}
        className="login-theme-toggle"
        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      </button>

      <div className="login-glow-orb login-glow-1" />
      <div className="login-glow-orb login-glow-2" />

      <div className="login-card-wrapper login-simple-card">
        <section className="login-left-panel login-brand-panel" aria-label="BruClinic">
          <div className="login-brand-header">
            <img src="/bu-logo.png" alt="BruClinic logo" className="login-brand-logo" />
            <div className="login-brand-titles">
              <span className="login-brand-name">BruClinic</span>
              <span className="login-brand-sub">Borana University Clinic</span>
            </div>
          </div>

        </section>

        <section className="login-right-panel">
          <div className="login-form-header">
            <h1 className="login-form-title">Sign In</h1>
            <p className="login-form-sub">Enter your clinic credentials to access your clinical dashboard.</p>
          </div>

          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                fontSize: '0.82rem',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={17} style={{ flexShrink: 0, color: '#ef4444' }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleFormSubmit} noValidate>
            <div className="login-input-group">
              <label className="login-label" htmlFor="login-username">
                <User size={14} /> Username / Staff ID
              </label>
              <div className="login-input-wrap">
                <User size={16} className="login-input-icon" />
                <input
                  id="login-username"
                  type="text"
                  required
                  className="login-input"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setFieldErrors(previous => ({ ...previous, username: '' }));
                  }}
                  onBlur={() => validateField('username')}
                  aria-invalid={Boolean(fieldErrors.username)}
                  aria-describedby={fieldErrors.username ? 'login-username-error' : undefined}
                  placeholder="username"
                  autoComplete="username"
                  disabled={isSubmitting}
                />
              </div>
              {fieldErrors.username && <small id="login-username-error" className="login-field-error">{fieldErrors.username}</small>}
            </div>

            <div className="login-input-group">
              <label className="login-label" htmlFor="login-password">
                <Lock size={14} /> Password
              </label>
              <div className="login-input-wrap">
                <KeyRound size={16} className="login-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="login-input"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFieldErrors(previous => ({ ...previous, password: '' }));
                  }}
                  onBlur={() => validateField('password')}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                  placeholder="password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(current => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  aria-controls="login-password"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>
              {fieldErrors.password && <small id="login-password-error" className="login-field-error">{fieldErrors.password}</small>}
            </div>

            <button type="submit" className="login-btn-submit" disabled={isSubmitting}>
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight size={17} />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
