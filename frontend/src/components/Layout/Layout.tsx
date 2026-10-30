import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays,
  Pill, Stethoscope, BarChart2, Menu, Bell, Settings,
  ChevronRight, LogOut,
  HeartPulse, ClipboardList, Sun, Moon, ShieldCheck, ShieldAlert, Database,
  Wrench, AlertTriangle,
} from 'lucide-react';
import './Layout.css';
import '../Maintenance/MaintenancePage.css';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { useMaintenance } from '../../context/MaintenanceContext';
import type { UserRole } from '../../types';

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
  { to: '/records',        icon: ClipboardList,   label: 'Medical Records', roles: ['admin', 'opd', 'emergency', 'laboratory'] },
  { to: '/pharmacy',       icon: Pill,            label: 'Pharmacy',        roles: ['admin', 'pharmacy'] },
  { to: '/doctors',        icon: Stethoscope,     label: 'Doctors',         roles: ['admin', 'opd'] },
  { to: '/reports',        icon: BarChart2,       label: 'Reports',         roles: ['admin'] },
  { to: '/security',       icon: ShieldAlert,     label: 'Security Center', roles: ['admin'] },
  { to: '/backup',         icon: Database,        label: 'Backup & Restore', roles: ['admin'] },
];

interface LayoutProps { children: React.ReactNode }

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { currentUser, role, logout } = useAuth();
  const { loading: clinicLoading, error: clinicError } = useClinic();
  const { enabled: maintenance } = useMaintenance();

  useEffect(() => {
    document.body.classList.add('app-body');
    return () => document.body.classList.remove('app-body');
  }, []);

  const navItems = ALL_NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role));
  const currentPage = ALL_NAV_ITEMS.find(n => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to));
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className={`wrapper app-shell hold-transition sidebar-mini sidebar-no-expand layout-fixed ${sidebarOpen ? '' : 'sidebar-collapse'} ${mobileOpen ? 'mobile-sidebar-open' : ''}`}>
      {mobileOpen && <button className="app-sidebar-overlay" aria-label="Close navigation" onClick={closeMobile} />}

      <aside className="main-sidebar sidebar-dark-primary elevation-4 app-sidebar">
        <NavLink to="/" className="brand-link app-brand" onClick={closeMobile}>
          <img src="/bu-logo.png" alt="Borana University" className="brand-image img-circle elevation-3" />
          <span className="brand-text font-weight-light"><strong>Bru</strong>Clinic</span>
        </NavLink>

        <div className="sidebar">
          <div className="user-panel mt-3 pb-3 mb-3 d-flex app-user-panel">
            <div className="image">
              <div className="app-user-avatar" style={{ backgroundColor: currentUser?.badgeColor || '#007bff' }}>
                {currentUser?.avatarInitials || 'AD'}
              </div>
            </div>
            {sidebarOpen && (
              <div className="info">
                <span className="d-block app-user-name">{currentUser?.name || 'Staff User'}</span>
              </div>
            )}
          </div>

          <nav className="mt-2" aria-label="Main navigation">
            <p className="app-nav-heading">Department Menu</p>
            <ul className="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu">
              {navItems.map(({ to, icon: Icon, label, end }) => (
                <li className="nav-item" key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    onClick={closeMobile}
                    title={!sidebarOpen ? label : undefined}
                  >
                    <Icon className="nav-icon" size={18} />
                    {sidebarOpen && <p>{label}<ChevronRight className="right" size={14} /></p>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="app-sidebar-footer">
            <p className="app-nav-heading">Account</p>
            <ul className="nav nav-pills nav-sidebar flex-column">
              <li className="nav-item">
                <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={!sidebarOpen ? 'Settings' : undefined} onClick={closeMobile}>
                  <Settings className="nav-icon" size={18} />
                  {sidebarOpen && <p>Settings</p>}
                </NavLink>
              </li>
              {sidebarOpen && (
                <li className="nav-item app-signout-item">
                  <button type="button" className="nav-link" onClick={handleLogout}>
                    <LogOut className="nav-icon" size={18} />
                    <p>Sign out</p>
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </aside>

      <div className="app-main-wrapper">
        <header className="main-header navbar navbar-expand navbar-white navbar-light app-header">
          <ul className="navbar-nav">
            <li className="nav-item">
              <button type="button" className="nav-link app-menu-toggle" onClick={() => window.innerWidth < 992 ? setMobileOpen(true) : setSidebarOpen(value => !value)} aria-label="Toggle navigation">
                <Menu size={21} />
              </button>
            </li>
            <li className="nav-item d-none d-sm-inline-block">
              <span className="nav-link app-current-page"><HeartPulse size={14} /> {currentPage?.label || 'Clinic dashboard'}</span>
            </li>
          </ul>

          <ul className="navbar-nav ml-auto app-header-actions">
            <li className="nav-item d-none d-md-inline-block">
              <span className="nav-link app-date"><CalendarDays size={14} /> {today}</span>
            </li>
            <li className="nav-item">
              <button type="button" className="nav-link app-header-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </li>
            <li className="nav-item">
              <button type="button" className="nav-link app-header-btn app-notification" title="Notifications">
                <Bell size={18} />
              </button>
            </li>
            <li className="nav-item app-header-user">
              <span className="nav-link">
                <span className="app-header-avatar" style={{ backgroundColor: currentUser?.badgeColor || '#007bff' }}>{currentUser?.avatarInitials || 'AD'}</span>
                <span className="app-header-user-copy d-none d-md-inline-flex">
                  <strong>{currentUser?.name || 'Staff User'}</strong>
                </span>
              </span>
            </li>
            <li className="nav-item">
              <button type="button" className="nav-link app-header-btn app-logout" onClick={handleLogout} title="Sign out">
                <LogOut size={17} />
              </button>
            </li>
          </ul>
        </header>

        <main className="content-wrapper app-content">
          <div className="content-header app-content-header">
            <div className="container-fluid">
              <ol className="breadcrumb float-sm-right">
                <li className="breadcrumb-item"><NavLink to="/">Home</NavLink></li>
                <li className="breadcrumb-item active">{currentPage?.label || 'Clinic'}</li>
              </ol>
            </div>
          </div>
          <section className="content">
            <div className="container-fluid app-content-container">
              {maintenance && (
                <div className="alert alert-warning app-maintenance-banner" role="status">
                  <Wrench size={16} />
                  <div>
                    <strong>Maintenance mode is on</strong>
                    <span>Clinical staff are paused. You still have administrator access.</span>
                  </div>
                  <NavLink to="/security" className="btn btn-secondary btn-sm">Manage</NavLink>
                </div>
              )}
              {clinicError && (
                <div className="alert alert-warning clinic-data-alert" role="alert">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Clinic data could not be refreshed</strong>
                    <span>{clinicError}</span>
                  </div>
                </div>
              )}
              {clinicLoading && <div className="alert alert-info py-2" role="status">Loading clinic data…</div>}
              {children}
            </div>
          </section>
        </main>

        <footer className="main-footer app-footer">
          <strong>BruClinic</strong> · Borana University Health Services · v2.0
          <span className="float-right d-none d-sm-inline">Borana University Clinic Management System</span>
        </footer>
      </div>
    </div>
  );
}
