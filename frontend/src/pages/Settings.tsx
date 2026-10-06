import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Save, Lock, Info, Clock, Hospital } from 'lucide-react';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">System configuration and preferences</p>
        </div>
      </div>

      {/* Theme Toggle Card */}
      <div className="card" style={{ borderColor: 'rgba(59,130,246,0.25)' }}>
        <h3 style={{ marginBottom: '1.25rem', fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--clr-primary-300)' }}>
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />} Appearance
        </h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {([
            { id: 'dark',  icon: <Moon size={22} />,    label: 'Dark Mode',  sub: 'Easy on the eyes' },
            { id: 'light', icon: <Sun size={22} />,     label: 'Light Mode', sub: 'Bright & clean' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              onClick={() => { if (theme !== opt.id) toggleTheme(); }}
              id={`theme-${opt.id}`}
              style={{
                flex: 1, minWidth: 160,
                display: 'flex', alignItems: 'center', gap: '0.875rem',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-lg)',
                border: theme === opt.id ? '2px solid var(--clr-primary-400)' : '2px solid var(--clr-border)',
                background: theme === opt.id
                  ? 'linear-gradient(135deg, rgba(29,78,216,0.15), rgba(14,165,233,0.08))'
                  : 'var(--clr-bg-hover)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                color: 'var(--clr-text-primary)',
                textAlign: 'left',
                boxShadow: theme === opt.id ? '0 0 20px rgba(29,78,216,0.2)' : 'none',
              }}
            >
              <div style={{
                width: 44, height: 44,
                borderRadius: 'var(--radius-md)',
                background: theme === opt.id ? 'rgba(29,78,216,0.2)' : 'var(--clr-bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: opt.id === 'light' ? '#fbbf24' : '#93c5fd',
                flexShrink: 0,
              }}>
                {opt.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{opt.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', marginTop: '0.15rem' }}>{opt.sub}</div>
              </div>
              {theme === opt.id && (
                <div style={{ marginLeft: 'auto', width: 10, height: 10, borderRadius: '50%', background: 'var(--clr-primary-400)', boxShadow: '0 0 8px rgba(59,130,246,0.6)' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Clinic Info */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem', fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--clr-primary-300)' }}>
            <Hospital size={17} /> Clinic Information
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Clinic Name</label>
              <input defaultValue="Borana University Clinic" />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input defaultValue="Yabelo, Oromia, Ethiopia" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input defaultValue="+251 46 XXX XXXX" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input defaultValue="clinic@boru.edu.et" />
            </div>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              <Save size={15} /> Save Changes
            </button>
          </div>
        </div>

        {/* System */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem', fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--clr-primary-300)' }}>
            <Clock size={17} /> System Settings
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Working Hours Start</label>
              <input type="time" defaultValue="08:00" />
            </div>
            <div className="form-group">
              <label className="form-label">Working Hours End</label>
              <input type="time" defaultValue="17:00" />
            </div>
            <div className="form-group">
              <label className="form-label">Appointment Duration (minutes)</label>
              <select defaultValue="30">
                {['15','30','45','60'].map(v => <option key={v} value={v}>{v} minutes</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Low Stock Threshold</label>
              <input type="number" defaultValue="20" min="1" />
            </div>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              <Save size={15} /> Save Settings
            </button>
          </div>
        </div>

        {/* Admin Account */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem', fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--clr-primary-300)' }}>
            <Lock size={17} /> Admin Account
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input defaultValue="System Administrator" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" defaultValue="admin@boru.edu.et" />
            </div>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input type="password" placeholder="Enter current password" />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" placeholder="Enter new password" />
            </div>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              <Save size={15} /> Update Account
            </button>
          </div>
        </div>

        {/* About BruClinic */}
        <div className="card" style={{ borderColor: 'rgba(220,38,38,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <img src="/bu-logo.png" alt="BU Logo" style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(220,38,38,0.4)', objectFit: 'cover' }} />
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--clr-primary-300)' }}>
                <Info size={17} /> About BruClinic
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)', marginTop: '0.15rem' }}>Borana University, Yabelo, Ethiopia</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              ['System',     'BruClinic v1.0.0'],
              ['University', 'Borana University'],
              ['Location',   'Yabelo, Oromia, Ethiopia'],
              ['Frontend',   'React + TypeScript + Vite'],
              ['Charts',     'Recharts'],
              ['Icons',      'Lucide React'],
              ['Build Date', new Date().toLocaleDateString()],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.6rem 0', borderBottom: '1px solid var(--clr-border)' }}>
                <span style={{ color: 'var(--clr-text-muted)' }}>{k}</span>
                <span style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
