import { useEffect, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays,
  Pill, Stethoscope, BarChart2, Menu, Bell, Settings,
  ChevronRight, LogOut, HeartPulse, ClipboardList, Sun, Moon,
  ShieldCheck, ShieldAlert, Database, Wrench, AlertTriangle, MessageSquare, KeyRound,
  FlaskConical, CheckCircle2
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
  { to: '/pharmacy',       icon: Pill,            label: 'Pharmacy',        roles: ['admin', 'pharmacy'] },
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
  const [readAlertKey, setReadAlertKey] = useState('');
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const notifRef = useRef<HTMLLIElement>(null);
  const actionToastTimer = useRef<number | null>(null);
  const lastActivityAt = useRef(Date.now());
  const [sessionLocked, setSessionLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { currentUser, role, logout, idleLockMinutes, unlockSession } = useAuth();
  const { loading: clinicLoading, error: clinicError, erCases, labOrders, medicines, pharmacyOrders, refresh } = useClinic();
  const { enabled: maintenance } = useMaintenance();

  useEffect(() => {
    document.body.classList.add('app-body', 'layout-fixed', 'sidebar-expand-lg', 'sidebar-mini', 'sidebar-without-hover');
    return () => document.body.classList.remove('app-body', 'layout-fixed', 'sidebar-expand-lg', 'sidebar-mini', 'sidebar-without-hover', 'sidebar-collapse', 'sidebar-open');
  }, []);

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapse', !sidebarOpen);
    document.body.classList.toggle('sidebar-open', mobileOpen);
  }, [sidebarOpen, mobileOpen]);

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
    const markActivity = () => {
      if (!sessionLocked) lastActivityAt.current = Date.now();
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, markActivity, { passive: true }));
    const timer = window.setInterval(() => {
      if (!sessionLocked && Date.now() - lastActivityAt.current >= idleLockMinutes * 60_000) {
        setSessionLocked(true);
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
    setUnlocking(true);
    const result = await unlockSession(unlockPassword);
    setUnlocking(false);
    if (!result.success) {
      setUnlockError(result.error || 'Unable to unlock this session.');
      return;
    }
    setSessionLocked(false);
    setUnlockPassword('');
    lastActivityAt.current = Date.now();
  };

  const navItems = ALL_NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role));
  const currentPage = ALL_NAV_ITEMS.find(item => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const criticalER = erCases.filter(item => item.acuity === 'Red');
  const lowStock = medicines.filter(item => item.stock <= item.minStock);
  const completedLabs = labOrders.filter(item => item.status === 'Completed');
  const pendingPharmacyOrders = role === 'admin' || role === 'pharmacy'
    ? pharmacyOrders.filter(item => item.status === 'Pending')
    : [];
  const totalAlerts = criticalER.length + lowStock.length + completedLabs.length + pendingPharmacyOrders.length;
  const alertKey = JSON.stringify({
    criticalER: criticalER.map(item => item.id).sort(),
    lowStock: lowStock.map(item => `${item.id}:${item.stock}`).sort(),
    completedLabs: completedLabs.map(item => item.id).sort(),
    pendingPharmacyOrders: pendingPharmacyOrders.map(item => item.id).sort(),
  });
  const unreadAlerts = alertKey === readAlertKey ? 0 : totalAlerts;
  const handleLogout = () => setLogoutConfirmOpen(true);
  const confirmLogout = () => { setLogoutConfirmOpen(false); logout(); navigate('/login'); };
  const closeMobile = () => setMobileOpen(false);
  const toggleNotifications = () => {
    if (!showNotifications) setReadAlertKey(alertKey);
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
          <li className="nav-item app-alert-menu" ref={notifRef}>
            <button type="button" className={`nav-link app-header-btn app-notification ${showNotifications ? 'active' : ''}`} title="Clinic live alerts" aria-label={`Clinic live alerts${unreadAlerts ? `, ${unreadAlerts} unread` : ''}`} aria-expanded={showNotifications} onClick={toggleNotifications}>
              <Bell size={18} />
              {unreadAlerts > 0 && <span className="navbar-badge badge text-bg-danger">{unreadAlerts}</span>}
            </button>
            {showNotifications && (
              <div className="app-notification-dropdown">
                <div className="app-notification-heading">
                  <strong><Bell size={14} /> Live Alerts &amp; Notifications</strong>
                  <span className="badge text-bg-primary">{totalAlerts} active</span>
                </div>
                <div className="app-notification-list">
                  {criticalER.length > 0 && <div className="notif-item-hover"><strong><HeartPulse size={14} /> Critical ER Cases ({criticalER.length})</strong>{criticalER.slice(0, 3).map(item => <span key={item.id}>{item.patientName} · {item.chiefComplaint.slice(0, 40)}...</span>)}</div>}
                  {lowStock.length > 0 && <div className="notif-item-hover"><strong><Pill size={14} /> Low Stock Alerts ({lowStock.length})</strong>{lowStock.slice(0, 3).map(item => <span key={item.id}>{item.name} — {item.stock} {item.unit} left</span>)}</div>}
                  {completedLabs.length > 0 && <div className="notif-item-hover"><strong><FlaskConical size={14} /> Completed Lab Results ({completedLabs.length})</strong>{completedLabs.slice(0, 3).map(item => <span key={item.id}>{item.patientName} · {item.testName}: {item.result || 'Completed'}</span>)}</div>}
                  {pendingPharmacyOrders.length > 0 && <div className="notif-item-hover"><strong><Pill size={14} /> Pending Pharmacy Prescriptions ({pendingPharmacyOrders.length})</strong>{pendingPharmacyOrders.slice(0, 3).map(item => <span key={item.id}>{item.patientName} · {item.doctorName} · {item.id}</span>)}</div>}
                  {totalAlerts === 0 && <div className="app-notification-empty"><CheckCircle2 size={20} />No active alerts</div>}
                </div>
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
            {sidebarOpen && <span className="brand-text fw-light"><strong>Bru</strong>Clinic</span>}
          </NavLink>
        </div>
        <div className="sidebar-wrapper">
          <div className="user-panel mt-2 pb-2 mb-2 d-flex app-user-panel">
            <div className="image"><div className="app-user-avatar" style={{ backgroundColor: currentUser?.badgeColor || '#007bff' }} title={currentUser?.name || 'Staff User'}>{currentUser?.avatarInitials || 'AD'}</div></div>
            {sidebarOpen && <div className="info"><span className="d-block app-user-name">{currentUser?.name || 'Staff User'}</span><small>{currentUser?.roleTitle || role}</small></div>}
          </div>
          <nav className="mt-1" aria-label="Main navigation">
            {sidebarOpen && <p className="app-nav-heading">Main Menu</p>}
            <ul className="nav sidebar-menu flex-column" data-lte-toggle="treeview" role="menu">
              {navItems.map(({ to, icon: Icon, label, end }) => <li className="nav-item" key={to}><NavLink to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobile}><Icon className="nav-icon" size={18} />{sidebarOpen && <p>{label}<ChevronRight className="right" size={14} /></p>}{!sidebarOpen && <span className="app-nav-tooltip">{label}</span>}</NavLink></li>)}
            </ul>
          </nav>
          <div className="app-sidebar-footer">
            {sidebarOpen && <p className="app-nav-heading">Account</p>}
            <ul className="nav sidebar-menu flex-column">
              <li className="nav-item"><NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobile}><Settings className="nav-icon" size={18} />{sidebarOpen && <p>Settings</p>}{!sidebarOpen && <span className="app-nav-tooltip">Settings</span>}</NavLink></li>
              <li className="nav-item app-signout-item"><button type="button" className="nav-link" onClick={handleLogout} title={!sidebarOpen ? 'Sign out' : undefined}><LogOut className="nav-icon" size={18} />{sidebarOpen && <p>Sign out</p>}{!sidebarOpen && <span className="app-nav-tooltip">Sign out</span>}</button></li>
            </ul>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-content-header">
          <div className="container-fluid"><ol className="breadcrumb ms-auto"><li className="breadcrumb-item"><NavLink to="/">Home</NavLink></li><li className="breadcrumb-item active">{currentPage?.label || 'Clinic'}</li></ol></div>
        </div>
        <div className="app-content">
          <div className="container-fluid app-content-container">
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
        <div role="dialog" aria-modal="true" aria-labelledby="session-lock-title" style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(9, 18, 35, .9)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <form onSubmit={submitUnlock} style={{ width: 'min(100%, 400px)', borderRadius: 16, padding: 28, background: 'var(--clr-bg-card, #fff)', color: 'var(--clr-text-primary, #172033)', boxShadow: '0 24px 80px rgba(0,0,0,.4)' }}>
            <KeyRound size={28} />
            <h2 id="session-lock-title" className="mt-3">Session locked</h2>
            <p>Your session was locked after inactivity. Enter your password to continue.</p>
            {unlockError && <div className="alert alert-danger py-2" role="alert">{unlockError}</div>}
            <label className="form-label" htmlFor="unlock-password">Password</label>
            <PasswordField id="unlock-password" className="form-control mb-3" autoComplete="current-password" autoFocus value={unlockPassword} onChange={event => setUnlockPassword(event.target.value)} required />
            <div className="d-flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={unlocking}>{unlocking ? 'Unlocking…' : 'Unlock session'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
