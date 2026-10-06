import React from 'react';
import { useAuth, ACTOR_PROFILES } from '../context/AuthContext';
import type { UserRole } from '../types';
import AdminDashboard from './dashboards/AdminDashboard';
import ReceptionDashboard from './dashboards/ReceptionDashboard';
import OpdDashboard from './dashboards/OpdDashboard';
import EmergencyDashboard from './dashboards/EmergencyDashboard';
import PharmacyDashboard from './dashboards/PharmacyDashboard';
import LaboratoryDashboard from './dashboards/LaboratoryDashboard';
import {
  ShieldCheck, UserCheck, Stethoscope, HeartPulse,
  Pill, FlaskConical, ArrowRightLeft
} from 'lucide-react';
import './Dashboard.css';

const ROLE_ICONS: Record<UserRole, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties; color?: string }>> = {
  admin: ShieldCheck,
  receptionist: UserCheck,
  opd: Stethoscope,
  emergency: HeartPulse,
  pharmacy: Pill,
  laboratory: FlaskConical,
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  receptionist: 'Card Receptionist',
  opd: 'OPD (Dr. & Nurse)',
  emergency: 'Emergency (ER)',
  pharmacy: 'Pharmacy',
  laboratory: 'Laboratory',
};

export default function Dashboard() {
  const { role, switchRole, currentUser } = useAuth();

  const ActiveIcon = ROLE_ICONS[role] || ShieldCheck;

  return (
    <div className="dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── ROLE SWITCHER DEMO BANNER ── */}
      <div style={{
        background: 'rgba(15, 27, 52, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(59, 130, 246, 0.22)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.85rem 1.35rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.85rem',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(37, 99, 235, 0.35)',
            flexShrink: 0,
          }}>
            <ActiveIcon size={20} />
          </div>
          <div>
            <div style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#38bdf8',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              marginBottom: 1,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
              Active Role Session
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span>{currentUser?.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>·</span>
              <span style={{ color: '#94a3b8', fontSize: '0.84rem', fontWeight: 600 }}>
                {currentUser?.roleTitle || ROLE_LABELS[role]}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actor Switcher Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, marginRight: 2 }}>
            <ArrowRightLeft size={13} style={{ color: '#60a5fa' }} /> Switch View:
          </span>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '3px',
            borderRadius: 10,
            gap: '3px',
            flexWrap: 'wrap',
          }}>
            {(Object.keys(ACTOR_PROFILES) as UserRole[]).map((r) => {
              const Icon = ROLE_ICONS[r];
              const isActive = role === r;

              return (
                <button
                  key={r}
                  onClick={() => switchRole(r)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0.38rem 0.75rem',
                    borderRadius: 7,
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 700 : 600,
                    border: 'none',
                    background: isActive
                      ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                      : 'transparent',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.45)' : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#94a3b8';
                    }
                  }}
                >
                  <Icon size={14} style={{ color: isActive ? '#ffffff' : '#64748b' }} />
                  <span>{ROLE_LABELS[r]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RENDER DEDICATED ACTOR DASHBOARD ── */}
      {role === 'admin' && <AdminDashboard />}
      {role === 'receptionist' && <ReceptionDashboard />}
      {role === 'opd' && <OpdDashboard />}
      {role === 'emergency' && <EmergencyDashboard />}
      {role === 'pharmacy' && <PharmacyDashboard />}
      {role === 'laboratory' && <LaboratoryDashboard />}
    </div>
  );
}
