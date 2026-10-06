import { useClinic } from '../../context/ClinicContext';
import { MONTHLY_VISITS, DIAGNOSIS_DISTRIBUTION } from '../../data/mockData';
import {
  Users, Stethoscope, HeartPulse, Pill, FlaskConical,
  CreditCard, TrendingUp,
  Building2, ShieldCheck, Activity
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

export default function AdminDashboard() {
  const { patients, doctors, medicines, queue, erCases, labOrders, pharmacyOrders } = useClinic();

  const activeDocs = doctors.filter(d => d.available).length;
  const criticalER = erCases.filter(c => c.acuity === 'Red').length;
  const pendingRx = pharmacyOrders.filter(p => p.status === 'Pending').length;
  const pendingLab = labOrders.filter(l => l.status !== 'Completed').length;
  const lowStock = medicines.filter(m => m.stock <= m.minStock).length;

  const STATS = [
    { label: 'Registered Patients', val: patients.length, icon: Users, color: '#3b82f6', sub: '+18 this week' },
    { label: 'OPD & ER Staff on Duty', val: `${activeDocs}/${doctors.length}`, icon: Stethoscope, color: '#10b981', sub: 'Fully staffed' },
    { label: 'Active Emergency Cases', val: erCases.length, icon: HeartPulse, color: '#ef4444', sub: `${criticalER} Red Priority` },
    { label: 'Pending Prescriptions', val: pendingRx, icon: Pill, color: '#f59e0b', sub: 'In pharmacy queue' },
    { label: 'Pending Lab Tests', val: pendingLab, icon: FlaskConical, color: '#8b5cf6', sub: 'Turnaround ~35m' },
    { label: 'Card Room Queue', val: queue.length, icon: CreditCard, color: '#0ea5e9', sub: 'Real-time tokens' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(14, 27, 54, 0.95) 0%, rgba(20, 39, 78, 0.88) 50%, rgba(13, 24, 48, 0.95) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.28)',
        borderRadius: 16,
        padding: '1.75rem 2rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient background glow */}
        <div style={{
          position: 'absolute', top: -30, right: -20, width: 260, height: 260,
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none', filter: 'blur(35px)'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.3rem 0.75rem', borderRadius: 99,
              background: 'rgba(37, 99, 235, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#60a5fa', fontSize: '0.74rem', fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.65rem'
            }}>
              <ShieldCheck size={14} /> System Administrator &amp; Medical Director View
            </div>
            <h1 style={{
              fontSize: '1.85rem', fontWeight: 900, fontFamily: 'var(--font-heading)',
              color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.35rem'
            }}>
              Hospital Executive Overview
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>Borana University Health Services</span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
              <span>Multi-department Clinical Coordination</span>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '0.45rem 0.95rem', borderRadius: 99,
              background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399', fontSize: '0.8rem', fontWeight: 700
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
              6 Departments Operational
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.45rem 0.95rem', borderRadius: 99,
              background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600
            }}>
              <Building2 size={14} style={{ color: '#60a5fa' }} /> Main Campus Facility
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="stat-card" style={{ borderColor: `${s.color}33` }}>
              <div className="stat-icon" style={{ background: `${s.color}1a`, color: s.color }}>
                <Icon size={22} />
              </div>
              <div>
                <div className="stat-value">{s.val}</div>
                <div className="stat-label">{s.label}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--clr-text-muted)', marginTop: '0.15rem' }}>{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={18} style={{ color: '#3b82f6' }} /> Patient Volume &amp; Departmental Visits
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)' }}>2026 Academic Year</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={MONTHLY_VISITS} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.07)" />
              <XAxis dataKey="month" tick={{ fill: '#4d6a94', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4d6a94', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#111e33', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: '#fff' }} />
              <Area type="monotone" dataKey="visits" stroke="#3b82f6" strokeWidth={2.5} fill="url(#adminGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={18} style={{ color: '#10b981' }} /> Case Category Mix
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={DIAGNOSIS_DISTRIBUTION} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                {DIAGNOSIS_DISTRIBUTION.map((e, idx) => (
                  <Cell key={idx} fill={e.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#111e33', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', fontSize: '0.72rem', marginTop: '0.5rem' }}>
            {DIAGNOSIS_DISTRIBUTION.slice(0, 4).map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                <span>{d.name}: {d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Department Status Grid */}
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={18} className="text-primary" /> Active Departmental Workloads
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {/* Card Reception */}
          <div className="card" style={{ borderLeft: '3px solid #0ea5e9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>Card Room &amp; Reception</span>
              <span className="badge badge-blue">Normal</span>
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--clr-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div>Patients Checked In: <strong>{queue.length}</strong></div>
              <div>Today Registration Cards: <strong>{patients.length}</strong></div>
            </div>
          </div>

          {/* OPD Clinic */}
          <div className="card" style={{ borderLeft: '3px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>OPD Consultation &amp; Triage</span>
              <span className="badge badge-green">Operational</span>
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--clr-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div>Waiting for Doctor: <strong>{queue.filter(q => q.stage === 'Doctor Consultation').length}</strong></div>
              <div>Nurse Triage Queue: <strong>{queue.filter(q => q.stage === 'Nurse Triage').length}</strong></div>
            </div>
          </div>

          {/* Emergency */}
          <div className="card" style={{ borderLeft: '3px solid #ef4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>Emergency &amp; Trauma (ER)</span>
              <span className="badge badge-red">{criticalER > 0 ? 'High Acuity' : 'Normal'}</span>
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--clr-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div>Admitted ER Beds: <strong>{erCases.length} / 8</strong></div>
              <div>Red (Immediate Resus): <strong>{criticalER}</strong></div>
            </div>
          </div>

          {/* Pharmacy */}
          <div className="card" style={{ borderLeft: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>Pharmacy Dispensary</span>
              <span className="badge badge-amber">{lowStock > 0 ? `${lowStock} Low Stock` : 'Stock OK'}</span>
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--clr-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div>Prescriptions Pending: <strong>{pendingRx}</strong></div>
              <div>Tracked Medicine SKUs: <strong>{medicines.length}</strong></div>
            </div>
          </div>

          {/* Laboratory */}
          <div className="card" style={{ borderLeft: '3px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, color: 'var(--clr-text-primary)' }}>Diagnostic Laboratory</span>
              <span className="badge badge-violet">Active</span>
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--clr-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div>Diagnostic Requests: <strong>{labOrders.length}</strong></div>
              <div>Pending Verification: <strong>{pendingLab}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
