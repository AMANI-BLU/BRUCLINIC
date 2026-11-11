import { useEffect, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays,
  Pill, Stethoscope, BarChart2, Menu, Bell, Settings,
  ChevronRight, LogOut, HeartPulse, ClipboardList, Sun, Moon,
  ShieldCheck, ShieldAlert, Database, Wrench, AlertTriangle, MessageSquare,
  CheckCircle2, ArrowRight, Trash2
} from 'lucide-react';
import './Layout.css';
import '../Maintenance/MaintenancePage.css';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { useMaintenance } from '../../context/MaintenanceContext';
import type { UserRole } from '../../types';
import ConfirmModal from '../ConfirmModal';
import PasswordField from '../PasswordField';
import { apiGet } from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';
import { validateRequired } from '../../utils/validation';

interface NavItemDef {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  roles?: UserRole[];
  end?: boolean;
}

const ALL_NAV_ITEMS: NavItemDef[] = [
  { to: '/',               icon: LayoutDashboard, label: 'Dashboard',       end: true },
  { to: '/staff-accounts', icon: ShieldCheck,     label: 'Staff Accounts',  roles: ['admin'] },
  { to: '/patients',       icon: Users,           label: 'Patients',        roles: ['admin', 'receptionist', 'opd', 'emergency'] },
  { to: '/appointments',   icon: CalendarDays,    label: 'Appointments',    roles: ['admin', 'receptionist', 'opd'] },
  { to: '/records',        icon: ClipboardList,   label: 'Medical Records', roles: ['admin', 'receptionist', 'opd', 'emergency', 'laboratory'] },
  { to: '/messages',       icon: MessageSquare,   label: 'Messages' },
  { to: '/notifications',  icon: Bell,            label: 'Notifications' },
  { to: '/pharmacy',       icon: Pill,            label: 'Pharmacy & Inventory', roles: ['admin', 'pharmacy'] },
  { to: '/doctors',        icon: Stethoscope,     label: 'Doctors',         roles: ['admin', 'opd'] },
  { to: '/reports',        icon: BarChart2,       label: 'Reports',         roles: ['admin'] },
  { to: '/security',       icon: ShieldAlert,     label: 'Security Center', roles: ['admin'] },
  { to: '/backup',         icon: Database,        label: 'Backup & Restore', roles: ['admin'] },
];

interface LayoutProps { children: React.ReactNode }

function PageVisitSkeleton() {
  return (
    <div className="page-visit-skeleton" role="status" aria-label="Loading page">
      <span className="page-skeleton-block page-skeleton-heading" />
      <div className="page-skeleton-metrics" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <span className="page-skeleton-block" key={index} />)}
      </div>
      <div className="page-skeleton-content" aria-hidden="true">
        <span className="page-skeleton-block page-skeleton-subheading" />
        <span className="page-skeleton-block page-skeleton-line" />
        <span className="page-skeleton-block page-skeleton-line" />
        <span className="page-skeleton-block page-skeleton-line page-skeleton-line-short" />
      </div>
    </div>
  );
}

function PageVisitContent({ children }: LayoutProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 120);
    return () => window.clearTimeout(timer);
  }, []);

  return ready ? <div className="page-transition-content">{children}</div> : <PageVisitSkeleton />;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);

  const notifRef = useRef<HTMLLIElement>(null);
  const actionToastTimer = useRef<number | null>(null);

  const isInitialSessionLocked = () => {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem('bruclinic:session_locked') === 'true') return true;
    const lastActive = Number(localStorage.getItem('bruclinic:last_activity') || '0');
    const storedLockMinutes = Number(localStorage.getItem('bruclinic:idle_lock_minutes') || '15');
    if (lastActive > 0 && Date.now() - lastActive >= storedLockMinutes * 60_000) {
      localStorage.setItem('bruclinic:session_locked', 'true');
      return true;
    }
    return false;
  };

  const [sessionLocked, setSessionLocked] = useState<boolean>(isInitialSessionLocked);
  const lastActivityAt = useRef<number>(
    typeof window !== 'undefined' && Number(localStorage.getItem('bruclinic:last_activity') || '0') > 0
      ? Number(localStorage.getItem('bruclinic:last_activity'))
      : Date.now()
  );
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { currentUser, role, logout, idleLockMinutes, unlockSession, token } = useAuth();
  const { loading: clinicLoading, error: clinicError, refresh } = useClinic();
  const { enabled: maintenance } = useMaintenance();
  const {
    visibleNotifications,
    totalAlerts,
    unreadAlerts,
    dismissAlert,
    clearAllAlerts,
    markAlertsRead,
  } = useNotifications();

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    const fetchUnreadCount = async () => {
      try {
        const res = await apiGet<{ count: number }>('/messages/unread-count', token);
        if (mounted) setUnreadMessages(res.count || 0);
      } catch {}
    };
    void fetchUnreadCount();
    const interval = window.setInterval(fetchUnreadCount, 12_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    document.body.classList.add('app-body', 'layout-fixed', 'sidebar-expand-lg', 'sidebar-mini', 'sidebar-without-hover');
    return () => document.body.classList.remove('app-body', 'layout-fixed', 'sidebar-expand-lg', 'sidebar-mini', 'sidebar-without-hover', 'sidebar-collapse', 'sidebar-open');
  }, []);

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapse', !sidebarOpen);
    document.body.classList.toggle('sidebar-open', mobileOpen);
  }, [sidebarOpen, mobileOpen]);

  // Automatically close mobile sidebar drawer upon navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifications(false);
    }
    if (showNotifications) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  useEffect(() => {
    const handleActionSuccess = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (!message) return;
      setActionToast(message);
      if (actionToastTimer.current !== null) window.clearTimeout(actionToastTimer.current);
      actionToastTimer.current = window.setTimeout(() => setActionToast(null), 3200);
    };
    window.addEventListener('bruclinic:action-success', handleActionSuccess);
    return () => {
      window.removeEventListener('bruclinic:action-success', handleActionSuccess);
      if (actionToastTimer.current !== null) window.clearTimeout(actionToastTimer.current);
    };
  }, []);

  useEffect(() => {
    const refreshVisibleAlerts = () => {
      if (!document.hidden) void refresh({ silent: true });
    };
    const interval = window.setInterval(refreshVisibleAlerts, 30_000);
    window.addEventListener('focus', refreshVisibleAlerts);
    document.addEventListener('visibilitychange', refreshVisibleAlerts);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisibleAlerts);
      document.removeEventListener('visibilitychange', refreshVisibleAlerts);
    };
  }, [refresh]);

  useEffect(() => {
    if (idleLockMinutes) {
      localStorage.setItem('bruclinic:idle_lock_minutes', String(idleLockMinutes));
    }
  }, [idleLockMinutes]);

  useEffect(() => {
    const markActivity = () => {
      const isLocked = localStorage.getItem('bruclinic:session_locked') === 'true';
      if (!sessionLocked && !isLocked) {
        const now = Date.now();
        lastActivityAt.current = now;
        localStorage.setItem('bruclinic:last_activity', String(now));
      }
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, markActivity, { passive: true }));
    const timer = window.setInterval(() => {
      const isExplicitlyLocked = localStorage.getItem('bruclinic:session_locked') === 'true';
      if (isExplicitlyLocked) {
        if (!sessionLocked) setSessionLocked(true);
        return;
      }
      const lastActive = Number(localStorage.getItem('bruclinic:last_activity') || String(lastActivityAt.current));
      const storedLockMinutes = Number(localStorage.getItem('bruclinic:idle_lock_minutes') || '0');
      const effectiveLockMinutes = storedLockMinutes > 0 ? storedLockMinutes : (idleLockMinutes || 15);
      if (Date.now() - lastActive >= effectiveLockMinutes * 60_000) {
        setSessionLocked(true);
        localStorage.setItem('bruclinic:session_locked', 'true');
        setUnlockPassword('');
        setUnlockError('');
      }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      events.forEach(event => window.removeEventListener(event, markActivity));
    };
  }, [idleLockMinutes, sessionLocked]);

  const submitUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setUnlockError('');
    const validationErrors = validateRequired({ unlockPassword }, { unlockPassword: 'Account password' });
    if (Object.keys(validationErrors).length > 0) {
      setUnlockError(Object.values(validationErrors)[0]);
      return;
    }
    setUnlocking(true);
    const result = await unlockSession(unlockPassword);
    setUnlocking(false);
    if (!result.success) {
      setUnlockError(result.error || 'Unable to unlock this session.');
      return;
    }
    setSessionLocked(false);
    localStorage.removeItem('bruclinic:session_locked');
    const now = Date.now();
    lastActivityAt.current = now;
    localStorage.setItem('bruclinic:last_activity', String(now));
    setUnlockPassword('');
  };

  const directSignOut = () => {
    localStorage.removeItem('bruclinic:session_locked');
    localStorage.removeItem('bruclinic:last_activity');
    logout();
    navigate('/login');
  };

  const navItems = ALL_NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role));
  const currentPage = ALL_NAV_ITEMS.find(item => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isFullscreenPage = location.pathname === '/messages';
  const isAsideExpanded = sidebarOpen || mobileOpen;

  const handleLogout = () => setLogoutConfirmOpen(true);
  const confirmLogout = () => {
    localStorage.removeItem('bruclinic:session_locked');
    localStorage.removeItem('bruclinic:last_activity');
    setLogoutConfirmOpen(false);
    logout();
    navigate('/login');
  };
  const closeMobile = () => setMobileOpen(false);
  const toggleNotifications = () => {
    if (!showNotifications) markAlertsRead();
    setShowNotifications(previous => !previous);
  };

  return (
    <div className={`app-wrapper app-shell ${mobileOpen ? 'mobile-sidebar-open' : ''}`}>
      {mobileOpen && <button className="app-sidebar-overlay" aria-label="Close navigation" onClick={closeMobile} />}
      <header className="app-header navbar navbar-expand bg-body">
        <ul className="navbar-nav">
          <li className="nav-item">
            <button type="button" className="nav-link app-menu-toggle" onClick={() => window.innerWidth < 992 ? setMobileOpen(true) : setSidebarOpen(value => !value)} aria-label="Toggle navigation" title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
              <Menu size={20} />
            </button>
          </li>
          <li className="nav-item d-none d-sm-inline-block">
            <span className="nav-link app-current-page"><HeartPulse size={15} /> {currentPage?.label || 'Clinic workspace'}</span>
          </li>
        </ul>
        <ul className="navbar-nav ms-auto app-header-actions">
          <li className="nav-item d-none d-md-inline-block"><span className="nav-link app-date"><CalendarDays size={14} /> {today}</span></li>
          <li className="nav-item">
            <button type="button" className="nav-link app-header-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link app-header-btn app-notification ${location.pathname === '/messages' ? 'active' : ''}`}
              title="Staff Messenger"
              aria-label={`Staff Messenger${unreadMessages > 0 ? `, ${unreadMessages} unread messages` : ''}`}
              onClick={() => navigate('/messages')}
            >
              <MessageSquare size={18} />
              {unreadMessages > 0 && <span className="navbar-badge badge text-bg-primary">{unreadMessages}</span>}
            </button>
          </li>
          <li className="nav-item app-alert-menu" ref={notifRef}>
            <button type="button" className={`nav-link app-header-btn app-notification ${showNotifications ? 'active' : ''}`} title="Clinic live alerts" aria-label={`Clinic live alerts${unreadAlerts ? `, ${unreadAlerts} unread` : ''}`} aria-expanded={showNotifications} onClick={toggleNotifications}>
              <Bell size={18} />
              {unreadAlerts > 0 && <span className="navbar-badge badge text-bg-danger">{unreadAlerts}</span>}
            </button>
            {showNotifications && (
              <div className="app-notification-dropdown">
                <div className="app-notification-heading">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <strong><Bell size={14} /> Live Alerts</strong>
                    <span className="badge text-bg-primary">{totalAlerts}</span>
                  </div>
                  {totalAlerts > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-decoration-none"
                        style={{ fontSize: '0.72rem', color: 'var(--clr-primary-400)', cursor: 'pointer' }}
                        onClick={() => markAlertsRead()}
                      >
                        Mark read
                      </button>
                      <span style={{ color: 'var(--clr-border, #cbd5e1)', fontSize: '0.7rem' }}>·</span>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-decoration-none text-danger"
                        style={{ fontSize: '0.72rem', cursor: 'pointer' }}
                        onClick={clearAllAlerts}
                        title="Clear and delete all active alerts"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>

                <div className="app-notification-list">
                  {visibleNotifications.length === 0 ? (
                    <div className="app-notification-empty">
                      <CheckCircle2 size={22} style={{ color: '#10b981' }} />
                      <span>No active notifications for {currentUser?.roleTitle || role}</span>
                    </div>
                  ) : (
                    visibleNotifications.slice(0, 6).map(alert => {
                      const IconComponent = alert.icon;
                      const isCritical = alert.priority === 'critical';
                      const isUrgent = alert.priority === 'urgent';
                      const iconBg = isCritical ? 'rgba(239, 68, 68, 0.12)' : isUrgent ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)';
                      const iconColor = isCritical ? '#dc2626' : isUrgent ? '#d97706' : '#2563eb';

                      return (
                        <div
                          key={alert.id}
                          className="app-notification-item"
                          onClick={() => {
                            setShowNotifications(false);
                            navigate(alert.link);
                          }}
                        >
                          <div className="app-notification-item-icon" style={{ backgroundColor: iconBg, color: iconColor }}>
                            <IconComponent size={15} />
                          </div>
                          <div className="app-notification-item-content">
                            <div className="app-notification-item-header">
                              <span className="app-notification-item-title">{alert.title}</span>
                              {alert.time && <span className="app-notification-item-time">{alert.time}</span>}
                            </div>
                            <p className="app-notification-item-msg">{alert.message}</p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-link p-0 text-muted ms-1"
                            style={{ opacity: 0.6, alignSelf: 'center', border: 'none', background: 'transparent', cursor: 'pointer' }}
                            onClick={e => {
                              e.stopPropagation();
                              dismissAlert(alert.id);
                            }}
                            title="Dismiss notification"
                            aria-label="Dismiss notification"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {visibleNotifications.length > 0 && (
                  <div className="app-notification-footer">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary w-100"
                      style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                      onClick={() => {
                        setShowNotifications(false);
                        navigate('/notifications');
                      }}
                    >
                      <span>View All Notifications ({visibleNotifications.length})</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
          <li className="nav-item app-header-user">
            <span className="nav-link">
              <span className="app-header-avatar" style={{ backgroundColor: currentUser?.badgeColor || '#007bff' }}>{currentUser?.avatarInitials || 'AD'}</span>
              <span className="app-header-user-copy d-none d-md-inline-flex"><strong>{currentUser?.name || 'Staff User'}</strong></span>
            </span>
          </li>
          <li className="nav-item"><button type="button" className="nav-link app-header-btn app-logout" onClick={handleLogout} title="Sign out"><LogOut size={17} /></button></li>
        </ul>
      </header>

      <aside className="app-sidebar bg-body-secondary shadow" data-bs-theme="dark">
        <div className="sidebar-brand">
          <NavLink to="/" className="brand-link app-brand" onClick={closeMobile}>
            <img src="/bu-logo.png" alt="Borana University" className="brand-image rounded-circle" />
            {isAsideExpanded && <span className="brand-text fw-light"><strong>Bru</strong>Clinic</span>}
          </NavLink>
        </div>
        <div className="sidebar-wrapper">
          <div className="user-panel mt-2 pb-2 mb-2 d-flex app-user-panel">
            <div className="image"><div className="app-user-avatar" style={{ backgroundColor: currentUser?.badgeColor || '#007bff' }} title={currentUser?.name || 'Staff User'}>{currentUser?.avatarInitials || 'AD'}</div></div>
            {isAsideExpanded && <div className="info"><span className="d-block app-user-name">{currentUser?.name || 'Staff User'}</span><small>{currentUser?.roleTitle || role}</small></div>}
          </div>
          <nav className="mt-1" aria-label="Main navigation">
            {isAsideExpanded && <p className="app-nav-heading">Main Menu</p>}
            <ul className="nav sidebar-menu flex-column" data-lte-toggle="treeview" role="menu">
              {navItems.map(({ to, icon: Icon, label, end }) => (
                <li className="nav-item" key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    onClick={closeMobile}
                  >
                    <Icon className="nav-icon" size={18} />
                    {isAsideExpanded && <p>{label}<ChevronRight className="right" size={14} /></p>}
                    {!isAsideExpanded && <span className="app-nav-tooltip">{label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="app-sidebar-footer">
            {isAsideExpanded && <p className="app-nav-heading">Account</p>}
            <ul className="nav sidebar-menu flex-column">
              <li className="nav-item">
                <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobile}>
                  <Settings className="nav-icon" size={18} />
                  {isAsideExpanded && <p>Settings</p>}
                  {!isAsideExpanded && <span className="app-nav-tooltip">Settings</span>}
                </NavLink>
              </li>
              <li className="nav-item app-signout-item">
                <button type="button" className="nav-link" onClick={handleLogout} title={!isAsideExpanded ? 'Sign out' : undefined}>
                  <LogOut className="nav-icon" size={18} />
                  {isAsideExpanded && <p>Sign out</p>}
                  {!isAsideExpanded && <span className="app-nav-tooltip">Sign out</span>}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      <main className={`app-main${isFullscreenPage ? ' app-main-fullscreen' : ''}`}>
        {!isFullscreenPage && (
          <div className="app-content-header">
            <div className="container-fluid"><ol className="breadcrumb ms-auto"><li className="breadcrumb-item"><NavLink to="/">Home</NavLink></li><li className="breadcrumb-item active">{currentPage?.label || 'Clinic'}</li></ol></div>
          </div>
        )}
        <div className={`app-content${isFullscreenPage ? ' app-content-fullscreen' : ''}`}>
          <div className={`container-fluid app-content-container${isFullscreenPage ? ' app-content-container-fullscreen' : ''}`}>
            {maintenance && <div className="alert alert-warning app-maintenance-banner" role="status"><Wrench size={16} /><div><strong>Maintenance mode is on</strong><span>Clinical staff are paused. You still have administrator access.</span></div><NavLink to="/security" className="btn btn-secondary btn-sm">Manage</NavLink></div>}
            {clinicError && <div className="alert alert-warning clinic-data-alert" role="alert"><AlertTriangle size={16} /><div><strong>Clinic data could not be refreshed</strong><span>{clinicError}</span></div></div>}
            {clinicLoading && <div className="alert alert-info py-2" role="status">Loading clinic data…</div>}
            <PageVisitContent key={location.pathname}>{children}</PageVisitContent>
          </div>
        </div>
      </main>

      <footer className="app-footer"><strong>BruClinic</strong> · Borana University Health Services · v2.0<span className="float-end d-none d-sm-inline">Borana University Clinic Management System</span></footer>
      {actionToast && <div className="app-action-toast" role="status"><CheckCircle2 size={17} />{actionToast}</div>}
      <ConfirmModal
        isOpen={logoutConfirmOpen}
        title="Sign out of BruClinic?"
        message="You will need to sign in again."
        confirmText="Sign out"
        cancelText="Stay signed in"
        variant="warning"
        icon="alert"
        compact
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
      />
      {sessionLocked && (
        <div role="dialog" aria-modal="true" aria-labelledby="session-lock-title" style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(9, 18, 35, .94)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <form onSubmit={submitUnlock} noValidate style={{ width: 'min(100%, 420px)', borderRadius: 16, padding: 30, background: 'var(--clr-bg-card, #fff)', color: 'var(--clr-text-primary, #172033)', boxShadow: '0 24px 80px rgba(0,0,0,.5)', border: '1px solid var(--clr-border, #e2e8f0)' }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ width: 62, height: 62, borderRadius: '50%', background: currentUser?.badgeColor || '#0284c7', color: '#fff', fontSize: '1.4rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
                {currentUser?.avatarInitials || 'ST'}
              </div>
              <h2 id="session-lock-title" style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800 }}>Session Locked</h2>
              <div style={{ fontWeight: 700, color: 'var(--clr-text-primary)', fontSize: '0.94rem' }}>{currentUser?.name || 'Staff User'}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--clr-text-muted)' }}>{currentUser?.roleTitle || role}</div>
            </div>
            <p style={{ margin: '0 0 16px', color: 'var(--clr-text-muted, #5f6c87)', fontSize: '.84rem', textAlign: 'center', lineHeight: 1.45 }}>
              This workstation was locked after inactivity. Enter your account password to resume your session.
            </p>
            {unlockError && <div className="alert alert-danger py-2 mb-3" role="alert" style={{ fontSize: '0.84rem' }}>{unlockError}</div>}
            <label className="form-label" htmlFor="unlock-password" style={{ fontWeight: 600, fontSize: '0.82rem' }}>Account Password</label>
            <PasswordField id="unlock-password" className="form-control mb-3" autoComplete="current-password" autoFocus value={unlockPassword} onChange={event => setUnlockPassword(event.target.value)} required placeholder="Enter password to unlock..." />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <button className="btn btn-secondary btn-sm" type="button" onClick={directSignOut}>Sign out</button>
              <button className="btn btn-primary btn-sm" type="submit" disabled={unlocking}>{unlocking ? 'Unlocking…' : 'Unlock Workstation'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
