/**
 * BruClinic — Maintenance Screen
 *
 * Full-page takeover shown to staff while maintenance mode is enabled.
 * It deliberately reuses the sign-in screen's design system (background,
 * brand panel, card, typography and buttons) so it feels like part of the
 * same product rather than a separate page.
 */

import { useState } from 'react';
import { Clock, LogOut, Moon, RefreshCw, ShieldCheck, Sun, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './MaintenancePage.css';
import '../../pages/Login.css';

interface MaintenancePageProps {
  message: string;
  onRefresh: () => Promise<void>;
  onAdminAccess: () => void;
}

export default function MaintenancePage({ message, onRefresh, onAdminAccess }: MaintenancePageProps) {
  const { isAuthenticated, currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
      setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="login-page-container maintenance-page">
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
          <div className="maintenance-state" role="status" aria-live="polite">
            <span className="maintenance-badge">
              <Wrench size={13} /> Scheduled maintenance
            </span>

            <h1 className="login-form-title">We&rsquo;ll be back shortly</h1>
            <p className="login-form-sub maintenance-message">{message}</p>

            <div className="maintenance-actions">
              <button type="button" className="login-btn-submit" onClick={() => void handleRefresh()} disabled={refreshing}>
                <span>{refreshing ? 'Checking…' : 'Check again'}</span>
                <RefreshCw size={17} className={refreshing ? 'maintenance-spin' : ''} />
              </button>

              {!isAuthenticated && (
                <button type="button" className="login-btn-demo" onClick={onAdminAccess}>
                  <ShieldCheck size={15} /> Administrator sign in
                </button>
              )}

              {isAuthenticated && (
                <button type="button" className="login-btn-demo" onClick={logout}>
                  <LogOut size={15} />
                  Sign out{currentUser?.name ? ` (${currentUser.name})` : ''}
                </button>
              )}
            </div>

            <div className="maintenance-note">
              <ShieldCheck size={15} />
              <span>Patient records are safe. Clinical activity is paused until maintenance ends.</span>
            </div>

            <div className="maintenance-meta">
              <Clock size={13} />
              <span>{lastChecked ? `Last checked at ${lastChecked}` : 'Checks automatically every 30 seconds'}</span>
            </div>

            <p className="maintenance-contact">
              Urgent clinical need? Call reception on <strong>+251 46 441 0000</strong>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
