/**
 * BruClinic — Security Center (Admin Only)
 *
 * Full-featured security and compliance dashboard with four tabs:
 *   1. Overview      — real-time security stats and system health
 *   2. Audit Log     — searchable, filterable audit trail
 *   3. Security Events — authentication and authorization incidents
 *   4. System Config — editable clinic-wide runtime configuration
 */

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  ShieldCheck, AlertTriangle, Activity, Settings2, RefreshCw,
  Search, Lock, UserX, UserCheck, LogIn, LogOut, Trash2,
  Database, Cpu, Clock, Users, ChevronLeft,
  ChevronRight, Save, Info, AlertCircle, CheckCircle, Zap, Globe,
  Server, FileText, ShieldOff, Ban, X, Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMaintenance } from '../context/MaintenanceContext';
import { apiGet, apiPatch, apiPost, apiDelete } from '../api/client';
import type { AuditLog, SecurityEvent, SystemConfig, HealthStatus, SecurityStats, BannedIp } from '../types';
import { firstError, validateNumber, validateTextLength } from '../utils/validation';
import './SecurityCenter.css';

// ── Types ─────────────────────────────────────────────────────────

type TabId = 'overview' | 'audit' | 'events' | 'config' | 'bans';

interface PageState {
  limit: number;
  offset: number;
  total: number;
}

// ── Constants ─────────────────────────────────────────────────────

const EVENT_ICONS: Record<string, typeof ShieldCheck> = {
  AUTH_LOGIN_SUCCESS: LogIn,
  AUTH_LOGIN_FAILURE: AlertTriangle,
  AUTH_LOGIN_LOCKED: Lock,
  AUTH_LOGOUT: LogOut,
  AUTHZ_ACCESS_DENIED: AlertCircle,
  ACCOUNT_CREATED: UserCheck,
  ACCOUNT_DELETED: Trash2,
  ACCOUNT_DEACTIVATED: UserX,
  RATE_LIMIT_EXCEEDED: Zap,
  RATE_LIMIT_AUTH: Zap,
  SYSTEM_CONFIG_CHANGED: Settings2,
  SECURITY_IP_BANNED: ShieldOff,
  SECURITY_IP_UNBANNED: ShieldCheck,
};

const AUDIT_ACTION_COLORS: Record<string, string> = {
  CREATE: 'var(--admin-success, #28a745)',
  UPDATE: 'var(--admin-info, #17a2b8)',
  DELETE: 'var(--admin-danger, #dc3545)',
  LOGIN:  'var(--admin-primary, #007bff)',
  LOGOUT: 'var(--clr-text-muted)',
  CONFIG: 'var(--admin-warning, #ffc107)',
  WORKFLOW: 'var(--clr-violet-400, #a78bfa)',
};

// ── Sub-components ────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, loading }: {
  icon: typeof ShieldCheck; label: string; value: number | string; sub?: string;
  color: string; loading?: boolean;
}) {
  return (
    <div className="sc-stat-card">
      <div className="sc-stat-icon" style={{ background: color + '20', color }}>
        <Icon size={20} />
      </div>
      <div className="sc-stat-body">
        <div className="sc-stat-value">{loading ? '—' : value}</div>
        <div className="sc-stat-label">{label}</div>
        {sub && <div className="sc-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    info: 'sc-badge-info',
    warning: 'sc-badge-warning',
    critical: 'sc-badge-critical',
  };
  return <span className={`sc-badge ${map[severity] || 'sc-badge-info'}`}>{severity}</span>;
}

const ROLE_BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  admin: { bg: '#007bff20', color: '#007bff' },
  ict: { bg: '#6f42c120', color: '#6f42c1' },
  receptionist: { bg: '#17a2b820', color: '#17a2b8' },
  opd: { bg: '#28a74520', color: '#28a745' },
  emergency: { bg: '#dc354520', color: '#dc3545' },
  pharmacy: { bg: '#fd7e1420', color: '#fd7e14' },
  laboratory: { bg: '#20c99720', color: '#20c997' },
};

function ActorBadge({ role }: { role?: string | null }) {
  if (!role) return null;
  const style = ROLE_BADGE_STYLE[role.toLowerCase()] || { bg: '#6c757d20', color: '#6c757d' };
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '0.68rem',
        fontWeight: 600,
        padding: '0.1rem 0.4rem',
        borderRadius: '3px',
        backgroundColor: style.bg,
        color: style.color,
        border: `1px solid ${style.color}40`,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      }}
    >
      {role}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span className="sc-action-badge" style={{ color: AUDIT_ACTION_COLORS[action] || 'inherit' }}>
      {action}
    </span>
  );
}

function Pagination({ page, onChange }: { page: PageState; onChange: (offset: number) => void }) {
  const totalPages = Math.ceil(page.total / page.limit);
  const currentPage = Math.floor(page.offset / page.limit) + 1;
  if (totalPages <= 1) return null;
  return (
    <div className="sc-pagination">
      <span className="sc-pagination-info">
        Showing {page.offset + 1}–{Math.min(page.offset + page.limit, page.total)} of {page.total}
      </span>
      <div className="sc-pagination-controls">
        <button className="sc-btn-icon" onClick={() => onChange(page.offset - page.limit)} disabled={page.offset === 0}>
          <ChevronLeft size={16} />
        </button>
        <span>{currentPage} / {totalPages}</span>
        <button className="sc-btn-icon" onClick={() => onChange(page.offset + page.limit)} disabled={page.offset + page.limit >= page.total}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────

export default function SecurityCenter() {
  const { token } = useAuth();
  const { refresh: refreshMaintenance } = useMaintenance();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // ── Overview State ─────────────────────────────────────────────
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Audit Log State ────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPage, setAuditPage] = useState<PageState>({ limit: 25, offset: 0, total: 0 });
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);

  // ── Security Events State ──────────────────────────────────────
  const [secEvents, setSecEvents] = useState<SecurityEvent[]>([]);
  const [secPage, setSecPage] = useState<PageState>({ limit: 25, offset: 0, total: 0 });
  const [secSearch, setSecSearch] = useState('');
  const [secSeverityFilter, setSecSeverityFilter] = useState('');
  const [secLoading, setSecLoading] = useState(false);

  // ── Config State ───────────────────────────────────────────────
  const [config, setConfig] = useState<SystemConfig[]>([]);
  const [configEdits, setConfigEdits] = useState<Record<string, string>>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── Banned IPs State ───────────────────────────────────────────
  const [bannedIps, setBannedIps] = useState<BannedIp[]>([]);
  const [bannedLoading, setBannedLoading] = useState(false);
  const [bannedSearch, setBannedSearch] = useState('');
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [banIpInput, setBanIpInput] = useState('');
  const [banReasonInput, setBanReasonInput] = useState('');
  const [banDuration, setBanDuration] = useState('24h');
  const [banSubmitting, setBanSubmitting] = useState(false);
  const [banModalError, setBanModalError] = useState<string | null>(null);
  const [unbanningIp, setUnbanningIp] = useState<string | null>(null);

  // ── Data fetchers ──────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [h, s] = await Promise.all([
        apiGet<HealthStatus>('/health', null),
        apiGet<{ data: SecurityStats }>('/admin/stats', token),
      ]);
      setHealth(h);
      setStats(s.data);
    } catch (_) {}
    setStatsLoading(false);
  }, [token]);

  const fetchAuditLogs = useCallback(async (offset = 0) => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(offset) });
      if (auditSearch) params.set('search', auditSearch);
      if (auditActionFilter) params.set('action', auditActionFilter);
      const res = await apiGet<{ data: AuditLog[]; total: number }>(`/admin/audit-logs?${params}`, token);
      setAuditLogs(res.data);
      setAuditPage(p => ({ ...p, offset, total: res.total }));
    } catch (_) {}
    setAuditLoading(false);
  }, [token, auditSearch, auditActionFilter]);

  const fetchSecEvents = useCallback(async (offset = 0) => {
    setSecLoading(true);
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(offset) });
      if (secSearch) params.set('search', secSearch);
      if (secSeverityFilter) params.set('severity', secSeverityFilter);
      const res = await apiGet<{ data: SecurityEvent[]; total: number }>(`/admin/security-events?${params}`, token);
      setSecEvents(res.data);
      setSecPage(p => ({ ...p, offset, total: res.total }));
    } catch (_) {}
    setSecLoading(false);
  }, [token, secSearch, secSeverityFilter]);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await apiGet<{ data: SystemConfig[] }>('/admin/config', token);
      setConfig(res.data);
      setConfigEdits({});
    } catch (_) {}
    setConfigLoading(false);
  }, [token]);

  const fetchBannedIps = useCallback(async () => {
    setBannedLoading(true);
    try {
      const res = await apiGet<{ data: BannedIp[] }>('/admin/ip-bans', token);
      setBannedIps(res.data || []);
    } catch (_) {}
    setBannedLoading(false);
  }, [token]);

  // ── Effects ────────────────────────────────────────────────────

  useEffect(() => { if (activeTab === 'overview') fetchOverview(); }, [activeTab, fetchOverview]);
  useEffect(() => { if (activeTab === 'audit') fetchAuditLogs(0); }, [activeTab, auditSearch, auditActionFilter]);
  useEffect(() => { if (activeTab === 'events') fetchSecEvents(0); }, [activeTab, secSearch, secSeverityFilter]);
  useEffect(() => { if (activeTab === 'config') fetchConfig(); }, [activeTab, fetchConfig]);
  useEffect(() => { if (activeTab === 'bans') fetchBannedIps(); }, [activeTab, fetchBannedIps]);

  // ── Ban / Unban actions ────────────────────────────────────────

  const openBanModal = (ip = '') => {
    setBanIpInput(ip);
    setBanReasonInput(ip ? 'Repeated suspicious activity / failed logins' : '');
    setBanDuration('24h');
    setBanModalError(null);
    setBanModalOpen(true);
  };

  const handleBanSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanIp = banIpInput.trim();
    if (!cleanIp) {
      setBanModalError('Please enter a valid IP address.');
      return;
    }
    if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp.toLowerCase() === 'localhost') {
      setBanModalError('Localhost loopback addresses cannot be banned.');
      return;
    }

    setBanSubmitting(true);
    setBanModalError(null);

    let expiresAt: string | null = null;
    const now = Date.now();
    if (banDuration === '1h') expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
    else if (banDuration === '24h') expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    else if (banDuration === '7d') expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    else if (banDuration === '30d') expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    else if (banDuration === 'permanent') expiresAt = null;

    try {
      await apiPost('/admin/ip-bans', {
        ipAddress: cleanIp,
        reason: banReasonInput.trim() || 'Banned by security administrator',
        expiresAt,
      }, token);

      setBanModalOpen(false);
      await Promise.all([fetchBannedIps(), fetchOverview()]);
      if (activeTab === 'events') fetchSecEvents(secPage.offset);
    } catch (err: unknown) {
      setBanModalError(err instanceof Error ? err.message : 'Failed to ban IP address');
    } finally {
      setBanSubmitting(false);
    }
  };

  const handleUnban = async (ip: string) => {
    if (!window.confirm(`Are you sure you want to unban IP address ${ip}?`)) return;
    setUnbanningIp(ip);
    try {
      await apiDelete(`/admin/ip-bans/${encodeURIComponent(ip)}`, token);
      await Promise.all([fetchBannedIps(), fetchOverview()]);
      if (activeTab === 'events') fetchSecEvents(secPage.offset);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to unban IP address');
    } finally {
      setUnbanningIp(null);
    }
  };

  const filteredBans = bannedIps.filter(b => {
    if (!bannedSearch.trim()) return true;
    const term = bannedSearch.toLowerCase();
    return b.ip_address.toLowerCase().includes(term) ||
      (b.reason && b.reason.toLowerCase().includes(term)) ||
      (b.banned_by && b.banned_by.toLowerCase().includes(term));
  });

  // ── Config save ────────────────────────────────────────────────

  const saveConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (configSaving) return;
    if (!Object.keys(configEdits).length) return;
    const validationError = firstError(...Object.entries(configEdits).map(([key, value]) => {
      if (key === 'session_timeout_hours') return validateNumber(value, 'Session timeout', { min: 1, max: 72, integer: true, required: true });
      if (key === 'max_login_attempts') return validateNumber(value, 'Maximum login attempts', { min: 3, max: 20, integer: true, required: true });
      if (key === 'login_lockout_minutes') return validateNumber(value, 'Login lockout minutes', { min: 1, max: 60, integer: true, required: true });
      if (key === 'audit_log_retention_days') return validateNumber(value, 'Audit log retention', { min: 90, integer: true, required: true });
      if (key === 'security_event_retention_days') return validateNumber(value, 'Security event retention', { min: 30, integer: true, required: true });
      if (key === 'maintenance_mode' && value !== 'true' && value !== 'false') return 'Maintenance mode must be On or Off.';
      return validateTextLength(value, key, { max: 255 });
    }));
    if (validationError) {
      setConfigMsg({ text: validationError, type: 'error' });
      return;
    }
    setConfigSaving(true);
    setConfigMsg(null);
    try {
      await apiPatch('/admin/config', configEdits, token);
      const nextLockMinutes = Number.parseInt(configEdits.login_lockout_minutes || '', 10);
      if (Number.isFinite(nextLockMinutes) && nextLockMinutes >= 1 && nextLockMinutes <= 60) {
        // Keep the current browser session in sync with the setting just saved.
        localStorage.setItem('bruclinic:idle_lock_minutes', String(nextLockMinutes));
      }
      setConfigMsg({ text: 'Configuration saved successfully.', type: 'success' });
      await Promise.all([fetchConfig(), refreshMaintenance()]);
    } catch (err: unknown) {
      setConfigMsg({ text: err instanceof Error ? err.message : 'Save failed', type: 'error' });
    }
    setConfigSaving(false);
  };

  // ── Helpers ────────────────────────────────────────────────────

  function formatTime(ts: string | null) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('en-US', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
      });
    } catch { return ts; }
  }

  function eventTypeLabel(code: string) {
    return code.replace(/^[A-Z]+_/, '').replace(/_/g, ' ');
  }

  const EventIcon = (code: string) => {
    const Ic = EVENT_ICONS[code] || ShieldCheck;
    return <Ic size={14} />;
  };

  // ── Status pill for health ─────────────────────────────────────
  const healthColor = health?.status === 'healthy'  ? 'var(--admin-success, #28a745)'
    : health?.status === 'degraded' ? 'var(--admin-warning, #ffc107)' : 'var(--admin-danger, #dc3545)';

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="security-center">
      {/* Page Header */}
      <div className="page-header sc-page-header">
        <div>
          <h1 className="page-title">Security Center</h1>
          <p className="page-subtitle">Audit logs, security events, and system health.</p>
        </div>
        <button className="sc-refresh-btn" onClick={() => {
          if (activeTab === 'overview') fetchOverview();
          else if (activeTab === 'audit') fetchAuditLogs(auditPage.offset);
          else if (activeTab === 'events') fetchSecEvents(secPage.offset);
          else if (activeTab === 'bans') fetchBannedIps();
          else fetchConfig();
        }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="sc-tabs">
        {([
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'audit', label: 'Audit Log', icon: FileText },
          { id: 'events', label: 'Security Events', icon: ShieldCheck },
          { id: 'bans', label: 'Banned IPs', icon: ShieldOff },
          { id: 'config', label: 'System Config', icon: Settings2 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`sc-tab ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ──────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="sc-tab-content">
          {/* System Health */}
          <section className="card sc-section">
            <div className="sc-section-header">
              <h2><Server size={16} /> System Health</h2>
              <div className="sc-health-pill" style={{ background: healthColor + '20', color: healthColor }}>
                ● {health?.status || 'Checking...'}
              </div>
            </div>
            <div className="sc-health-grid">
              <div className="sc-health-item">
                <span className="sc-health-label"><Database size={14} /> Database</span>
                <span className={`sc-health-value ${health?.database?.connected ? 'ok' : 'err'}`}>
                  {health ? (health.database?.connected ? 'Connected' : `Disconnected — ${health.database?.reason || ''}`) : '…'}
                </span>
              </div>
              <div className="sc-health-item">
                <span className="sc-health-label"><FileText size={14} /> Schema version</span>
                <span className="sc-health-value">{health?.database?.schemaVersion || '—'}</span>
              </div>
              <div className="sc-health-item">
                <span className="sc-health-label"><Clock size={14} /> Uptime</span>
                <span className="sc-health-value">{health?.uptime?.human || '—'}</span>
              </div>
              <div className="sc-health-item">
                <span className="sc-health-label"><Cpu size={14} /> Memory (heap)</span>
                <span className="sc-health-value">{health ? `${health.memory.heapUsedMb} MB` : '—'}</span>
              </div>
              <div className="sc-health-item">
                <span className="sc-health-label"><Globe size={14} /> Environment</span>
                <span className="sc-health-value">{health?.environment || '—'}</span>
              </div>
              <div className="sc-health-item">
                <span className="sc-health-label"><Info size={14} /> API version</span>
                <span className="sc-health-value">{health?.version || '—'}</span>
              </div>
            </div>
          </section>

          {/* Security Stats */}
          <section className="sc-stats-grid">
            <StatCard icon={LogIn} label="Successful Logins (24h)" value={stats?.last24h.successfulLogins ?? 0}
              color="var(--admin-success, #28a745)" loading={statsLoading} />
            <StatCard icon={AlertTriangle} label="Failed Logins (24h)" value={stats?.last24h.failedLogins ?? 0}
              color="var(--admin-warning, #ffc107)" loading={statsLoading} />
            <StatCard icon={Zap} label="Critical Events (24h)" value={stats?.last24h.criticalSecurityEvents ?? 0}
              color="var(--admin-danger, #dc3545)" loading={statsLoading} />
            <StatCard icon={ShieldOff} label="Banned IPs" value={stats?.bannedIpCount ?? 0}
              color="var(--clr-rose-500, #e11d48)" loading={statsLoading} />
            <StatCard icon={FileText} label="Audit Actions (24h)" value={stats?.last24h.auditActions ?? 0}
              color="var(--admin-primary, #007bff)" loading={statsLoading} />
            <StatCard icon={Users} label="Active Staff" value={stats?.activeStaffCount ?? 0}
              color="var(--admin-info, #17a2b8)" loading={statsLoading} />
          </section>

          {/* Top failed IPs + Recent lockouts */}
          <div className="sc-overview-bottom">
            <section className="card sc-section sc-table-section">
              <div className="sc-section-header"><h2><AlertTriangle size={16} /> Top Failed Login IPs (24h)</h2></div>
              {statsLoading ? <div className="sc-loading">Loading…</div> : (
                <table className="sc-table">
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th>Failed Attempts</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.topFailedLoginIps || []).length === 0
                      ? <tr><td colSpan={3} className="sc-empty">No failed logins in the last 24 hours</td></tr>
                      : stats!.topFailedLoginIps.map(ip => {
                        const isLoop = ip.ip_address === '127.0.0.1' || ip.ip_address === '::1' || ip.ip_address === 'localhost';
                        return (
                          <tr key={ip.ip_address}>
                            <td><code>{ip.ip_address}</code></td>
                            <td><span className="sc-count">{ip.count}</span></td>
                            <td style={{ textAlign: 'right' }}>
                              {isLoop ? (
                                <span className="sc-tag-pill muted">Loopback</span>
                              ) : ip.is_banned ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span className="sc-tag-pill danger">Banned</span>
                                  <button
                                    type="button"
                                    className="sc-btn-xs danger-outline"
                                    onClick={() => handleUnban(ip.ip_address)}
                                    disabled={unbanningIp === ip.ip_address}
                                  >
                                    Unban
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="sc-btn-xs danger"
                                  onClick={() => openBanModal(ip.ip_address)}
                                >
                                  <Ban size={12} /> Ban IP
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </section>

            <section className="card sc-section sc-table-section">
              <div className="sc-section-header"><h2><Lock size={16} /> Recent Lockouts</h2></div>
              {statsLoading ? <div className="sc-loading">Loading…</div> : (
                <table className="sc-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>IP</th>
                      <th>Time</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.recentLockouts || []).length === 0
                      ? <tr><td colSpan={4} className="sc-empty">No recent lockouts</td></tr>
                      : stats!.recentLockouts.map(ev => {
                        const evIp = ev.ip_address;
                        const isLoop = !evIp || evIp === '127.0.0.1' || evIp === '::1' || evIp === 'localhost';
                        return (
                          <tr key={ev.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>{ev.username || '—'}</span>
                                <ActorBadge role={ev.user_role || ((ev.metadata as Record<string, unknown> | null)?.userRole as string)} />
                              </div>
                            </td>
                            <td><code>{ev.ip_address || '—'}</code></td>
                            <td className="sc-time">{formatTime(ev.created_at)}</td>
                            <td style={{ textAlign: 'right' }}>
                              {isLoop ? null : ev.is_banned ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span className="sc-tag-pill danger">Banned</span>
                                  <button
                                    type="button"
                                    className="sc-btn-xs danger-outline"
                                    onClick={() => handleUnban(evIp!)}
                                    disabled={unbanningIp === evIp}
                                  >
                                    Unban
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="sc-btn-xs danger"
                                  onClick={() => openBanModal(evIp!)}
                                >
                                  <Ban size={12} /> Ban IP
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ── Tab: Audit Log ──────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="sc-tab-content">
          <section className="card sc-section sc-full-section">
            <div className="sc-section-header">
              <h2><FileText size={16} /> Audit Trail</h2>
              <div className="sc-filters">
                <div className="sc-search">
                  <Search size={14} />
                  <input placeholder="Search user, resource, summary…"
                    value={auditSearch} onChange={e => setAuditSearch(e.target.value)} />
                </div>
                <select value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)}>
                  <option value="">All actions</option>
                  {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'WORKFLOW', 'CONFIG'].map(a =>
                    <option key={a} value={a}>{a}</option>
                  )}
                </select>
              </div>
            </div>

            {auditLoading ? <div className="sc-loading">Loading audit logs…</div> : (
              <>
                <div className="sc-table-scroll">
                  <table className="sc-table sc-audit-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Resource</th>
                        <th>Summary</th>
                        <th>IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length === 0
                        ? <tr><td colSpan={6} className="sc-empty">No audit log entries found</td></tr>
                        : auditLogs.map(log => (
                          <tr key={log.id}>
                            <td className="sc-time">{formatTime(log.created_at)}</td>
                            <td>
                              <div className="sc-user-cell">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <strong>{log.username || '—'}</strong>
                                  <ActorBadge role={log.user_role} />
                                </div>
                                {log.user_display_name && <small>{log.user_display_name}</small>}
                              </div>
                            </td>
                            <td><ActionBadge action={log.action} /></td>
                            <td>
                              <div className="sc-resource-cell">
                                <span>{log.resource}</span>
                                {log.resource_id && <code>{log.resource_id}</code>}
                              </div>
                            </td>
                            <td className="sc-summary">{log.summary || '—'}</td>
                            <td><code className="sc-ip">{log.ip_address || '—'}</code></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={auditPage} onChange={fetchAuditLogs} />
              </>
            )}
          </section>
        </div>
      )}

      {/* ── Tab: Security Events ────────────────────────────────── */}
      {activeTab === 'events' && (
        <div className="sc-tab-content">
          <section className="card sc-section sc-full-section">
            <div className="sc-section-header">
              <h2><ShieldCheck size={16} /> Security Events</h2>
              <div className="sc-filters">
                <div className="sc-search">
                  <Search size={14} />
                  <input placeholder="Search username, IP, event type…"
                    value={secSearch} onChange={e => setSecSearch(e.target.value)} />
                </div>
                <select value={secSeverityFilter} onChange={e => setSecSeverityFilter(e.target.value)}>
                  <option value="">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>

            {secLoading ? <div className="sc-loading">Loading security events…</div> : (
              <>
                <div className="sc-table-scroll">
                  <table className="sc-table sc-events-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Severity</th>
                        <th>Event</th>
                        <th>User</th>
                        <th>IP</th>
                        <th>Description</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secEvents.length === 0
                        ? <tr><td colSpan={7} className="sc-empty">No security events found</td></tr>
                        : secEvents.map(ev => {
                          const evIp = ev.ip_address;
                          const canBan = evIp && evIp !== '127.0.0.1' && evIp !== '::1' && evIp !== 'localhost' && evIp !== 'unknown';
                          return (
                            <tr key={ev.id} className={`sc-event-row sc-event-${ev.severity}`}>
                              <td className="sc-time">{formatTime(ev.created_at)}</td>
                              <td><SeverityBadge severity={ev.severity} /></td>
                              <td>
                                <div className="sc-event-type">
                                  {EventIcon(ev.event_type)}
                                  <span>{eventTypeLabel(ev.event_type)}</span>
                                </div>
                              </td>
                              <td>
                                <div className="sc-user-cell">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <strong>{ev.username || '—'}</strong>
                                    <ActorBadge role={ev.user_role || ((ev.metadata as Record<string, unknown> | null)?.userRole as string) || ((ev.metadata as Record<string, unknown> | null)?.actorRole as string)} />
                                  </div>
                                </div>
                              </td>
                              <td><code className="sc-ip">{ev.ip_address || '—'}</code></td>
                              <td className="sc-summary">{ev.description || '—'}</td>
                              <td style={{ textAlign: 'right' }}>
                                {canBan && (
                                  <button
                                    type="button"
                                    className="sc-btn-xs danger"
                                    title={`Ban IP ${evIp}`}
                                    onClick={() => openBanModal(evIp)}
                                  >
                                    <Ban size={12} /> Ban IP
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={secPage} onChange={fetchSecEvents} />
              </>
            )}
          </section>
        </div>
      )}

      {/* ── Tab: Banned IPs ─────────────────────────────────────── */}
      {activeTab === 'bans' && (
        <div className="sc-tab-content">
          <section className="card sc-section sc-full-section">
            <div className="sc-section-header">
              <div>
                <h2><ShieldOff size={16} /> Banned IP Addresses</h2>
                <p className="sc-section-sub">
                  Blocked IP addresses cannot access login pages or API endpoints.
                </p>
              </div>
              <div className="sc-filters">
                <div className="sc-search">
                  <Search size={14} />
                  <input
                    placeholder="Search IP, reason, banned by…"
                    value={bannedSearch}
                    onChange={e => setBannedSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => openBanModal()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                >
                  <Plus size={14} /> Ban IP Address
                </button>
              </div>
            </div>

            {bannedLoading ? (
              <div className="sc-loading">Loading banned IP list…</div>
            ) : (
              <div className="sc-table-scroll">
                <table className="sc-table sc-bans-table">
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th>Reason</th>
                      <th>Banned By</th>
                      <th>Date Banned</th>
                      <th>Expires</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="sc-empty">
                          {bannedSearch ? 'No banned IPs match the search criteria' : 'No IP addresses are currently banned'}
                        </td>
                      </tr>
                    ) : (
                      filteredBans.map(ban => (
                        <tr key={ban.ip_address}>
                          <td>
                            <code className="sc-ip danger-code">{ban.ip_address}</code>
                          </td>
                          <td className="sc-summary">{ban.reason || 'Banned by administrator'}</td>
                          <td>
                            <span className="sc-user-pill">
                              <strong>{ban.banned_by || 'admin'}</strong>
                            </span>
                          </td>
                          <td className="sc-time">{formatTime(ban.created_at)}</td>
                          <td>
                            {ban.expires_at ? (
                              <span className="sc-tag-pill warning">{formatTime(ban.expires_at)}</span>
                            ) : (
                              <span className="sc-tag-pill muted">Permanent</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="sc-btn-xs danger-outline"
                              onClick={() => handleUnban(ban.ip_address)}
                              disabled={unbanningIp === ban.ip_address}
                            >
                              {unbanningIp === ban.ip_address ? 'Unbanning…' : 'Unban'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Tab: System Config ──────────────────────────────────── */}
      {activeTab === 'config' && (
        <div className="sc-tab-content">
          <section className="card sc-section sc-config-section">
            <div className="sc-section-header">
              <h2><Settings2 size={16} /> System Configuration</h2>
              <p className="sc-section-sub">Changes take effect immediately without a server restart.</p>
            </div>

            {configLoading ? <div className="sc-loading">Loading configuration…</div> : (
              <form onSubmit={saveConfig} noValidate>
                {configMsg && (
                  <div className={`sc-config-msg ${configMsg.type}`}>
                    {configMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                    {configMsg.text}
                  </div>
                )}
                <div className="sc-config-grid">
                  {config.map(item => (
                    <div className="sc-config-row" key={item.key}>
                      <div className="sc-config-meta">
                        <label htmlFor={`cfg-${item.key}`} className="sc-config-key">{item.key}</label>
                        {item.description && <span className="sc-config-desc">{item.description}</span>}
                        {item.updated_by && (
                          <span className="sc-config-updated">
                            Last changed by {item.updated_by} · {item.updated_at ? formatTime(item.updated_at) : ''}
                          </span>
                        )}
                      </div>
                      <div className="sc-config-input-wrap">
                        {item.key === 'maintenance_mode' ? (
                          <select
                            id={`cfg-${item.key}`}
                            value={configEdits[item.key] ?? item.value}
                            onChange={e => setConfigEdits(p => ({ ...p, [item.key]: e.target.value }))}
                          >
                            <option value="false">Off (normal operation)</option>
                            <option value="true">On (maintenance mode)</option>
                          </select>
                        ) : (
                          <input
                            id={`cfg-${item.key}`}
                            type={item.key.includes('timeout') || item.key.includes('attempts') || item.key.includes('minutes') || item.key.includes('days') ? 'number' : 'text'}
                            value={configEdits[item.key] ?? item.value}
                            onChange={e => setConfigEdits(p => ({ ...p, [item.key]: e.target.value }))}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="sc-config-actions">
                  {Object.keys(configEdits).length > 0 && (
                    <button type="button" className="btn btn-outline-secondary btn-sm"
                      onClick={() => { setConfigEdits({}); setConfigMsg(null); }}>
                      Discard changes
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary sc-save-btn" disabled={configSaving || Object.keys(configEdits).length === 0}>
                    {configSaving ? (<><RefreshCw size={14} className="sc-spin" /> Saving…</>) : (<><Save size={14} /> Save configuration</>)}
                  </button>
                </div>

                <div className="sc-config-warning">
                  <AlertTriangle size={14} />
                  Configuration changes are logged to the audit trail and security event log.
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {/* ── Ban IP Modal ─────────────────────────────────────────── */}
      {banModalOpen && (
        <div className="sc-modal-backdrop" onClick={() => !banSubmitting && setBanModalOpen(false)}>
          <div className="sc-modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="sc-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="sc-modal-icon danger">
                  <ShieldOff size={18} />
                </div>
                <h3 className="sc-modal-title">Ban IP Address</h3>
              </div>
              <button
                type="button"
                className="sc-btn-icon"
                onClick={() => !banSubmitting && setBanModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBanSubmit}>
              <div className="sc-modal-body">
                {banModalError && (
                  <div className="sc-modal-alert danger">
                    <AlertCircle size={15} />
                    <span>{banModalError}</span>
                  </div>
                )}

                <div className="sc-form-group">
                  <label htmlFor="ban-ip">IP Address <span className="req">*</span></label>
                  <input
                    id="ban-ip"
                    type="text"
                    className="sc-input"
                    placeholder="e.g. 192.168.1.100 or 197.156.x.x"
                    value={banIpInput}
                    onChange={e => setBanIpInput(e.target.value)}
                    required
                    autoFocus
                  />
                  <span className="sc-field-help">IPv4 or IPv6 address. Loopback addresses (127.0.0.1, ::1) cannot be banned.</span>
                </div>

                <div className="sc-form-group">
                  <label htmlFor="ban-duration">Ban Duration</label>
                  <select
                    id="ban-duration"
                    className="sc-select"
                    value={banDuration}
                    onChange={e => setBanDuration(e.target.value)}
                  >
                    <option value="1h">1 Hour (Temporary Lockout)</option>
                    <option value="24h">24 Hours (Standard Quarantine)</option>
                    <option value="7d">7 Days (Extended Watch)</option>
                    <option value="30d">30 Days (High Risk)</option>
                    <option value="permanent">Permanent (Until Manually Lifted)</option>
                  </select>
                </div>

                <div className="sc-form-group">
                  <label htmlFor="ban-reason">Reason</label>
                  <textarea
                    id="ban-reason"
                    className="sc-textarea"
                    rows={3}
                    placeholder="Specify the reason for banning this IP (e.g. repeated brute-force login attempts)..."
                    value={banReasonInput}
                    onChange={e => setBanReasonInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="sc-modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setBanModalOpen(false)}
                  disabled={banSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger btn-sm"
                  disabled={banSubmitting || !banIpInput.trim()}
                >
                  {banSubmitting ? (
                    <><RefreshCw size={14} className="sc-spin" /> Banning IP…</>
                  ) : (
                    <><Ban size={14} /> Confirm Ban</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
