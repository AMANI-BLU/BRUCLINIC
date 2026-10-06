import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays,
  Pill, Stethoscope, BarChart2, Menu, Bell, Settings,
  ChevronRight, ChevronLeft, LogOut,
  HeartPulse, ClipboardList, Sun, Moon, ArrowRightLeft
} from 'lucide-react';
import './Layout.css';
import { useTheme } from '../../context/ThemeContext';
import { useAuth, ACTOR_PROFILES } from '../../context/AuthContext';
import type { UserRole } from '../../types';

interface NavItemDef {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  roles?: UserRole[];
  end?: boolean;
}

const ALL_NAV_ITEMS: NavItemDef[] = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/patients',     icon: Users,           label: 'Patients',       roles: ['admin', 'receptionist', 'opd', 'emergency'] },
  { to: '/appointments', icon: CalendarDays,    label: 'Appointments',   roles: ['admin', 'receptionist', 'opd'] },
  { to: '/records',      icon: ClipboardList,   label: 'Medical Records',roles: ['admin', 'opd', 'emergency', 'laboratory'] },
  { to: '/pharmacy',     icon: Pill,            label: 'Pharmacy',       roles: ['admin', 'pharmacy'] },
  { to: '/doctors',      icon: Stethoscope,     label: 'Doctors',        roles: ['admin', 'opd'] },
  { to: '/reports',      icon: BarChart2,       label: 'Reports',        roles: ['admin'] },
];

interface LayoutProps { children: React.ReactNode }

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { currentUser, role, logout, switchRole } = useAuth();

  const navItems = ALL_NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(role)
  );

  const currentPage = ALL_NAV_ITEMS.find(n =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
  );

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}

      {/* ══ SIDEBAR ══ */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-visible' : ''}`}>

        {/* University Brand Block */}
        <div className="sidebar-brand">
          <div className="brand-logo-wrap">
            <img src="/bu-logo.png" alt="Borana University" className="brand-logo" />
            <div className="brand-logo-glow" />
          </div>
          {sidebarOpen && (
            <div className="brand-text">
              <span className="brand-name">BruClinic</span>
              <span className="brand-uni">Borana University</span>
              <span className="brand-tagline">Health Services</span>
            </div>
          )}
        </div>

        <div className="sidebar-divider" />

        {/* Current Role Badge */}
        {sidebarOpen && (
          <div style={{ padding: '0.5rem 1rem 0.25rem 1rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${currentUser?.badgeColor || '#3b82f6'}33`,
              borderRadius: 6,
              padding: '0.4rem 0.6rem',
              fontSize: '0.72rem',
            }}>
              <span style={{ color: currentUser?.badgeColor || '#3b82f6', fontWeight: 700 }}>
                {role.toUpperCase()} PORTAL
              </span>
              <button
                type="button"
                onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--clr-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: '0.68rem',
                }}
                title="Switch actor"
              >
                <ArrowRightLeft size={11} /> Switch
              </button>
            </div>

            {/* Quick Switch Dropdown */}
            {roleSwitcherOpen && (
              <div style={{
                background: 'var(--clr-bg-surface)',
                border: '1px solid var(--clr-border)',
                borderRadius: 8,
                marginTop: 6,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {(Object.keys(ACTOR_PROFILES) as UserRole[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { switchRole(r); setRoleSwitcherOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '0.35rem 0.5rem',
                      background: role === r ? 'rgba(59,130,246,0.15)' : 'transparent',
                      border: 'none',
                      borderRadius: 4,
                      color: role === r ? 'var(--clr-primary-400)' : 'var(--clr-text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: role === r ? 700 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{r.toUpperCase()}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--clr-text-muted)', marginLeft: 'auto' }}>
                      {ACTOR_PROFILES[r].name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nav Section */}
        {sidebarOpen && <div className="nav-section-label">Department Menu</div>}
        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={!sidebarOpen ? label : undefined}
            >
              <div className="nav-icon-wrap">
                <Icon size={18} className="nav-icon" />
              </div>
              {sidebarOpen && <span className="nav-label">{label}</span>}
              {sidebarOpen && <ChevronRight size={13} className="nav-arrow" />}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-divider" />
          {sidebarOpen && <div className="nav-section-label">Account</div>}
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={!sidebarOpen ? 'Settings' : undefined}
          >
            <div className="nav-icon-wrap"><Settings size={18} className="nav-icon" /></div>
            {sidebarOpen && <span className="nav-label">Settings</span>}
          </NavLink>

          {sidebarOpen && (
            <div className="sidebar-user" style={{ borderColor: `${currentUser?.badgeColor || '#3b82f6'}33` }}>
              <div
                className="sidebar-user-avatar"
                style={{ background: currentUser?.badgeColor || '#3b82f6', color: '#fff', fontWeight: 800 }}
              >
                {currentUser?.avatarInitials || 'AD'}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{currentUser?.name || 'Staff User'}</div>
                <div className="sidebar-user-role">{currentUser?.roleTitle.split('&')[0] || 'Clinic Staff'}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                style={{ background: 'transparent', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}
                title="Sign out to Login"
              >
                <LogOut size={16} className="sidebar-logout" />
              </button>
            </div>
          )}

          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(v => !v)}
            title="Toggle sidebar"
          >
            {sidebarOpen
              ? <><ChevronLeft size={16} /><span>Collapse</span></>
              : <ChevronRight size={16} />
            }
          </button>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className="main-wrapper">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
              <Menu size={22} />
            </button>

            {/* Page identity */}
            <div className="topbar-page-info">
              <div className="topbar-logo-mini">
                <img src="/bu-logo.png" alt="BU" className="topbar-logo-img" />
              </div>
              <div>
                <div className="topbar-page-title">
                  {currentPage?.label ?? 'Settings'}
                </div>
                <div className="topbar-breadcrumb">
                  <HeartPulse size={11} />
                  Borana University Health Services · {currentUser?.department || 'Clinic'}
                </div>
              </div>
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-date-badge">
              <CalendarDays size={13} />
              {today}
            </div>

            <button
              className="topbar-icon-btn theme-toggle-btn"
              id="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark'
                ? <Sun size={18} className="theme-icon sun" />
                : <Moon size={18} className="theme-icon moon" />}
            </button>

            <button className="topbar-icon-btn" id="notif-btn" title="Notifications">
              <Bell size={18} />
              <span className="notif-badge">3</span>
            </button>

            {/* Topbar user card */}
            <div className="topbar-user" onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)} style={{ cursor: 'pointer' }}>
              <div
                className="topbar-user-avatar"
                style={{ background: `${currentUser?.badgeColor || '#3b82f6'}33`, color: currentUser?.badgeColor || '#3b82f6', fontWeight: 800 }}
              >
                {currentUser?.avatarInitials || 'AD'}
              </div>
              <div className="topbar-user-label">
                <span className="topbar-user-name">{currentUser?.name || 'Staff User'}</span>
                <span className="topbar-user-role" style={{ color: currentUser?.badgeColor }}>
                  {currentUser?.role.toUpperCase()}
                </span>
              </div>
            </div>

            <button
              className="topbar-icon-btn"
              onClick={handleLogout}
              title="Sign Out"
              style={{ color: 'var(--clr-rose-400)' }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
