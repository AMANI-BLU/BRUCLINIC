/**
 * BruClinic — Banned IP Access Denied Screen
 *
 * Full-page security takeover shown when a device's IP address
 * has been banned by clinic security administration.
 */

import { useState } from 'react';
import { ShieldAlert, RefreshCw, Sun, Moon, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelect from '../components/LanguageSelect';
import { checkIpBanStatus } from '../api/client';
import './BannedPage.css';
import './Login.css';

interface BannedPageProps {
  ip?: string;
  message?: string;
  onClear?: () => void;
}

export default function BannedPage({ ip, message, onClear }: BannedPageProps) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [checking, setChecking] = useState(false);
  const [statusResult, setStatusResult] = useState<{ checked: boolean; stillBanned: boolean } | null>(null);

  const displayIp = ip || 'Your Network IP';
  const displayMessage = message || 'Your IP address has been banned by clinic security administration.';

  const handleCheckStatus = async () => {
    setChecking(true);
    setStatusResult(null);
    try {
      const res = await checkIpBanStatus();
      if (!res.banned) {
        setStatusResult({ checked: true, stillBanned: false });
        setTimeout(() => {
          if (onClear) onClear();
          window.location.href = '/login';
        }, 1200);
      } else {
        setStatusResult({ checked: true, stillBanned: true });
      }
    } catch {
      setStatusResult({ checked: true, stillBanned: true });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="banned-page-container">
      <div className="login-utility-controls">
        <LanguageSelect className="language-select--login" />
        <button
          type="button"
          onClick={toggleTheme}
          className="login-theme-toggle"
          title={`${t('Switch to')} ${theme === 'dark' ? t('Light') : t('Dark')} ${t('mode')}`}
          aria-label={t('Toggle theme')}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span>{theme === 'dark' ? t('Light mode') : t('Dark mode')}</span>
        </button>
      </div>

      <div className="banned-glow-orb banned-glow-1" />
      <div className="banned-glow-orb banned-glow-2" />

      <main className="banned-card">
        <div className="banned-badge-container">
          <span className="banned-code-badge">
            <AlertOctagon size={13} /> 403 Forbidden · Access Denied
          </span>
        </div>

        <div className="banned-icon-wrap" aria-hidden="true">
          <ShieldAlert size={38} />
        </div>

        <h1 className="banned-title">Access Restricted: IP Banned</h1>
        <p className="banned-message">
          {displayMessage}
        </p>

        <div className="banned-details-box">
          <div className="banned-detail-row">
            <span className="banned-detail-label">Client IP Address:</span>
            <span className="banned-detail-value">{displayIp}</span>
          </div>
          <div className="banned-detail-row">
            <span className="banned-detail-label">Restriction Level:</span>
            <span className="banned-detail-value" style={{ color: '#ef4444' }}>Global IP Ban</span>
          </div>
          <div className="banned-detail-row">
            <span className="banned-detail-label">Status:</span>
            <span className="banned-detail-value">
              {statusResult?.checked && !statusResult.stillBanned ? (
                <span style={{ color: '#22c55e' }}>Unbanned</span>
              ) : (
                <span style={{ color: '#ef4444' }}>Enforced (Blocked)</span>
              )}
            </span>
          </div>
          <div className="banned-detail-row">
            <span className="banned-detail-label">Authority:</span>
            <span className="banned-detail-value">Borana University ICT Security</span>
          </div>
        </div>

        {statusResult?.checked && !statusResult.stillBanned && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            marginBottom: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#22c55e',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}>
            <CheckCircle2 size={16} /> IP Ban has been lifted! Redirecting to sign in...
          </div>
        )}

        <div className="banned-actions">
          <button
            type="button"
            className="banned-btn-check"
            onClick={handleCheckStatus}
            disabled={checking}
          >
            <RefreshCw size={16} className={checking ? 'banned-spin' : ''} />
            <span>{checking ? 'Checking IP status...' : 'Check IP Status / Try Again'}</span>
          </button>
        </div>

        <p className="banned-help-text">
          If you are an authorized staff member and this restriction was applied in error, please contact the{' '}
          <strong>Borana University ICT Department</strong> or <strong>System Administrator</strong> to review and unban your IP.
        </p>
      </main>
    </div>
  );
}
