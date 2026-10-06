import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ACTOR_PROFILES } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { UserRole } from '../types';
import {
  ShieldCheck, UserCheck, Stethoscope, HeartPulse,
  Pill, FlaskConical, Lock, User, ArrowRight,
  Sparkles, CheckCircle2, KeyRound, Sun, Moon
} from 'lucide-react';
import './Login.css';

const ROLE_ICONS: Record<UserRole, React.ComponentType<{ size?: number; className?: string }>> = {
  admin: ShieldCheck,
  receptionist: UserCheck,
  opd: Stethoscope,
  emergency: HeartPulse,
  pharmacy: Pill,
  laboratory: FlaskConical,
};

const ROLE_NAMES: Record<UserRole, string> = {
  admin: 'Dr. Amanuel Wario',
  receptionist: 'Chaltu Dida',
  opd: 'Dr. Bikila Negassa',
  emergency: 'Dr. Teshome Galgalo',
  pharmacy: 'Pharm. Hawi Tadesse',
  laboratory: 'Lab Tech. Geda Boru',
};

const ROLE_SUBTITLES: Record<UserRole, string> = {
  admin: 'Medical Director',
  receptionist: 'Card Room Registrar',
  opd: 'OPD Senior Physician',
  emergency: 'Emergency Trauma Specialist',
  pharmacy: 'Chief Clinical Pharmacist',
  laboratory: 'Senior Laboratory Technologist',
};

export default function Login() {
  const { login, loginAsRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [username, setUsername] = useState(ACTOR_PROFILES.admin.username);
  const [password, setPassword] = useState('password123');

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setUsername(ACTOR_PROFILES[role].username);
    setPassword('demo2026');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(username, password);
    navigate('/');
  };

  const handleQuickLogin = (role: UserRole) => {
    loginAsRole(role);
    navigate('/');
  };

  const currentProfile = ACTOR_PROFILES[selectedRole];
  const CurrentIcon = ROLE_ICONS[selectedRole];

  return (
    <div className="login-page-container">
      {/* Theme Toggle Button */}
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

      <div className="login-card-wrapper">
        {/* ── LEFT: Role Selector & Clinic Identity ── */}
        <div className="login-left-panel">
          <div>
            <div className="login-brand-header">
              <img src="/bu-logo.png" alt="Borana University" className="login-brand-logo" />
              <div className="login-brand-titles">
                <span className="login-brand-name">BruClinic</span>
                <span className="login-brand-sub">Borana University Health Services</span>
                <span className="login-brand-motto">Role-Based Medical Access</span>
              </div>
            </div>

            <div className="login-actors-intro">
              <h3>
                <Sparkles size={16} className="text-primary" />
                Select an Actor for Access
              </h3>
              <p>Click any of the 6 roles below to test and preview that specialized dashboard:</p>
            </div>

            <div className="login-actors-grid">
              {(Object.keys(ACTOR_PROFILES) as UserRole[]).map((r) => {
                const p = ACTOR_PROFILES[r];
                const Icon = ROLE_ICONS[r];
                const isSelected = selectedRole === r;

                return (
                  <button
                    key={r}
                    type="button"
                    className={`login-actor-card ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectRole(r)}
                  >
                    <div className="login-actor-card-top">
                      <div
                        className="actor-icon-bubble"
                        style={{ background: `${p.badgeColor}22`, color: p.badgeColor }}
                      >
                        <Icon size={17} />
                      </div>
                      <span
                        className="actor-tag"
                        style={{
                          background: `${p.badgeColor}22`,
                          color: p.badgeColor,
                          border: `1px solid ${p.badgeColor}44`,
                        }}
                      >
                        {r.toUpperCase()}
                      </span>
                    </div>
                    <div className="actor-title">{ROLE_NAMES[r]}</div>
                    <div className="actor-name">{ROLE_SUBTITLES[r]}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="login-left-footer">
            <span>Yabelo Campus Clinic · Borana Zone, Ethiopia</span>
            <span style={{ color: 'var(--clr-emerald-400)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={12} /> System Online
            </span>
          </div>
        </div>

        {/* ── RIGHT: Authentication Form ── */}
        <div className="login-right-panel">
          <div className="login-form-header">
            <h2 className="login-form-title">Medical Staff Portal</h2>
            <p className="login-form-sub">
              Sign in with your assigned institutional credentials
            </p>
          </div>

          {/* Active selection summary */}
          <div className="login-selected-badge" style={{ marginBottom: '1.25rem' }}>
            <div style={{ color: currentProfile.badgeColor }}>
              <CurrentIcon size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>
                {currentProfile.name}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--clr-text-muted)' }}>
                {currentProfile.roleTitle} · {currentProfile.department}
              </div>
            </div>
          </div>

          <form className="login-form" onSubmit={handleFormSubmit}>
            <div className="login-input-group">
              <label className="login-label">
                <User size={14} /> Username / Staff ID
              </label>
              <div className="login-input-wrap">
                <User size={16} className="login-input-icon" />
                <input
                  type="text"
                  required
                  className="login-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter staff username"
                />
              </div>
            </div>

            <div className="login-input-group">
              <label className="login-label">
                <Lock size={14} /> Password
              </label>
              <div className="login-input-wrap">
                <KeyRound size={16} className="login-input-icon" />
                <input
                  type="password"
                  required
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter secure password"
                />
              </div>
            </div>

            <button type="submit" className="login-btn-submit">
              <span>Sign In as {selectedRole.toUpperCase()}</span>
              <ArrowRight size={17} />
            </button>

            <button
              type="button"
              className="login-btn-demo"
              onClick={() => handleQuickLogin(selectedRole)}
            >
              <Sparkles size={16} />
              1-Click Instant Demo Login
            </button>
          </form>

          <div className="login-security-notice">
            <ShieldCheck size={14} style={{ color: 'var(--clr-emerald-400)' }} />
            <span>Encrypted Borana University Intranet · Protected Health Information</span>
          </div>
        </div>
      </div>
    </div>
  );
}
