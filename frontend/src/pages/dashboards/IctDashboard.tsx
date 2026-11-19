/**
 * BruClinic – ICT Dashboard
 * System & accounts-focused dashboard for the ICT role.
 * Shows: patient count, staff accounts, security events, locked accounts, backup status.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, ShieldCheck, Users, Lock, Database, Activity,
  RefreshCw, ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import InfoBox from '../../components/AdminLTE/InfoBox';
import { apiGet } from '../../api/client';
import type { SecurityEvent } from '../../types';
import './AdminDashboard.css'; // reuse AdminDashboard base styles

// ── Role badge colours (matches backend constants/roles.js) ─────────────────
const ROLE_COLORS: Record<string, string> = {
  admin:       '#007bff',
  ict:         '#6f42c1',
  receptionist:'#17a2b8',
  opd:         '#28a745',
  emergency:   '#dc3545',
  pharmacy:    '#fd7e14',
  laboratory:  '#20c997',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc3545',
  warning:  '#ffc107',
  info:     '#17a2b8',
  low:      '#6c757d',
};

function RoleBadge({ role }: { role?: string }) {
  if (!role) return null;
  const color = ROLE_COLORS[role] ?? '#6c757d';
  return (
    <span
      className="badge"
      style={{ background: color, color: '#fff', fontSize: '0.68rem', marginRight: 4 }}
    >
      {role.toUpperCase()}
    </span>
  );
}

function SeverityBadge({ severity }: { severity?: string }) {
  const s = (severity ?? 'info').toLowerCase();
  const color = SEVERITY_COLORS[s] ?? SEVERITY_COLORS.info;
  return (
    <span
      className="badge"
      style={{
        background: color,
        color: s === 'warning' ? '#000' : '#fff',
        fontSize: '0.68rem',
      }}
    >
      {s}
    </span>
  );
}

function fmt(dateStr?: string) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ── Main component ───────────────────────────────────────────────────────────

interface SecurityEventsResponse {
  events?: SecurityEvent[];
  total?: number;
}

interface BackupMeta {
  lastBackupAt?: string;
  status?: string;
}

export default function IctDashboard() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { patients, doctors } = useClinic();

  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [backupMeta, setBackupMeta] = useState<BackupMeta>({});
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [evtsRes, staffRes, backupRes] = await Promise.allSettled([
        apiGet<SecurityEventsResponse>('/admin/security-events?limit=15&page=1', token),
        apiGet<{ staff?: unknown[] }>('/admin/staff', token),
        apiGet<{ backups?: { createdAt?: string }[] }>('/admin/backups', token),
      ]);

      if (evtsRes.status === 'fulfilled') {
        const data = evtsRes.value as SecurityEventsResponse;
        setSecurityEvents((data.events ?? (Array.isArray(data) ? data as unknown as SecurityEvent[] : [])).slice(0, 15));
      }
      if (staffRes.status === 'fulfilled') {
        const data = staffRes.value as { staff?: unknown[] };
        setStaffCount(Array.isArray(data.staff) ? data.staff.length : (Array.isArray(data) ? (data as unknown[]).length : null));
      }
      if (backupRes.status === 'fulfilled') {
        const data = backupRes.value as { backups?: { createdAt?: string }[] };
        const backups = data.backups ?? (Array.isArray(data) ? data as unknown as { createdAt?: string }[] : []);
        const last = backups[0];
        setBackupMeta({ lastBackupAt: last?.createdAt, status: 'ok' });
      }
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [token]);

  useEffect(() => {
    loadData();
    const interval = window.setInterval(loadData, 90_000); // refresh every 90 s
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const activeDocs   = doctors.filter(d => d.available).length;
  const lockedCount  = securityEvents.filter(e => e.event_type === 'AUTH_LOGIN_LOCKED').length;
  const criticalEvts = securityEvents.filter(
    e => e.severity === 'critical' || e.severity === 'warning'
  ).length;

  const kpis = [
    {
      tone: 'info' as const,
      icon: <Users size={36} />,
      label: 'Total Patients',
      value: patients.length,
      detail: 'registered in system',
    },
    {
      tone: 'primary' as const,
      icon: <ShieldCheck size={36} />,
      label: 'Staff Accounts',
      value: staffCount ?? '—',
      detail: 'active staff users',
      to: '/staff-accounts',
      footerText: 'Manage accounts',
    },
    {
      tone: 'success' as const,
      icon: <Activity size={36} />,
      label: 'Available Doctors',
      value: activeDocs,
      detail: `of ${doctors.length} total`,
    },
    {
      tone: 'danger' as const,
      icon: <ShieldAlert size={36} />,
      label: 'Security Alerts',
      value: criticalEvts,
      detail: 'in recent events',
      to: '/security',
      footerText: 'View Security Center',
    },
    {
      tone: 'warning' as const,
      icon: <Lock size={36} />,
      label: 'Locked Accounts',
      value: lockedCount,
      detail: 'from failed logins',
      to: '/staff-accounts',
      footerText: 'Manage accounts',
    },
    {
      tone: 'secondary' as const,
      icon: <Database size={36} />,
      label: 'Last Backup',
      value: backupMeta.lastBackupAt
        ? new Date(backupMeta.lastBackupAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })
        : '—',
      detail: backupMeta.lastBackupAt
        ? new Date(backupMeta.lastBackupAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
        : 'No backup yet',
      to: '/backup',
      footerText: 'Backup & Restore',
    },
  ];

  return (
    <div className="admin-dashboard">
      {/* ── Header ── */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-0 fw-semibold" style={{ color: 'var(--clr-text-primary, #333)' }}>
            ICT Dashboard
          </h4>
          <small style={{ color: 'var(--clr-text-muted, #888)' }}>
            System &amp; accounts overview
            {lastRefresh && ` · Updated ${lastRefresh.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`}
          </small>
        </div>
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={loadData}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span className="ms-1 d-none d-sm-inline">Refresh</span>
        </button>
      </div>

      {/* ── KPI Row ── */}
      <div className="row g-3 mb-4">
        {kpis.map((kpi, i) => (
          <div className="col-6 col-lg-4 col-xl-2" key={i}>
            <InfoBox
              tone={kpi.tone}
              icon={kpi.icon}
              label={kpi.label}
              value={loading && typeof kpi.value === 'number' ? '…' : kpi.value}
              detail={kpi.detail}
              to={kpi.to}
              footerText={kpi.footerText ?? 'Info'}
            />
          </div>
        ))}
      </div>

      {/* ── Recent Security Events table ── */}
      <div className="card card-outline card-danger mb-4">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h3 className="card-title mb-0">
            <ShieldAlert size={16} className="me-2" />
            Recent Security Events
          </h3>
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={() => navigate('/security')}
          >
            <ExternalLink size={13} className="me-1" />
            Full Log
          </button>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="p-3 text-center text-muted small">Loading events…</div>
          ) : securityEvents.length === 0 ? (
            <div className="p-3 text-center text-muted small">No recent security events.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead style={{ background: 'var(--admin-card-header-bg, #f8f9fa)' }}>
                  <tr>
                    <th className="ps-3" style={{ width: 140 }}>Time</th>
                    <th>Event</th>
                    <th>Actor</th>
                    <th style={{ width: 90 }}>Severity</th>
                    <th className="pe-3" style={{ width: 130 }}>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {securityEvents.map((evt, i) => (
                    <tr key={evt.id ?? i}>
                      <td className="ps-3 text-muted small">{fmt(evt.created_at)}</td>
                      <td>
                        <span className="fw-semibold small">
                          {evt.event_type?.replace(/_/g, ' ') ?? '—'}
                        </span>
                        {evt.description && (
                          <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                            {evt.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <RoleBadge role={evt.user_role || (evt.metadata as Record<string, string> | null)?.userRole} />
                        <span className="small">{evt.username ?? '—'}</span>
                      </td>
                      <td>
                        <SeverityBadge severity={evt.severity} />
                      </td>
                      <td className="pe-3 text-muted small font-monospace">
                        {evt.ip_address ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Links ── */}
      <div className="row g-3">
        {[
          { label: 'Security Center', to: '/security', icon: ShieldAlert, color: '#dc3545' },
          { label: 'Staff Accounts',  to: '/staff-accounts', icon: ShieldCheck, color: '#007bff' },
          { label: 'Backup & Restore', to: '/backup', icon: Database, color: '#6c757d' },
        ].map(({ label, to, icon: Icon, color }) => (
          <div className="col-12 col-md-4" key={to}>
            <div
              className="card card-outline h-100"
              style={{ borderTopColor: color, cursor: 'pointer' }}
              onClick={() => navigate(to)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(to)}
            >
              <div className="card-body d-flex align-items-center gap-3">
                <span style={{ color }}>
                  <Icon size={28} />
                </span>
                <span className="fw-semibold">{label}</span>
                <ExternalLink size={13} className="ms-auto text-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
